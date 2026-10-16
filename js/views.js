/* OmniPlay · vistas: Amigos, Perfil, Ranking */
(function (O) {
  const { $, $$, esc, avatar, levelInfo, frameFor, FRAMES, toast, openModal, fmtDate, AVATARS } = O.util;
  const B = O.Backend;
  const gm = (id) => O.games.get(id) || { name: id, icon: '🎮', hue: 200 };
  const RES = { win: ['Vitória', 'win'], loss: ['Derrota', 'loss'], draw: ['Empate', 'draw'] };

  const stale = (s) => (s ? '<span class="stale" title="Sem ligação — a mostrar dados guardados">📦 dados guardados</span>' : '');
  const empty = (icon, title, text, btn) => `<div class="empty"><div class="empty-ic">${icon}</div><h3>${title}</h3><p>${text}</p>${btn || ''}</div>`;
  const loading = () => '<div class="loader"><i></i><i></i><i></i></div>';

  /** "4 × 2" estilo placar */
  function score(w, l, d) {
    return `<span class="vs"><b class="w">${w}</b><i>×</i><b class="l">${l}</b>${d ? `<small>${d} emp.</small>` : ''}</span>`;
  }
  function h2hRows(rows, emptyMsg) {
    if (!rows || !rows.length) return `<p class="muted small">${emptyMsg}</p>`;
    return rows.map((r) => `<div class="h2h-row" style="--hue:${gm(r.game_id).hue}">
      <span class="h2h-game">${gm(r.game_id).icon} ${esc(gm(r.game_id).name)}</span>${score(r.wins, r.losses, r.draws)}</div>`).join('');
  }
  const goProfile = (u) => O.app.nav('profile', u);

  /* ===================== AMIGOS ===================== */
  O.views.friends = {
    async render(root) {
      if (!B.account) {
        root.innerHTML = `<section class="page">${empty('🤝', 'Os amigos vivem na tua conta', 'Entra para adicionar amigos e ver quantas vezes ganhaste (ou perdeste) contra cada um em cada jogo.',
          '<button class="btn btn-neon btn-lg" id="fr-login">Entrar / Criar conta</button>')}</section>`;
        $('#fr-login').onclick = () => O.app.openAuth();
        return;
      }
      root.innerHTML = `<section class="page">
        <div class="page-head"><h2>Amigos</h2><p class="muted">Adiciona jogadores pelo username e compara resultados.</p></div>
        <div class="glass add-box">
          <label class="field"><span>Procurar jogador</span>
          <input id="fr-q" placeholder="username…" maxlength="16" autocomplete="off"></label>
          <div id="fr-results" class="search-results"></div>
        </div>
        <div id="fr-body">${loading()}</div></section>`;
      let tm;
      $('#fr-q').addEventListener('input', (e) => { clearTimeout(tm); tm = setTimeout(() => search(e.target.value), 280); });
      load();
    }
  };

  // atualiza só as bolinhas online/offline (sem voltar a pedir dados)
  B.on('presence', () => {
    if (O.app.current !== 'friends') return;
    $$('.friend-card .fc-top').forEach((t) => {
      const d = t.querySelector('.dot'), on = B.onlineIds.has(t.dataset.pid);
      if (d) { d.classList.toggle('on', on); d.title = on ? 'Online' : 'Offline'; }
    });
  });

  async function search(text) {
    const box = $('#fr-results');
    if (!box) return;
    if (!B.canNet) { box.innerHTML = '<p class="muted small">Precisas de ligação à internet para procurar.</p>'; return; }
    if (!text.trim()) { box.innerHTML = ''; return; }
    try {
      const users = await B.searchUsers(text);
      box.innerHTML = users.length ? users.map((u) => `
        <div class="user-row" data-id="${u.id}">
          ${avatar(u, 40)}<div class="ur-main"><b>${esc(u.display_name)}</b><small>@${esc(u.username)} · Nv ${levelInfo(u.xp).level}</small></div>
          <button class="btn btn-sm btn-ghost" data-act="view" data-u="${esc(u.username)}">Perfil</button>
          <button class="btn btn-sm btn-neon" data-act="add" data-id="${u.id}">Adicionar</button></div>`).join('')
        : '<p class="muted small">Nenhum jogador encontrado.</p>';
      $$('[data-act=view]', box).forEach((b) => (b.onclick = () => goProfile({ username: b.dataset.u })));
      $$('[data-act=add]', box).forEach((b) => (b.onclick = async () => {
        b.disabled = true;
        try { await B.sendRequest(b.dataset.id); b.textContent = 'Pedido enviado ✓'; toast('Pedido de amizade enviado!', { type: 'good' }); load(); }
        catch (e) { toast(e.message, { type: 'bad' }); b.disabled = false; }
      }));
    } catch (e) { box.innerHTML = `<p class="muted small">${esc(e.message)}</p>`; }
  }

  async function load() {
    const body = $('#fr-body');
    if (!body) return;
    try {
      const [{ data: fr, stale: s1 }, h2h] = await Promise.all([B.getFriends(), B.getAllH2H().catch(() => ({ data: [] }))]);
      if (!$('#fr-body')) return;
      const byFriend = {};
      (h2h.data || []).forEach((r) => (byFriend[r.friend_id] = byFriend[r.friend_id] || []).push(r));
      O.app.refreshBadge && O.app.refreshBadge();

      let html = stale(s1);
      if (fr.incoming.length) html += `<h3 class="sec">Pedidos recebidos</h3>` + fr.incoming.map((i) => userRow(i, `
          <button class="btn btn-sm btn-neon" data-act="accept" data-fid="${i.fid}">Aceitar</button>
          <button class="btn btn-sm btn-ghost" data-act="remove" data-fid="${i.fid}">Recusar</button>`)).join('');
      html += `<h3 class="sec">Os teus amigos <small>${fr.friends.length}</small></h3>`;
      html += fr.friends.length ? `<div class="friend-grid">${fr.friends.map((f) => friendCard(f, byFriend[f.profile.id])).join('')}</div>`
        : empty('👥', 'Ainda sem amigos', 'Procura um username acima e envia um pedido.');
      if (fr.outgoing.length) html += `<h3 class="sec">Pedidos enviados</h3>` + fr.outgoing.map((i) => userRow(i, `
          <span class="muted small">À espera…</span><button class="btn btn-sm btn-ghost" data-act="remove" data-fid="${i.fid}">Cancelar</button>`)).join('');
      body.innerHTML = html;

      $$('[data-act=accept]', body).forEach((b) => (b.onclick = () => act(() => B.acceptRequest(+b.dataset.fid), 'Agora são amigos! 🎉')));
      $$('[data-act=remove]', body).forEach((b) => (b.onclick = () => act(() => B.removeFriendship(+b.dataset.fid), 'Removido.')));
      $$('[data-act=profile]', body).forEach((b) => (b.onclick = () => goProfile({ id: b.dataset.id })));
      $$('.user-row[data-pid], .fc-top[data-pid]', body).forEach((r) => (r.querySelector('.ur-main, .fc-name') || r).addEventListener('click', () => goProfile({ id: r.dataset.pid })));
    } catch (e) {
      body.innerHTML = empty('📡', 'Sem dados offline', 'Liga-te à internet para carregares a lista de amigos pela primeira vez.');
    }
  }
  async function act(fn, msg) {
    try { await fn(); toast(msg, { type: 'good' }); load(); } catch (e) { toast(e.message || 'Erro', { type: 'bad' }); }
  }
  const userRow = (i, actions) => `<div class="user-row glass" data-pid="${i.profile.id}">${avatar(i.profile, 40)}
    <div class="ur-main"><b>${esc(i.profile.display_name)}</b><small>@${esc(i.profile.username)} · Nv ${levelInfo(i.profile.xp).level}</small></div>${actions}</div>`;

  function friendCard(f, rows) {
    const p = f.profile, on = B.onlineIds.has(p.id);
    const tw = (rows || []).reduce((a, r) => a + r.wins, 0), tl = (rows || []).reduce((a, r) => a + r.losses, 0);
    return `<article class="friend-card glass">
      <div class="fc-top" data-pid="${p.id}">${avatar(p, 52)}
        <div class="fc-name"><b>${esc(p.display_name)}</b><small>@${esc(p.username)} · Nv ${levelInfo(p.xp).level}</small></div>
        <span class="dot ${on ? 'on' : ''}" title="${on ? 'Online' : 'Offline'}"></span></div>
      <div class="fc-h2h"><div class="fc-h2h-head"><span>Tu × ${esc(p.display_name)}</span>${rows && rows.length ? score(tw, tl) : ''}</div>
        ${h2hRows(rows, 'Ainda não jogaram juntos online.')}</div>
      <div class="fc-actions"><button class="btn btn-sm btn-ghost" data-act="profile" data-id="${p.id}">Ver perfil</button>
        <button class="btn btn-sm btn-ghost danger" data-act="remove" data-fid="${f.fid}">Remover</button></div></article>`;
  }

  /* ===================== PERFIL ===================== */
  O.views.profile = {
    async render(root, params) {
      const self = params.self || (B.user && (params.id === B.user.id));
      root.innerHTML = `<section class="page">${loading()}</section>`;
      const page = root.firstElementChild;
      let prof, st = false;
      try {
        if (self) prof = B.me();
        else {
          if (!B.account) { page.innerHTML = empty('🔒', 'Entra para ver perfis', 'Os perfis de outros jogadores estão disponíveis na tua conta.', '<button class="btn btn-neon" id="pf-login">Entrar</button>'); $('#pf-login').onclick = () => O.app.openAuth(); return; }
          const r = await B.getProfile(params.id || params.username); prof = r.data; st = r.stale;
        }
      } catch (e) {
        page.innerHTML = empty('🌌', 'Jogador não encontrado', 'Não conseguimos carregar este perfil.');
        return;
      }
      const id = prof.id, li = levelInfo(prof.xp), fr = frameFor(prof.xp);
      page.innerHTML = `
        <div class="profile-head glass">
          <div class="ph-avatar">${avatar(prof, 112)}</div>
          <div class="ph-main">
            <h2>${esc(prof.display_name)} ${self && !B.account ? '<small>(convidado)</small>' : ''}</h2>
            <p class="muted">@${esc(prof.username)}${prof.created_at ? ' · membro desde ' + new Date(prof.created_at).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }) : ''}</p>
            ${prof.bio ? `<p class="bio">${esc(prof.bio)}</p>` : ''}
            <div class="xp-line"><b>Nível ${li.level}</b><div class="xp-bar"><i style="width:${li.pct}%"></i></div><span>${li.cur} / ${li.need} XP</span></div>
            <div class="chips"><span class="chip">⭐ ${prof.xp} XP total</span><span class="chip">🪙 ${prof.coins} moedas</span><span class="chip">🖼️ ${esc(fr.name)}</span></div>
            <div class="ph-actions" id="ph-actions"></div>
          </div>
        </div>
        ${stale(st)}
        <div class="cols">
          <div class="col-main">
            <h3 class="sec">Estatísticas por jogo</h3><div id="pf-stats">${loading()}</div>
            ${!self ? `<h3 class="sec">Tu × ${esc(prof.display_name)}</h3><div id="pf-h2h" class="glass pad">${loading()}</div>` : ''}
            <h3 class="sec">Histórico de partidas</h3><div id="pf-hist">${loading()}</div>
          </div>
          <aside class="col-side">
            <h3 class="sec">Molduras de avatar</h3>
            <div class="frames glass pad">${FRAMES.slice(1).map((f) => {
              const ok = li.level >= f.min;
              return `<div class="frame-item ${ok ? '' : 'locked'}"><span class="avatar ${f.cls}" style="--h:${prof.color};--s:46px"><span class="av-face">${esc(prof.avatar)}</span></span>
                <div><b>${f.name}</b><small>${ok ? 'Desbloqueada' : 'Nível ' + f.min}</small></div></div>`;
            }).join('')}</div>
          </aside>
        </div>`;

      // ações
      const ac = $('#ph-actions');
      if (self) {
        ac.innerHTML = `<button class="btn btn-ghost btn-sm" id="pf-edit">✏️ Editar perfil</button>` +
          (B.account ? `<button class="btn btn-ghost btn-sm danger" id="pf-out">Terminar sessão</button>` : `<button class="btn btn-neon btn-sm" id="pf-in">Entrar / Criar conta</button>`);
        $('#pf-edit').onclick = () => editProfile();
        if (B.account) $('#pf-out').onclick = async () => { await B.signOut(); toast('Sessão terminada.'); };
        else $('#pf-in').onclick = () => O.app.openAuth();
      } else if (B.canNet) {
        relationButtons(ac, id, prof);
      }

      // dados
      try {
        const { data: stats } = await B.getUserStats(id);
        $('#pf-stats').innerHTML = stats.length ? `<div class="stat-grid">${stats.map((s) => `
          <div class="stat-card glass" style="--hue:${gm(s.game_id).hue}"><div class="sc-head"><span>${gm(s.game_id).icon}</span><b>${esc(gm(s.game_id).name)}</b></div>
            ${score(s.wins, s.losses, s.draws)}
            <div class="wr"><i style="width:${s.played ? (s.wins / s.played) * 100 : 0}%"></i></div>
            <small class="muted">${s.played} jogos · ${s.played ? Math.round((s.wins / s.played) * 100) : 0}% vitórias</small></div>`).join('')}</div>`
          : empty('🎯', 'Sem partidas ainda', 'Joga para ver as estatísticas aqui.');
      } catch { $('#pf-stats').innerHTML = '<p class="muted">Sem dados offline.</p>'; }

      if (!self) {
        try { const { data } = await B.getH2H(id); const t = $('#pf-h2h'); if (t) t.innerHTML = h2hRows(data, 'Ainda não jogaram um contra o outro.'); }
        catch { const t = $('#pf-h2h'); if (t) t.innerHTML = '<p class="muted">Sem dados offline.</p>'; }
      }
      try {
        const { data: hist } = await B.getHistory(id);
        $('#pf-hist').innerHTML = hist.length ? `<div class="hist">${hist.map((h) => histRow(h, id)).join('')}</div>`
          : empty('📜', 'Histórico vazio', 'As partidas aparecem aqui.');
        $$('[data-goto]', $('#pf-hist')).forEach((a) => (a.onclick = () => goProfile({ id: a.dataset.goto })));
      } catch { $('#pf-hist').innerHTML = '<p class="muted">Sem dados offline.</p>'; }
    }
  };

  async function relationButtons(ac, id, prof) {
    const rel = await B.getRelation(id);
    const rerender = () => O.app.nav('profile', { id });
    if (!rel) ac.innerHTML = '<button class="btn btn-neon btn-sm" id="rl-add">➕ Adicionar amigo</button>';
    else if (rel.status === 'accepted') ac.innerHTML = '<span class="chip good">✓ Amigos</span><button class="btn btn-ghost btn-sm danger" id="rl-rm">Remover</button>';
    else if (rel.mine) ac.innerHTML = '<span class="chip">Pedido enviado</span><button class="btn btn-ghost btn-sm" id="rl-rm">Cancelar</button>';
    else ac.innerHTML = '<button class="btn btn-neon btn-sm" id="rl-ok">Aceitar pedido</button><button class="btn btn-ghost btn-sm" id="rl-rm">Recusar</button>';
    const wire = (sel, fn, msg) => { const b = $(sel, ac); if (b) b.onclick = async () => { try { await fn(); toast(msg, { type: 'good' }); rerender(); } catch (e) { toast(e.message, { type: 'bad' }); } }; };
    wire('#rl-add', () => B.sendRequest(id), 'Pedido enviado!');
    wire('#rl-ok', () => B.acceptRequest(rel.id), 'Agora são amigos! 🎉');
    wire('#rl-rm', () => B.removeFriendship(rel.id), 'Removido.');
  }

  function histRow(h, ownerId) {
    const g = gm(h.game_id), [label, cls] = RES[h.result] || RES.loss;
    const others = (h.players || []).filter((p) => !(ownerId && p.user_id === ownerId) && !(!ownerId && p.seat === 0));
    return `<div class="hist-row ${cls}" style="--hue:${g.hue}">
      <div class="hr-ic">${g.icon}</div>
      <div class="hr-main"><b>${esc(g.name)}</b>
        <small>${h.mode === 'online' ? '🌐 Online' : '📱 Local'} · vs ${others.length ? others.map((p) => p.user_id ? `<a data-goto="${p.user_id}">${esc(p.name)}</a>` : esc(p.name)).join(', ') : '—'}</small></div>
      <div class="hr-side"><span class="badge-res ${cls}">${label}</span><small>${fmtDate(h.played_at)}${h.xp_gain ? ` · +${h.xp_gain} XP` : ''}</small></div></div>`;
  }

  function editProfile() {
    const me = B.me();
    let av = me.avatar, hue = me.color;
    const m = openModal(`<div class="edit"><h2>Editar perfil</h2>
      <label class="field"><span>Nome a mostrar</span><input id="ep-name" maxlength="20" value="${esc(me.display_name || '')}"></label>
      <label class="field"><span>Bio</span><input id="ep-bio" maxlength="140" value="${esc(me.bio || '')}" placeholder="Uma frase sobre ti…"></label>
      <div class="field"><span>Avatar</span><div class="av-pick">${AVATARS.map((a) => `<button type="button" class="av-opt ${a === av ? 'sel' : ''}" data-a="${a}">${a}</button>`).join('')}</div></div>
      <label class="field"><span>Cor</span><input id="ep-hue" type="range" min="0" max="360" value="${hue}" class="hue-range"></label>
      <div class="edit-actions"><button class="btn btn-ghost" id="ep-cancel">Cancelar</button><button class="btn btn-neon" id="ep-save">Guardar</button></div></div>`);
    const el = m.el;
    $$('.av-opt', el).forEach((b) => (b.onclick = () => { av = b.dataset.a; $$('.av-opt', el).forEach((x) => x.classList.toggle('sel', x === b)); }));
    $('#ep-cancel', el).onclick = () => m.close();
    $('#ep-save', el).onclick = async () => {
      try {
        await B.updateProfile({ display_name: $('#ep-name', el).value.trim() || me.username, bio: $('#ep-bio', el).value.trim(), avatar: av, color: +$('#ep-hue', el).value });
        m.close(); O.app.nav('profile', { self: true }); toast('Perfil atualizado!', { type: 'good' });
      } catch (e) { toast(e.message, { type: 'bad' }); }
    };
  }

  /* ===================== RANKING ===================== */
  O.views.ranking = {
    async render(root) {
      root.innerHTML = `<section class="page"><div class="page-head"><h2>Ranking Omni</h2><p class="muted">Os 20 jogadores com mais XP.</p></div><div id="rk">${loading()}</div></section>`;
      const box = $('#rk');
      if (!B.account) { box.innerHTML = empty('🏆', 'Ranking global', 'Entra na tua conta para ver o ranking.', '<button class="btn btn-neon" id="rk-login">Entrar</button>'); $('#rk-login').onclick = () => O.app.openAuth(); return; }
      try {
        const { data, stale: s } = await B.getLeaderboard();
        box.innerHTML = stale(s) + `<div class="rank-list">${data.map((u, i) => `
          <div class="rank-row glass ${B.user.id === u.id ? 'me' : ''} r${i + 1}" data-id="${u.id}">
            <span class="rk-pos">${['🥇', '🥈', '🥉'][i] || i + 1}</span>${avatar(u, 42)}
            <div class="ur-main"><b>${esc(u.display_name)}</b><small>@${esc(u.username)}</small></div>
            <span class="rk-lvl">Nv ${levelInfo(u.xp).level}</span><span class="rk-xp">${u.xp} XP</span></div>`).join('')}</div>`;
        $$('.rank-row', box).forEach((r) => (r.onclick = () => goProfile({ id: r.dataset.id })));
      } catch { box.innerHTML = empty('📡', 'Sem ligação', 'O ranking precisa de internet.'); }
    }
  };
})(window.Omni);
