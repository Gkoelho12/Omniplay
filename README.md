# OmniPlay

Hub de minijogos multiplayer em **HTML + CSS + JS puro** (sem build).
Online (Supabase), mesmo dispositivo (2–4 jogadores) ou 100 % offline.

## Pôr a funcionar

1. **Base de dados** — Supabase › *SQL Editor* › cola o conteúdo de [`supabase_schema.sql`](supabase_schema.sql) › *Run*.
2. **Authentication › Providers › Email** — desativa **Confirm email** (o login é por *username + password*;
   por baixo é criado o email `username@omniplay.app`).
3. **Chave pública** — Project Settings › API › copia a **anon public** key para [`js/config.js`](js/config.js)
   (`SUPABASE_ANON_KEY`). O `SUPABASE_URL` já está preenchido.
4. **Servidor local** (necessário para o modo offline/PWA):
   ```
   python -m http.server 5173      # ou:  npx serve
   ```
   e abre <http://localhost:5173>. (Também funciona abrindo `index.html` diretamente, mas sem service worker.)

> ⚠️ **Nunca** ponhas a password da base de dados nem a `service_role` key neste código — o site é público.
> A `anon` key é segura porque as regras RLS do SQL protegem os dados.
> Como a password foi partilhada numa conversa, recomendo **mudá-la** em Project Settings › Database.

## Estrutura

| Ficheiro | Função |
|---|---|
| `index.html`, `style.css` | Shell + design system (dark, neon, glassmorphism) |
| `js/app.js` | Router, Passaporte Omni, login, Hub (carrossel infinito) |
| `js/play.js` | Escolha de modo, salas online, lobby, ecrã de jogo, resultados, Roleta Omni |
| `js/views.js` | Amigos (placar `4 × 2`), Perfil (de qualquer jogador + histórico), Ranking |
| `js/backend.js` | Supabase: auth, perfis, amigos, estatísticas, fila offline de partidas, presença/convites |
| `js/session.js` | Registo de jogos, salas Realtime (anfitrião autoritativo), sessão de jogo |
| `js/games/*.js` | Os jogos |
| `supabase_schema.sql` | Tabelas, RLS, funções (`submit_match`, `head_to_head`, …) |
| `sw.js`, `manifest.webmanifest` | Offline / instalável |
| `mexicana.html` | Janela dedicada para jogar Mexicana diretamente |

## Jogos Disponíveis

- **Mexicana** ([`mexicana.html`](mexicana.html) / [`js/games/mexicana.js`](js/games/mexicana.js)): 2 a 6 jogadores (online ou mesmo dispositivo). Baralho tradicional com 4 jokers (56 cartas), poderes especiais (2, 3, 7, 8, 10, Joker), 4 naipes seguidos que limpam a mesa e regras completas.
- **Quatro em Linha** e **Reflexos**: os ficheiros continuam no projeto ([`js/games/connect4.js`](js/games/connect4.js) e [`js/games/reflex.js`](js/games/reflex.js)); para os voltar a mostrar no menu, basta descomentar as respetivas tags `<script>` em [`index.html`](index.html).

