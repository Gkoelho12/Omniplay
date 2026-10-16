/* OmniPlay · fluxo de jogo: configuração, salas online, ecrã de jogo, resultados e roleta */
(function (O) {
  const { $, $$, esc, avatar, toast, openModal, closeAllModals, portal, sleep, uid, LS, PCOL, AVATARS, REWARD, levelInfo } = O.util;
  const B = O.Backend;
  const SEAT_HUE = [190, 330, 48, 265, 160, 28];

  // estado atual do fluxo de jogo
  const P = { room: null, session: null, screen: null, game: null };

  function leaveAll() {
    if (P.session) { P.session.destroy(); }
    if (P.room) { P.room.close(); }
    P.room = null; P.session = null; P.screen = null; P.game = null;
  }

  const play = (O.play = {
    inGame() { return P.screen === 'lobby' || (P.screen === 'game' && P.session && !P.session.finished); },
    confirmLeave(cb) {
      const online = !!P.room;
      const m = openModal(`<div class="confirm"><h2>${P.screen === 'lobby' ? 'Sair da sala?' : 'Sair da partida?'}</h2>
        <p class="muted">${online && P.screen === 'game' ? 'Os outros jogadores serão avisados e a partida termina.' : 'Vais perder o progresso desta partida.'}</p>
        <div class="edit-actions"><button class="btn btn-ghost" id="cf-no">Ficar</button><button class="btn btn-neon danger-btn" id="cf-yes">Sair</button></div></div>`);
      $('#cf-no', m.el).onclick = () => m.close();
      $('#cf-yes', m.el).onclick = () => { m.close(); leaveAll(); cb(); };
    },

    /* ============ Escolha de modo ============ */
    openSetup(game) {
      if (play.inGame()) return play.confirmLeave(() => play.openSetup(game));
      const canOnline = B.configured && B.account && navigator.onLine;
      const why = !B.configured ? 'Servidor não configurado' : !B.account ? 'Precisa de conta' : !navigator.onLine ? 'Sem internet' : '';
      const m = openModal(`<div class="setup" style="--hue:${game.hue}">
        <div class="setup-head"><span class="setup-ic">${game.icon}</span><div><h2>${esc(game.name)}</h2><p class="muted">${esc(game.tagline)}</p></div></div>
        <div class="mode-grid">
          <button class="mode-card" id="m-local"><span class="mc-ic">📱</span><b>Mesmo dispositivo</b><small>${game.minPlayers}–${game.maxPlayers} jogadores · funciona offline</small></button>
          <button class="mode-card" id="m-create" ${canOnline ? '' : 'data-off="1"'}><span class="mc-ic">🌐</span><b>Criar sala online</b><small>${canOnline ? 'Convida amigos com um código' : why}</small></button>
          <div class="mode-card join ${canOnline ? '' : 'off'}"><span class="mc-ic">🔑</span><b>Entrar numa sala</b>
            <div class="join-row"><input id="m-code" maxlength="4" placeholder="CÓDIGO" autocomplete="off" ${canOnline ? '' : 'disabled'}><button class="btn btn-neon btn-sm" id="m-join" ${canOnline ? '' : 'disabled'}>Entrar</button></div>
            ${canOnline ? '' : `<small>${why}</small>`}</div>
        </div></div>`, { cls: 'modal-wide' });
      const el = m.el;
      $('#m-local', el).onclick = () => localSetup(game, m);
      $('#m-create', el).onclick = (e) => {
        if (e.currentTarget.dataset.off) { m.close(); if (!B.account) O.app.requireAccount('Entra para jogar online.'); else toast(why, { type: 'warn' }); return; }
        m.close(); createRoom(game);
      };
      const join = () => { const c = $('#m-code', el).value.trim().toUpperCase(); if (c.length === 4) { m.close(); joinRoom(c, game); } else toast('O código tem 4 letras.', { type: 'warn' }); };
      $('#m-join', el).onclick = join;
      $('#m-code', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
      $('#m-code', el).addEventListener('input', (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '')));
    },

    async joinByCode(code, gameId) {
      const g = O.games.get(gameId);
      if (!g) return;
      if (play.inGame()) return play.confirmLeave(() => play.joinByCode(code, gameId));
      joinRoom(code, g);
    },

    /* ============ Roleta Omni ============ */
    async roulette() {
      const pool = O.games.list.filter((g) => !g.soon);
      if (!pool.length) return toast('Ainda não há jogos disponíveis.');
      if (play.inGame()) return play.confirmLeave(() => play.roulette());
      const m = openModal(`<div class="roulette"><div class="rl-wheel"><div class="rl-ring"><i></i><i></i></div>
        <div class="rl-face"><div class="rl-ic" id="rl-ic">🎲</div><div class="rl-name" id="rl-name">Roleta Omni</div></div></div>
        <p class="muted">A escolher o teu próximo jogo…</p></div>`, { cls: 'modal-roulette', locked: true });
      const ic = $('#rl-ic', m.el), nm = $('#rl-name', m.el), ring = $('.rl-ring', m.el);
      const target = pool[Math.floor(Math.random() * pool.length)];
      const steps = 22 + Math.floor(Math.random() * pool.length);
      let k = Math.floor(Math.random() * pool.length);
      for (let i = 0; i < steps; i++) {
        const g = i === steps - 1 ? target : pool[k++ % pool.length];
        ic.textContent = g.icon; nm.textContent = g.name;
        ic.classList.remove('flip'); void ic.offsetWidth; ic.classList.add('flip');
        await sleep(55 + i * i * 0.55);
      }
      ring.classList.add('burst'); nm.classList.add('final');
      await sleep(900);
      m.close();
      if (target.id === 'mexicana') { window.location.href = 'mexicana.html'; return; }
      play.openSetup(target);
    }
  });

  /* ============ Mesmo dispositivo ============ */
  function localSetup(game, modal) {
    const me = B.me();
    let n = game.minPlayers;
    const saved = LS.get('localNames', []);
    const names = Array.from({ length: 6 }, (_, i) => (i === 0 ? me.display_name || me.username : saved[i] || `Jogador ${i + 1}`));
    const render = () => {
      modal.el.innerHTML = `<div class="setup" style="--hue:${game.hue}">
        <div class="setup-head"><span class="setup-ic">${game.icon}</span><div><h2>${esc(game.name)} · Mesmo dispositivo</h2><p class="muted">Passem o dispositivo — ou usem teclas/toques, conforme o jogo.</p></div></div>
        <div class="field"><span>Número de jogadores</span><div class="pills">${Array.from({ length: game.maxPlayers - game.minPlayers + 1 }, (_, i) => game.minPlayers + i)
          .map((x) => `<button class="pill ${x === n ? 'on' : ''}" data-n="${x}">${x}</button>`).join('')}</div></div>
        <div class="name-list">${Array.from({ length: n }, (_, i) => `
          <label class="name-row" style="--c:${PCOL[i]}"><i></i><input data-i="${i}" maxlength="14" value="${esc(names[i])}" placeholder="Jogador ${i + 1}"></label>`).join('')}</div>
        <div class="edit-actions"><button class="btn btn-ghost" id="ls-back">Voltar</button><button class="btn btn-neon btn-lg" id="ls-go">Começar ▸</button></div></div>`;
      $$('.pill', modal.el).forEach((b) => (b.onclick = () => { n = +b.dataset.n; render(); }));
      $$('.name-row input', modal.el).forEach((inp) => inp.addEventListener('input', () => (names[+inp.dataset.i] = inp.value)));
      $('#ls-back', modal.el).onclick = () => { modal.close(); play.openSetup(game); };
      $('#ls-go', modal.el).onclick = () => {
        LS.set('localNames', names);
        const players = names.slice(0, n).map((nm, i) => ({
          seat: i, name: nm.trim() || `Jogador ${i + 1}`, userId: i === 0 && B.user ? B.user.id : null,
          avatar: i === 0 ? me.avatar : AVATARS[(AVATARS.indexOf(me.avatar) + 4 * i + 3) % AVATARS.length], color: SEAT_HUE[i], xp: i === 0 ? me.xp : 0
        }));
        modal.close();
        startGame({ game, players, role: 'local', mySeats: players.map((p) => p.seat), room: null, token: uid(6) });
      };
    };
    render();
  }

  function startGame(opts) {
    portal(async () => { O.app.nav('game', opts); });
  }

  /* ============ Salas online ============ */
  async function createRoom(game) {
    const closeT = toast('A criar sala…', { ms: 0 });
    try {
      leaveAll();
      const room = await O.Rooms.create(game);
      wireRoom(room);
      P.room = room; P.game = game;
      await portal(async () => O.app.nav('lobby', { room, game }));
    } catch (e) { toast(e.message || 'Erro ao criar sala', { type: 'bad' }); }
    closeT();
  }

  async function joinRoom(code, game) {
    if (!O.app.requireAccount('Entra para jogar online.')) return;
    if (!B.canNet) return toast('Precisas de internet para jogar online.', { type: 'warn' });
    const closeT = toast('A entrar na sala…', { ms: 0 });
    try {
      leaveAll();
      const room = await O.Rooms.join(code, game);
      wireRoom(room);
      P.room = room; P.game = game;
      await portal(async () => O.app.nav('lobby', { room, game }));
    } catch (e) { toast(e.message || 'Não foi possível entrar', { type: 'bad' }); }
    closeT();
  }

  function wireRoom(room) {
    room.on('members', () => { if (P.room === room && P.screen === 'lobby') updateLobby(); });
    room.on('start', (p) => {
      if (P.room !== room || room.isHost) return;
      const mySeat = p.players.findIndex((x) => x.key === room.key);
      closeAllModals();
      if (mySeat < 0) { toast('A partida começou sem ti.', { type: 'warn' }); return; }
      startGame({ game: room.game, players: p.players, role: 'guest', mySeats: [mySeat], room, token: p.token });
    });
    room.on('memberleft', (p) => {
      if (P.room !== room) return;
      if (P.screen === 'game' && P.session && !P.session.finished && room.isHost) {
        toast(`<b>${esc(p.name)}</b> saiu — partida terminada.`, { type: 'warn' });
        room.send('abort', { reason: p.name });
        backToLobby();
      }
    });
    room.on('hostleft', () => {
      if (P.room !== room) return;
      toast('O anfitrião saiu da sala.', { type: 'warn' });
      closeAllModals(); leaveAll(); O.app.nav('hub');
    });
    room.on('abort', (p) => {
      if (P.room !== room) return;
      toast(`<b>${esc(p.reason || 'Um jogador')}</b> saiu — partida terminada.`, { type: 'warn' });
      closeAllModals(); backToLobby();
    });
  }

  async function backToLobby() {
    const room = P.room;
    if (!room) return;
    if (P.session) { P.session.destroy(); P.session = null; }
    if (room.isHost) await room.setPlaying(false);
    O.app.nav('lobby', { room, game: room.game });
  }

  async function hostStart() {
    const room = P.room, game = room.game;
    const ms = room.members.slice(0, game.maxPlayers);
    if (ms.length < game.minPlayers) return toast(`Precisas de pelo menos ${game.minPlayers} jogadores.`, { type: 'warn' });
    const players = ms.map((m, i) => ({ seat: i, key: m.key, userId: m.uid, name: m.name, avatar: m.avatar, color: m.color, xp: m.xp }));
    const token = uid(6);
    await room.setPlaying(true);
    room.send('start', { gameId: game.id, players, token });
    startGame({ game, players, role: 'host', mySeats: [0], room, token });
  }

  /* ============ Vista: Lobby ============ */
  O.views.lobby = {
    render(root, { room, game }) {
      P.screen = 'lobby'; P.room = room; P.game = game;
      root.innerHTML = `<section class="page lobby" style="--hue:${game.hue}">
        <div class="lobby-grid">
          <div class="glass lobby-code">
            <div class="lc-game"><span>${game.icon}</span><b>${esc(game.name)}</b></div>
            <p class="muted">Código da sala</p>
            <button class="code-big" id="lb-code" title="Copiar código">${room.code.split('').map((c) => `<i>${c}</i>`).join('')}</button>
            <small class="muted" id="lb-copy">Clica para copiar e envia aos teus amigos</small>
          </div>
          <div class="glass lobby-players"><h3>Jogadores <small id="lb-count"></small></h3><div id="lb-members" class="members"></div>
            <div class="lobby-actions" id="lb-actions"></div></div>
          <div class="glass lobby-invite"><h3>Convidar amigos</h3><div id="lb-invite"><p class="muted small">A carregar…</p></div></div>
        </div></section>`;
      $('#lb-code').onclick = async () => {
        try { await navigator.clipboard.writeText(room.code); $('#lb-copy').textContent = 'Código copiado ✓'; } catch { $('#lb-copy').textContent = 'Copia manualmente: ' + room.code; }
      };
      updateLobby(); loadInvite(room, game);
    }
  };

  function updateLobby() {
    const room = P.room, game = room.game, ms = room.members;
    const box = $('#lb-members');
    if (!box) return;
    box.innerHTML = Array.from({ length: game.maxPlayers }, (_, i) => {
      const m = ms[i];
      return m ? `<div class="member ${m.host ? 'host' : ''} ${m.key === room.key ? 'me' : ''}">${avatar(m, 46)}
          <div><b>${esc(m.name)}${m.key === room.key ? ' (tu)' : ''}</b><small>Nv ${levelInfo(m.xp || 0).level}${m.host ? ' · 👑 Anfitrião' : ''}</small></div></div>`
        : `<div class="member empty"><span class="slot">+</span><div><b>À espera de jogador…</b><small>Lugar ${i + 1}</small></div></div>`;
    }).join('');
    $('#lb-count').textContent = `${Math.min(ms.length, game.maxPlayers)}/${game.maxPlayers}`;
    const ac = $('#lb-actions'), ready = ms.length >= game.minPlayers;
    ac.innerHTML = (room.isHost
      ? `<button class="btn btn-neon btn-lg" id="lb-start" ${ready ? '' : 'disabled'}>${ready ? 'Começar ▸' : `Mínimo ${game.minPlayers} jogadores`}</button>`
      : '<div class="waiting"><i></i><i></i><i></i><span>À espera que o anfitrião comece…</span></div>') +
      '<button class="btn btn-ghost" id="lb-leave">Sair da sala</button>';
    const st = $('#lb-start'); if (st) st.onclick = hostStart;
    $('#lb-leave').onclick = () => { leaveAll(); O.app.nav('hub'); };
  }

  async function loadInvite(room, game) {
    const box = $('#lb-invite');
    try {
      const { data } = await B.getFriends();
      const render = () => {
        const b = $('#lb-invite'); if (!b) return;
        const on = data.friends.filter((f) => B.onlineIds.has(f.profile.id));
        b.innerHTML = on.length ? on.map((f) => `<div class="user-row">${avatar(f.profile, 36)}<div class="ur-main"><b>${esc(f.profile.display_name)}</b><small>🟢 online</small></div>
            <button class="btn btn-sm btn-neon" data-id="${f.profile.id}">Convidar</button></div>`).join('')
          : '<p class="muted small">Nenhum amigo online agora. Partilha o código da sala!</p>';
        $$('button[data-id]', b).forEach((x) => (x.onclick = () => { B.sendInvite(x.dataset.id, room.code, game.id); x.textContent = 'Enviado ✓'; x.disabled = true; }));
      };
      render();
      const h = () => { if (P.screen === 'lobby') render(); };
      B.on('presence', h);
    } catch { box.innerHTML = '<p class="muted small">Partilha o código com os teus amigos.</p>'; }
  }

  /* ============ Vista: Jogo ============ */
  O.views.game = {
    render(root, opts) {
      const { game, role } = opts;
      if (P.session) P.session.destroy();
      P.screen = 'game'; P.game = game; P.room = opts.room || null;
      root.innerHTML = `<section class="game-screen" style="--hue:${game.hue}">
        <div class="gs-bar"><button class="btn btn-ghost btn-sm" id="gs-exit">← Sair</button>
          <h2><span>${game.icon}</span> ${esc(game.name)}</h2>
          ${opts.room ? `<span class="room-chip">Sala ${opts.room.code}</span>` : '<span class="room-chip">📱 Mesmo dispositivo</span>'}</div>
        <div class="gs-players" id="gs-players"></div>
        <div class="gs-area glass" id="gs-area"><div class="loader"><i></i><i></i><i></i></div></div></section>`;

      const session = new O.GameSession({
        ...opts,
        onState: (s) => drawPlayers(session, s),
        onFinish: (res) => finished(session, res)
      });
      P.session = session;
      session.mount($('#gs-area'));
      drawPlayers(session, session.state);
      $('#gs-exit').onclick = () => play.confirmLeave(() => O.app.nav('hub'));
    }
  };

  function drawPlayers(session, s) {
    const box = $('#gs-players');
    if (!box) return;
    const info = s && session.game.info ? session.game.info(s) : { turn: null, scores: [] };
    box.innerHTML = session.players.map((p, i) => `
      <div class="gp ${info.turn === i ? 'turn' : ''} ${session.mySeats.length === 1 && session.mySeats[0] === i ? 'me' : ''}" style="--c:${PCOL[i]}">
        ${avatar(p, 38)}<div><b>${esc(p.name)}</b><small>${esc(info.scores[i] ?? '')}</small></div></div>`).join('');
  }

  function finished(session, res) {
    if (P.session !== session) return;
    const byseat = Object.fromEntries(res.map((r) => [r.seat, r]));
    const mySeat = session.role === 'local' ? 0 : session.mySeats[0];
    const mine = byseat[mySeat];
    const rw = REWARD[mine.result];

    if (session.role !== 'guest') B.submitMatch(session.record());
    else setTimeout(() => B.canNet && B.refreshProfile().catch(() => {}), 2500);

    const order = [...res].sort((a, b) => (a.result === 'win' ? 0 : a.result === 'draw' ? 1 : 2) - (b.result === 'win' ? 0 : b.result === 'draw' ? 1 : 2) || b.score - a.score);
    const winners = res.filter((r) => r.result === 'win');
    const title = winners.length === 1 ? `${esc(session.players[winners[0].seat].name)} venceu!` : winners.length > 1 ? 'Vitória partilhada!' : 'Empate!';
    const xpFor = session.role === 'local' ? session.players[0].name : 'Tu';
    const online = session.mode === 'online';
    const room = session.room;
    const m = openModal(`<div class="results ${mine.result}"><div class="res-burst"></div>
      <p class="eyebrow">${session.game.icon} ${esc(session.game.name)}</p><h2>${title}</h2>
      <div class="res-list">${order.map((r, i) => {
        const p = session.players[r.seat];
        return `<div class="res-row ${r.result}" style="--c:${PCOL[r.seat]}"><span class="pos">${i + 1}</span>${avatar(p, 40)}<b>${esc(p.name)}</b>
          <span class="rr-badge ${r.result}">${{ win: 'Vitória', loss: 'Derrota', draw: 'Empate' }[r.result]}</span><span class="rr-score">${r.score}</span></div>`;
      }).join('')}</div>
      <div class="reward"><span>${esc(xpFor)}</span><b>+${rw.xp} XP</b><b>+${rw.coins} 🪙</b></div>
      ${!B.account ? '<p class="muted small">Joga como convidado — <a id="rs-login">cria uma conta</a> para guardares amigos e estatísticas online.</p>' : ''}
      <div class="edit-actions">
        ${online ? '<button class="btn btn-ghost" id="rs-room">Voltar à sala</button>' : ''}
        <button class="btn btn-ghost" id="rs-exit">Sair</button>
        ${!online || room.isHost ? '<button class="btn btn-neon btn-lg" id="rs-again">Jogar outra vez</button>' : '<span class="muted small">O anfitrião pode iniciar outra ronda…</span>'}
      </div></div>`, { cls: 'modal-results', locked: true });
    const el = m.el;
    const lg = $('#rs-login', el); if (lg) lg.onclick = () => O.app.openAuth('register');
    $('#rs-exit', el).onclick = () => { m.close(); leaveAll(); O.app.nav('hub'); };
    const rr = $('#rs-room', el); if (rr) rr.onclick = () => { m.close(); backToLobby(); };
    const ag = $('#rs-again', el);
    if (ag) ag.onclick = async () => {
      m.close();
      const token = uid(6);
      if (online) { await room.setPlaying(true); room.send('start', { gameId: session.game.id, players: session.players, token }); }
      startGame({ game: session.game, players: session.players, role: session.role, mySeats: session.mySeats, room, token });
    };
  }
})(window.Omni);
