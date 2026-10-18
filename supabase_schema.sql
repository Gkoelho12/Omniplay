-- =====================================================================
--  OmniPlay · esquema PostgreSQL (Supabase)
--  Cola tudo no  SQL Editor  do Supabase e carrega em "Run".
--  É seguro correr mais do que uma vez (usa IF NOT EXISTS / OR REPLACE).
--
--  IMPORTANTE (Authentication > Providers > Email):
--    desativa "Confirm email", porque o login usa username + password
--    (por baixo é criado um email falso  username@omniplay.app).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. PERFIS
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique
              check (username ~ '^[a-z0-9_]{3,16}$'),
  display_name text not null default '',
  avatar      text not null default '🎮',
  color       int  not null default 190 check (color between 0 and 360),
  bio         text not null default '' check (char_length(bio) <= 140),
  xp          int  not null default 0 check (xp >= 0),
  coins       int  not null default 0 check (coins >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists profiles_username_trgm on public.profiles (lower(username));

-- Cria o perfil automaticamente quando alguém se regista
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uname text := lower(coalesce(new.raw_user_meta_data->>'username',
                               split_part(new.email, '@', 1)));
begin
  insert into public.profiles (id, username, display_name, avatar, color)
  values (
    new.id,
    uname,
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), uname),
    coalesce(nullif(new.raw_user_meta_data->>'avatar',''), '🎮'),
    coalesce((new.raw_user_meta_data->>'color')::int, 190)
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. AMIGOS  (pedido -> aceitar)
-- ---------------------------------------------------------------------
create table if not exists public.friendships (
  id         bigint generated always as identity primary key,
  requester  uuid not null references public.profiles(id) on delete cascade,
  addressee  uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);

-- só pode existir 1 relação por par de pessoas (qualquer direção)
create unique index if not exists friendships_pair_uniq
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee);

-- ---------------------------------------------------------------------
-- 3. PARTIDAS
-- ---------------------------------------------------------------------
create table if not exists public.matches (
  id         bigint generated always as identity primary key,
  client_key text unique,                         -- evita duplicados (retries offline)
  game_id    text not null,                       -- 'mexicana', 'connect4', ...
  mode       text not null check (mode in ('online','local')),
  duration_s int  not null default 0,
  played_at  timestamptz not null default now()
);
create index if not exists matches_game_idx on public.matches (game_id, played_at desc);

create table if not exists public.match_players (
  id        bigint generated always as identity primary key,
  match_id  bigint not null references public.matches(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete set null,  -- null = convidado
  name      text not null,
  seat      int  not null default 0,
  result    text not null check (result in ('win','loss','draw')),
  score     int  not null default 0,
  xp_gain   int  not null default 0,
  played_at timestamptz not null default now()
);
create index if not exists mp_user_idx  on public.match_players (user_id, played_at desc);
create index if not exists mp_match_idx on public.match_players (match_id);

-- ---------------------------------------------------------------------
-- 4. SEGURANÇA (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.friendships    enable row level security;
alter table public.matches        enable row level security;
alter table public.match_players  enable row level security;

-- Perfis: qualquer utilizador pode ver perfis públicos; só edita o seu
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- Permissões de escrita
grant insert on public.profiles to authenticated;
revoke update on public.profiles from authenticated, anon;
grant  update (display_name, avatar, color, bio) on public.profiles to authenticated;

-- Amizades
drop policy if exists "friend_select" on public.friendships;
create policy "friend_select" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));

drop policy if exists "friend_insert" on public.friendships;
create policy "friend_insert" on public.friendships
  for insert to authenticated
  with check (requester = auth.uid() and status = 'pending');

drop policy if exists "friend_accept" on public.friendships;
create policy "friend_accept" on public.friendships
  for update to authenticated
  using (addressee = auth.uid()) with check (addressee = auth.uid());

drop policy if exists "friend_delete" on public.friendships;
create policy "friend_delete" on public.friendships
  for delete to authenticated using (auth.uid() in (requester, addressee));

-- Partidas: leitura pública (para ver perfis/histórico de outros). Escrita só via RPC.
drop policy if exists "matches_select" on public.matches;
create policy "matches_select" on public.matches
  for select to authenticated using (true);

drop policy if exists "mp_select" on public.match_players;
create policy "mp_select" on public.match_players
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- 5. FUNÇÕES (RPC)
-- ---------------------------------------------------------------------

-- 5.1 Guardar uma partida + atribuir XP/moedas (calculado no servidor)
--     p_players: [{"user_id":"uuid|null","name":"Ana","seat":0,"result":"win","score":12}, ...]
create or replace function public.submit_match(
  p_client_key text,
  p_game       text,
  p_mode       text,
  p_duration   int,
  p_players    jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_me     uuid := auth.uid();
  v_match  bigint;
  v_found  boolean := false;
  r        jsonb;
  v_uid    uuid;
  v_res    text;
  v_xp     int;
  v_coins  int;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_mode not in ('online','local') then raise exception 'bad mode'; end if;
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) not between 1 and 8 then
    raise exception 'bad players';
  end if;

  -- o autor tem de ser um dos jogadores
  for r in select * from jsonb_array_elements(p_players) loop
    if nullif(r->>'user_id','')::uuid = v_me then v_found := true; end if;
  end loop;
  if not v_found then raise exception 'caller not in match'; end if;

  -- já guardada? (retry)
  select id into v_match from matches where client_key = p_client_key;
  if v_match is not null then return v_match; end if;

  insert into matches (client_key, game_id, mode, duration_s)
  values (p_client_key, left(p_game, 40), p_mode, greatest(0, least(coalesce(p_duration,0), 86400)))
  returning id into v_match;

  for r in select * from jsonb_array_elements(p_players) loop
    v_uid := nullif(r->>'user_id','')::uuid;
    v_res := r->>'result';
    if v_res not in ('win','loss','draw') then v_res := 'loss'; end if;

    -- ignora user_ids que não existam
    if v_uid is not null and not exists (select 1 from profiles where id = v_uid) then
      v_uid := null;
    end if;

    v_xp    := case v_res when 'win' then 50 when 'draw' then 25 else 15 end;
    v_coins := case v_res when 'win' then 20 when 'draw' then 10 else 5  end;

    insert into match_players (match_id, user_id, name, seat, result, score, xp_gain)
    values (v_match, v_uid, left(coalesce(r->>'name','?'), 24),
            coalesce((r->>'seat')::int, 0), v_res,
            coalesce((r->>'score')::int, 0), case when v_uid is null then 0 else v_xp end);

    if v_uid is not null then
      update profiles set xp = xp + v_xp, coins = coins + v_coins where id = v_uid;
    end if;
  end loop;

  return v_match;
end $$;

grant execute on function public.submit_match(text,text,text,int,jsonb) to authenticated;

-- 5.2 Vitórias/derrotas/empates por jogo entre DUAS pessoas (ex.: 4 x 2 na Mexicana)
create or replace function public.head_to_head(p_user uuid, p_other uuid)
returns table (game_id text, wins int, losses int, draws int)
language sql stable security definer set search_path = public as $$
  select m.game_id,
         count(*) filter (where a.result = 'win'  and b.result = 'loss')::int as wins,
         count(*) filter (where a.result = 'loss' and b.result = 'win' )::int as losses,
         count(*) filter (where a.result = 'draw' and b.result = 'draw')::int as draws
    from match_players a
    join match_players b on b.match_id = a.match_id and b.user_id = p_other
    join matches m       on m.id = a.match_id
   where a.user_id = p_user
   group by m.game_id
   order by m.game_id;
$$;
grant execute on function public.head_to_head(uuid, uuid) to authenticated;

-- 5.3 O mesmo, mas para TODOS os amigos do utilizador atual de uma só vez
create or replace function public.friends_head_to_head()
returns table (friend_id uuid, game_id text, wins int, losses int, draws int)
language sql stable security definer set search_path = public as $$
  with f as (
    select case when requester = auth.uid() then addressee else requester end as fid
      from friendships
     where status = 'accepted' and auth.uid() in (requester, addressee)
  )
  select f.fid, m.game_id,
         count(*) filter (where a.result = 'win'  and b.result = 'loss')::int,
         count(*) filter (where a.result = 'loss' and b.result = 'win' )::int,
         count(*) filter (where a.result = 'draw' and b.result = 'draw')::int
    from f
    join match_players a on a.user_id = auth.uid()
    join match_players b on b.match_id = a.match_id and b.user_id = f.fid
    join matches m       on m.id = a.match_id
   group by f.fid, m.game_id;
$$;
grant execute on function public.friends_head_to_head() to authenticated;

-- 5.4 Estatísticas globais por jogo de um utilizador
create or replace function public.user_stats(p_user uuid)
returns table (game_id text, played int, wins int, losses int, draws int)
language sql stable security definer set search_path = public as $$
  select m.game_id,
         count(*)::int,
         count(*) filter (where p.result = 'win')::int,
         count(*) filter (where p.result = 'loss')::int,
         count(*) filter (where p.result = 'draw')::int
    from match_players p join matches m on m.id = p.match_id
   where p.user_id = p_user
   group by m.game_id
   order by count(*) desc;
$$;
grant execute on function public.user_stats(uuid) to authenticated;

-- 5.5 Ranking global (top 20 por XP)
create or replace function public.leaderboard()
returns table (id uuid, username text, display_name text, avatar text, color int, xp int)
language sql stable security definer set search_path = public as $$
  select id, username, display_name, avatar, color, xp
    from profiles order by xp desc, created_at asc limit 20;
$$;
grant execute on function public.leaderboard() to authenticated;

-- ---------------------------------------------------------------------
-- Pronto! Multiplayer online usa Supabase Realtime (broadcast/presence),
-- que não precisa de tabelas nem de configuração extra.
-- ---------------------------------------------------------------------
