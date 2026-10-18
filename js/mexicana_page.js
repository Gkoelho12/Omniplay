/* OmniPlay · Controlador dedicado da página mexicana.html (Online & Local) */
(function (O) {
  const { $, $$, esc, avatar, toast, openModal, closeAllModals, sleep, uid, LS, PCOL, AVATARS, REWARD, levelInfo } = O.util;
  const B = O.Backend;
  const SEAT_HUE = [190, 330, 48, 265, 160, 28];

  let currentSession = null;
  let currentRoom = null;
  let currentScreen = 'setup'; // 'setup' | 'lobby' | 'game'

  /* ============ Fundo animado de estrelas ============ */
  function startBackground() {
    const cv = $('#bg');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W, H, stars = [];
    const resize = () => {
      W = cv.width = innerWidth; H = cv.height = innerHeight;
      stars = Array.from({ length: Math.round((W * H) / 9000) }, () => ({
        x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.9 + 0.1,
        h: [190, 265, 28, 330][Math.floor(Math.random() * 4)], tw: Math.random() * 6
      }));
    };
    resize(); window.addEventListener('resize', resize);
    let t = 0;
    (function frame() {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        s.x -= s.z * 0.12; if (s.x < 0) s.x = W;
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t * s.z + s.tw));
        ctx.fillStyle = `hsla(${s.h},90%,75%,${a * s.z})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.z * 1.5, 0, 6.283); ctx.fill();
      }
      if (!reduce) requestAnimationFrame(frame);
    })();
  }

  /* ============ Modal de Regras ============ */
  function openRules() {
    openModal(`<div class="mx-rules"><h2>🃏 Regras da Mexicana</h2>
      <ul>
        <li><b>Objetivo:</b> ficar sem cartas (mão, à vista e viradas para baixo). O baralho tem 52 cartas + 4 jokers (56 cartas no total).</li>
        <li><b>Início:</b> recebes 3 cartas viradas para baixo e 6 na mão. Escolhes 3 das 6 cartas para ficarem viradas para cima na mesa por cima das secretas. Começa quem tiver a carta mais baixa sem poderes (4, 5, 6...). Se houver empate, quem jogar primeiro começa!</li>
        <li><b>Mão (mínimo 3 cartas):</b> tens sempre pelo menos 3 cartas na mão até o baralho de compra acabar. Se jogares uma carta e a que comprares do baralho for igual ou um 3, podes jogá-la logo por cima, tendo de comprar outra a seguir para repor a mão.</li>
        <li><b>Ordem crescente:</b> 4, 5, 6, 7, 8, 9, J, Q, K, A · <b>2, 3, 10 e Joker</b> podem ser jogados por cima de qualquer carta.</li>
        <li><b>2 ↺ (Reinicia):</b> reseta o ciclo — o próximo jogador pode jogar um 4 ou qualquer outra carta.</li>
        <li><b>3 🪞 (Espelho):</b> copia o valor da carta anterior. Se jogado sem nada por baixo ou após um 2, vale apenas 3 (podendo jogar um 4 por cima). O 3 não conta para limpar os 4 naipes.</li>
        <li><b>7 ↕ (Cima ou Baixo):</b> só pode ser jogado sobre 4, 5, 6, 7 ou 2. Quem o joga escolhe se o próximo joga acima ou abaixo de 7.</li>
        <li><b>8 ⛔ (Bloqueio):</b> bloqueia o próximo jogador. Jogar dois 8s ou combinar com 3s bloqueia os jogadores seguintes sucessivamente.</li>
        <li><b>10 e Joker 🧹 (Limpeza):</b> descartam e eliminam todo o monte do centro fora do jogo. Quem limpa joga novamente. Se jogados com um 3, o 3 também é descartado.</li>
        <li><b>4 Cartas Iguais Seguidas:</b> 4 cartas consecutivas do mesmo valor (os 4 naipes) limpam e descartam o monte da mesa, e o jogador joga de novo.</li>
        <li><b>Pegar cartas do meio:</b> se não conseguires (ou não quiseres) responder, podes pegar em todas as cartas do centro da mesa.</li>
        <li><b>Fim do baralho:</b> quando o baralho de compra esgota e ficas sem cartas na mão, recolhes as tuas 3 cartas viradas para cima para a mão. Por fim, jogas as cartas viradas para baixo uma a uma às cegas.</li>
      </ul></div>`, { cls: 'modal-wide' });
  }

  /* ============ Login / Criar Conta Modal ============ */
  function openAuth(tab = 'login', cb) {
    let avIdx = Math.floor(Math.random() * AVATARS.length);
    let hue = Math.floor(Math.random() * 360);
    const savedAccounts = B.getSavedAccounts ? B.getSavedAccounts() : [];

    const savedHtml = savedAccounts.length
      ? `<div class="auth-saved-box">
          <span class="auth-saved-label">Contas neste dispositivo:</span>
          <div class="auth-saved-list">
            ${savedAccounts.map((a) => `
              <button type="button" class="auth-acc-chip" data-u="${esc(a.username)}">
                <span class="acc-chip-av">${esc(a.avatar)}</span>
                <b>@${esc(a.username)}</b>
              </button>`).join('')}
          </div>
        </div>`
      : '';

    const m = openModal(`
      <div class="auth">
        <div class="auth-head">
          <div class="auth-logo-aura">
            <span style="font-size:2.4rem;">🃏</span>
          </div>
          <h2>Conta OmniPlay</h2>
          <p class="muted">Entra para jogar Mexicana online com os teus amigos</p>
        </div>
        ${savedHtml}
        <div class="tabs">
          <button class="tab ${tab === 'login' ? 'active' : ''}" data-t="login">Entrar</button>
          <button class="tab ${tab === 'register' ? 'active' : ''}" data-t="register">Criar conta</button>
        </div>
        <form class="auth-form" id="au-form" autocomplete="on">
          <label class="field">
            <span>Username</span>
            <input id="au-user" maxlength="16" placeholder="ex: alex_gamer" required autocomplete="username">
          </label>
          <label class="field">
            <span>Password</span>
            <div class="pass-wrap">
              <input id="au-pass" type="password" maxlength="32" placeholder="••••••••" required autocomplete="current-password">
              <button type="button" class="btn-eye" id="au-eye" aria-label="Mostrar password">👁️</button>
            </div>
          </label>
          <div id="au-reg-fields" style="display:${tab === 'register' ? 'block' : 'none'}">
            <label class="field">
              <span>Nome a mostrar</span>
              <input id="au-name" maxlength="20" placeholder="O teu nome de jogador" autocomplete="nickname">
            </label>
            <div class="field">
              <span>Escolhe o teu avatar</span>
              <div class="av-pick">
                ${AVATARS.map((a, i) => `<button type="button" class="av-opt ${i === avIdx ? 'sel' : ''}" data-i="${i}">${a}</button>`).join('')}
              </div>
            </div>
            <label class="field">
              <span>Cor do tema</span>
              <input id="au-hue" type="range" min="0" max="360" value="${hue}" class="hue-range">
            </label>
          </div>
          <div class="form-err" id="au-err"></div>
          <button class="btn btn-neon btn-lg auth-submit-btn" id="au-submit" type="submit">
            ${tab === 'login' ? 'Entrar no OmniPlay 🚀' : 'Criar Conta 🎉'}
          </button>
        </form>
      </div>`, { cls: 'modal-auth' });

    const el = m.el;
    let mode = tab;

    const setTab = (t) => {
      mode = t;
      $$('.tab', el).forEach((b) => b.classList.toggle('active', b.dataset.t === t));
      const regFields = $('#au-reg-fields', el);
      if (regFields) regFields.style.display = t === 'register' ? '' : 'none';
      $('#au-submit', el).textContent = t === 'login' ? 'Entrar no OmniPlay 🚀' : 'Criar Conta 🎉';
      $('#au-pass', el).autocomplete = t === 'login' ? 'current-password' : 'new-password';
      $('#au-err', el).textContent = '';
    };

    $$('.tab', el).forEach((b) => b.addEventListener('click', () => setTab(b.dataset.t)));

    let showPass = false;
    $('#au-eye', el).onclick = () => {
      showPass = !showPass;
      $('#au-pass', el).type = showPass ? 'text' : 'password';
      $('#au-eye', el).textContent = showPass ? '🔒' : '👁️';
    };

    $$('.av-opt', el).forEach((b) => (b.onclick = () => {
      $$('.av-opt', el).forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      avIdx = +b.dataset.i;
    }));

    $$('.auth-acc-chip', el).forEach((btn) => (btn.onclick = () => {
      const u = btn.dataset.u;
      $('#au-user', el).value = u;
      setTab('login');
      $('#au-pass', el).focus();
    }));

    $('#au-form', el).onsubmit = async (e) => {
      e.preventDefault();
      const u = $('#au-user', el).value.trim(), p = $('#au-pass', el).value;
      const btn = $('#au-submit', el);
      btn.disabled = true;
      btn.textContent = 'A processar…';
      try {
        if (mode === 'login') {
          await B.signIn(u, p);
          toast(`Bem-vindo, <b>${esc(u)}</b>!`, { type: 'good' });
        } else {
          const dn = $('#au-name', el).value.trim() || u;
          await B.signUp(u, p, dn, AVATARS[avIdx], hue);
          toast(`Conta criada com sucesso! Olá, <b>${esc(dn)}</b>!`, { type: 'good' });
        }
        m.close();
        renderUserPill();
        if (cb) cb();
        else if (currentScreen === 'setup') renderSetup();
      } catch (err) {
        $('#au-err', el).textContent = err.message || 'Erro na autenticação';
        btn.disabled = false;
        btn.textContent = mode === 'login' ? 'Entrar no OmniPlay 🚀' : 'Criar Conta 🎉';
      }
    };
  }

  function renderUserPill() {
    const up = $('#mx-user-pill');
    if (!up) return;
    const me = B.me();
    up.innerHTML = `${avatar(me, 26)} <span class="mx-user-name">${esc(me.display_name || me.username)}</span>`;
    up.onclick = () => {
      if (!B.account) openAuth('login');
      else toast(`Sessão iniciada como <b>@${esc(me.username)}</b>`, { type: 'good' });
    };
  }

  /* ============ Limpar Salas / Partidas ============ */
  function leaveAll() {
    if (currentSession) { currentSession.destroy(); currentSession = null; }
    if (currentRoom) { currentRoom.close(); currentRoom = null; }
    currentScreen = 'setup';
  }

  function confirmExit(cb) {
    if (currentScreen === 'setup' || (currentSession && currentSession.finished)) {
      leaveAll();
      if (cb) cb(); else window.location.href = 'index.html';
      return;
    }
    const isOnline = !!currentRoom;
    const m = openModal(`<div class="confirm">
      <h2>${currentScreen === 'lobby' ? 'Sair da sala?' : 'Sair da partida?'}</h2>
      <p class="muted">${isOnline && currentScreen === 'game' ? 'Os outros jogadores serão avisados e a partida termina.' : 'Vais perder o progresso atual.'}</p>
      <div class="edit-actions" style="margin-top: 18px;">
        <button class="btn btn-ghost" id="cf-stay" type="button">Ficar</button>
        <button class="btn btn-neon danger-btn" id="cf-leave" type="button">Sair</button>
      </div>
    </div>`);
    $('#cf-stay', m.el).onclick = () => m.close();
    $('#cf-leave', m.el).onclick = () => {
      m.close();
      leaveAll();
      if (cb) cb(); else renderSetup();
    };
  }

  /* ============ Ecrã Principal: Escolha de Modo (Online / Local) ============ */
  function renderSetup(activeTab = 'online') {
    leaveAll();
    currentScreen = 'setup';
    const root = $('#game-root');
    const me = B.me();
    const canOnline = B.configured && navigator.onLine;

    const saved = LS.get('localNames', []);
    let localN = 2;
    const names = Array.from({ length: 6 }, (_, i) => (i === 0 ? me.display_name || me.username : saved[i] || `Jogador ${i + 1}`));
    let onlineMaxPlayers = 4;

    function draw() {
      root.innerHTML = `
        <div class="mx-setup-container glass" style="--hue:330">
          <div class="setup-head">
            <span class="setup-ic big">🃏</span>
            <div>
              <h2>Mexicana</h2>
              <p class="muted">2 a 6 jogadores · 56 cartas (com 4 Jokers) · poderes especiais e regras completas</p>
            </div>
          </div>

          <!-- Seletor de Modo (Abas) -->
          <div class="tabs mb-12">
            <button class="tab ${activeTab === 'online' ? 'active' : ''}" data-t="online">🌐 Jogar Online</button>
            <button class="tab ${activeTab === 'local' ? 'active' : ''}" data-t="local">📱 Mesmo Dispositivo</button>
          </div>

          <!-- Conteúdo Aba 1: Jogar Online -->
          <div id="tab-pane-online" style="display:${activeTab === 'online' ? 'block' : 'none'};">
            ${!B.account ? `
              <div class="glass pad text-center mb-16" style="border-radius:18px;background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.3);">
                <span style="font-size:2rem;display:block;margin-bottom:6px;">🔑</span>
                <b>Entra na tua conta para jogar online</b>
                <p class="muted small mb-12">Ganha XP, compete no ranking e desafia os teus amigos à distância.</p>
                <button class="btn btn-neon" id="btn-setup-login" type="button">Entrar / Criar Conta Grátis</button>
              </div>` : ''}

            <div class="mode-grid mb-16">
              <!-- Criar Sala -->
              <div class="mode-card glass">
                <span class="mc-ic">🚀</span>
                <b>Criar Sala Online</b>
                <small class="muted mb-10">Cria uma sala privada e partilha o código com quem quiseres.</small>
                
                <div class="field mb-12">
                  <span style="font-size:0.8rem;">Limite de jogadores na sala:</span>
                  <div class="pills">
                    ${[2, 3, 4, 5, 6].map((x) => `<button type="button" class="pill ${x === onlineMaxPlayers ? 'on' : ''}" data-max="${x}">${x}</button>`).join('')}
                  </div>
                </div>

                <button class="btn btn-neon w-full" id="btn-create-room" type="button">Criar Nova Sala 🎲</button>
              </div>

              <!-- Entrar com Código -->
              <div class="mode-card glass join">
                <span class="mc-ic">🔑</span>
                <b>Entrar numa Sala</b>
                <small class="muted mb-12">Tens o código de 4 letras de um amigo?</small>
                <div class="join-row">
                  <input id="join-code-input" maxlength="4" placeholder="CÓDIGO" autocomplete="off" style="text-transform:uppercase;">
                  <button class="btn btn-neon btn-sm" id="btn-join-code" type="button">Entrar ▸</button>
                </div>
              </div>
            </div>

            <!-- Secção: Amigos Online para Desafiar -->
            <div class="glass pad" style="border-radius:18px;">
              <h3 style="font-size:1.05rem;margin-bottom:6px;">👥 Desafiar Amigos Online</h3>
              <p class="muted small mb-12">Convida amigos diretamente para uma sala de Mexicana.</p>
              <div id="mx-friends-invite-list"><div class="loader"><i></i><i></i><i></i></div></div>
            </div>
          </div>

          <!-- Conteúdo Aba 2: Mesmo Dispositivo (Local) -->
          <div id="tab-pane-local" style="display:${activeTab === 'local' ? 'block' : 'none'};">
            <div class="field">
              <span>Número de jogadores</span>
              <div class="pills">
                ${[2, 3, 4, 5, 6].map((x) => `<button type="button" class="pill ${x === localN ? 'on' : ''}" data-localn="${x}">${x} Jogadores</button>`).join('')}
              </div>
            </div>

            <div class="field">
              <span>Nomes dos jogadores</span>
              <div class="name-list">
                ${Array.from({ length: localN }, (_, i) => `
                  <label class="name-row" style="--c:${PCOL[i]}">
                    <i></i>
                    <input data-i="${i}" maxlength="14" value="${esc(names[i])}" placeholder="Jogador ${i + 1}">
                  </label>`).join('')}
              </div>
            </div>

            <div class="edit-actions" style="margin-top: 18px;">
              <button class="btn btn-neon btn-lg w-full" id="btn-start-local" type="button">Começar Partida Local ▸</button>
            </div>
          </div>
        </div>`;

      // Tabs wiring
      $$('.tab', root).forEach((btn) => (btn.onclick = () => {
        activeTab = btn.dataset.t;
        draw();
      }));

      // Login CTA
      $('#btn-setup-login', root)?.addEventListener('click', () => openAuth('login'));

      // Criar sala online
      $$('.pill[data-max]', root).forEach((b) => (b.onclick = () => {
        onlineMaxPlayers = +b.dataset.max;
        draw();
      }));

      $('#btn-create-room', root)?.addEventListener('click', () => {
        if (!B.account) {
          openAuth('login', () => createOnlineRoom(onlineMaxPlayers));
          return;
        }
        createOnlineRoom(onlineMaxPlayers);
      });

      // Entrar por código
      const joinInput = $('#join-code-input', root);
      const joinBtn = $('#btn-join-code', root);
      const doJoin = () => {
        const c = (joinInput?.value || '').trim().toUpperCase();
        if (c.length !== 4) { toast('O código da sala deve ter 4 letras.', { type: 'warn' }); return; }
        if (!B.account) {
          openAuth('login', () => joinOnlineRoom(c));
          return;
        }
        joinOnlineRoom(c);
      };
      if (joinBtn) joinBtn.onclick = doJoin;
      if (joinInput) {
        joinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
        joinInput.addEventListener('input', (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '')));
      }

      // Local mode wiring
      $$('.pill[data-localn]', root).forEach((b) => (b.onclick = () => {
        localN = +b.dataset.localn;
        draw();
      }));
      $$('.name-row input', root).forEach((inp) => inp.addEventListener('input', () => (names[+inp.dataset.i] = inp.value)));
      $('#btn-start-local', root)?.addEventListener('click', () => {
        LS.set('localNames', names);
        const game = O.games.get('mexicana');
        const players = names.slice(0, localN).map((nm, i) => ({
          seat: i, name: nm.trim() || `Jogador ${i + 1}`,
          userId: i === 0 && B.user ? B.user.id : null,
          avatar: i === 0 ? me.avatar : AVATARS[(AVATARS.indexOf(me.avatar) + 4 * i + 3) % AVATARS.length],
          color: SEAT_HUE[i],
          xp: i === 0 ? me.xp : 0
        }));
        launchLocalGame(game, players);
      });

      // Carregar amigos na secção online
      loadOnlineFriendsList();
    }

    draw();
  }

  /* ============ Carregar Amigos Online para Desafiar ============ */
  async function loadOnlineFriendsList() {
    const box = $('#mx-friends-invite-list');
    if (!box) return;
    try {
      const { data } = await B.getFriends();
      const friends = data.friends || [];
      if (!friends.length) {
        box.innerHTML = `<p class="muted small text-center pad-8">Ainda não tens amigos adicionados. <a href="amigos.html" style="color:var(--cyan);text-decoration:underline;">Adicionar amigos</a></p>`;
        return;
      }
      box.innerHTML = friends.map((f) => {
        const isOnline = B.onlineIds.has(f.profile.id);
        return `
          <div class="user-search-row glass mb-8" style="padding:10px 14px;">
            <div class="usr-avatar">${avatar(f.profile, 40)}</div>
            <div class="usr-info">
              <b>${esc(f.profile.display_name || f.profile.username)}</b>
              <small class="muted">@${esc(f.profile.username)} · ${isOnline ? '<span style="color:#34d399;">🟢 Online</span>' : 'Offline'}</small>
            </div>
            <div class="usr-actions">
              <button class="btn btn-sm btn-neon" data-act="challenge-friend" data-id="${f.profile.id}" data-u="${esc(f.profile.username)}" data-name="${esc(f.profile.display_name || f.profile.username)}">
                ⚔️ Desafiar
              </button>
            </div>
          </div>`;
      }).join('');

      $$('[data-act=challenge-friend]', box).forEach((btn) => (btn.onclick = async () => {
        if (!B.account) {
          openAuth('login');
          return;
        }
        btn.disabled = true;
        btn.textContent = 'A criar sala…';
        try {
          const room = await createOnlineRoom(4);
          B.sendInvite(btn.dataset.id, room.code, 'mexicana');
          toast(`Convite enviado a <b>${btn.dataset.name}</b>!`, { type: 'good' });
        } catch (e) {
          toast(e.message, { type: 'bad' });
          btn.disabled = false;
          btn.textContent = '⚔️ Desafiar';
        }
      }));
    } catch {
      box.innerHTML = `<p class="muted small text-center">Partilha o código da sala com amigos para jogarem juntos.</p>`;
    }
  }

  /* ============ Criar Sala Online ============ */
  async function createOnlineRoom(maxPlayers = 4) {
    const game = O.games.get('mexicana');
    const closeT = toast('A criar sala online…', { ms: 0 });
    try {
      leaveAll();
      const room = await O.Rooms.create(game, maxPlayers);
      room.maxPlayers = maxPlayers;
      currentRoom = room;
      wireRoom(room);
      renderLobby(room, game);
      closeT();
      return room;
    } catch (e) {
      closeT();
      toast(e.message || 'Erro ao criar sala online.', { type: 'bad' });
      throw e;
    }
  }

  /* ============ Entrar numa Sala Online ============ */
  async function joinOnlineRoom(code) {
    const game = O.games.get('mexicana');
    const closeT = toast(`A entrar na sala ${code}…`, { ms: 0 });
    try {
      leaveAll();
      const room = await O.Rooms.join(code, game);
      currentRoom = room;
      wireRoom(room);
      renderLobby(room, game);
      closeT();
      return room;
    } catch (e) {
      closeT();
      toast(e.message || 'Não foi possível entrar na sala.', { type: 'bad' });
    }
  }

  /* ============ Ligar Eventos da Sala Online ============ */
  function wireRoom(room) {
    room.on('members', () => {
      if (currentRoom === room && currentScreen === 'lobby') updateLobbyView();
    });

    room.on('start', (p) => {
      if (currentRoom !== room || room.isHost) return;
      const mySeat = p.players.findIndex((x) => x.key === room.key);
      closeAllModals();
      if (mySeat < 0) {
        toast('A partida começou sem ti.', { type: 'warn' });
        return;
      }
      launchOnlineGame({
        game: room.game,
        players: p.players,
        role: 'guest',
        mySeat,
        room,
        token: p.token
      });
    });

    room.on('memberleft', (p) => {
      if (currentRoom !== room) return;
      if (currentScreen === 'game' && currentSession && !currentSession.finished && room.isHost) {
        toast(`<b>${esc(p.name)}</b> saiu da partida.`, { type: 'warn' });
        room.send('abort', { reason: p.name });
        backToLobby();
      }
    });

    room.on('hostleft', () => {
      if (currentRoom !== room) return;
      toast('O anfitrião fechou a sala.', { type: 'warn' });
      closeAllModals();
      leaveAll();
      renderSetup();
    });

    room.on('abort', (p) => {
      if (currentRoom !== room) return;
      toast(`<b>${esc(p.reason || 'Um jogador')}</b> saiu — partida terminada.`, { type: 'warn' });
      closeAllModals();
      backToLobby();
    });
  }

  async function backToLobby() {
    if (!currentRoom) return;
    if (currentSession) { currentSession.destroy(); currentSession = null; }
    if (currentRoom.isHost) await currentRoom.setPlaying(false);
    renderLobby(currentRoom, currentRoom.game);
  }

  /* ============ Ecrã: Lobby de Espera da Sala Online ============ */
  function renderLobby(room, game) {
    currentScreen = 'lobby';
    currentRoom = room;
    const root = $('#game-root');
    const shareUrl = `${location.origin}/mexicana.html?room=${room.code}`;

    root.innerHTML = `
      <section class="page lobby" style="--hue:330">
        <div class="lobby-grid">
          <!-- Coluna 1: Cartão com o Código da Sala -->
          <div class="glass lobby-code">
            <div class="lc-game"><span>🃏</span><b>Mexicana Online</b></div>
            <p class="muted small">Código da tua sala</p>
            <button class="code-big" id="lb-code" title="Clica para copiar o código">
              ${room.code.split('').map((c) => `<i>${c}</i>`).join('')}
            </button>
            <small class="muted" id="lb-copy">Clica para copiar o código</small>

            <div class="share-box mt-12" style="display:flex;flex-direction:column;gap:8px;">
              <button class="btn btn-sm btn-neon w-full" id="btn-copy-room-link" type="button">🔗 Copiar Link de Partilha</button>
              ${navigator.share ? '<button class="btn btn-sm btn-ghost w-full" id="btn-share-room-nat" type="button">📲 Partilhar Sala</button>' : ''}
            </div>
          </div>

          <!-- Coluna 2: Jogadores na Sala -->
          <div class="glass lobby-players">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <h3>Jogadores <small id="lb-count"></small></h3>
              <span class="room-chip">Sala Privada</span>
            </div>
            <div id="lb-members" class="members"></div>
            <div class="lobby-actions" id="lb-actions"></div>
          </div>

          <!-- Coluna 3: Convidar Amigos Online -->
          <div class="glass lobby-invite">
            <h3>👥 Convidar Amigos Online</h3>
            <div id="lb-invite"><div class="loader"><i></i><i></i><i></i></div></div>
          </div>
        </div>
      </section>`;

    // Copiar Código
    $('#lb-code').onclick = async () => {
      try {
        await navigator.clipboard.writeText(room.code);
        $('#lb-copy').textContent = 'Código copiado ✓';
        toast('Código copiado para a área de transferência! 📋', { type: 'good' });
        setTimeout(() => { if ($('#lb-copy')) $('#lb-copy').textContent = 'Clica para copiar o código'; }, 2500);
      } catch {
        toast(`Código: ${room.code}`, { type: 'good' });
      }
    };

    // Copiar Link
    $('#btn-copy-room-link').onclick = async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast('Link da sala copiado! Envia aos teus amigos para entrarem diretamente. 🎉', { type: 'good' });
      } catch {
        prompt('Copia o link da sala:', shareUrl);
      }
    };

    // Partilha Nativa
    const natBtn = $('#btn-share-room-nat');
    if (natBtn) {
      natBtn.onclick = async () => {
        try {
          await navigator.share({
            title: 'Joga Mexicana comigo no OmniPlay!',
            text: `Entra na minha sala de Mexicana (${room.code}) no OmniPlay!`,
            url: shareUrl
          });
        } catch { /* cancel */ }
      };
    }

    updateLobbyView();
    loadLobbyInvites(room);
  }

  function updateLobbyView() {
    const room = currentRoom;
    if (!room || currentScreen !== 'lobby') return;
    const game = room.game;
    const max = room.maxPlayers || game.maxPlayers;
    const ms = room.members;
    const box = $('#lb-members');
    if (!box) return;

    box.innerHTML = Array.from({ length: max }, (_, i) => {
      const m = ms[i];
      return m
        ? `<div class="member ${m.host ? 'host' : ''} ${m.key === room.key ? 'me' : ''}">
            ${avatar(m, 46)}
            <div>
              <b>${esc(m.name)}${m.key === room.key ? ' (tu)' : ''}</b>
              <small>Nv ${levelInfo(m.xp || 0).level}${m.host ? ' · 👑 Anfitrião' : ''}</small>
            </div>
          </div>`
        : `<div class="member empty">
            <span class="slot">+</span>
            <div><b>À espera de jogador…</b><small>Lugar ${i + 1}</small></div>
          </div>`;
    }).join('');

    $('#lb-count').textContent = `${Math.min(ms.length, max)}/${max}`;

    const ac = $('#lb-actions');
    const ready = ms.length >= game.minPlayers;

    ac.innerHTML = (room.isHost
      ? `<button class="btn btn-neon btn-lg" id="lb-start" ${ready ? '' : 'disabled'}>
          ${ready ? `Começar Partida (${ms.length} jogadores) ▸` : `Mínimo ${game.minPlayers} jogadores para começar`}
        </button>`
      : `<div class="waiting"><i></i><i></i><i></i><span>À espera que o anfitrião comece a partida…</span></div>`) +
      `<button class="btn btn-ghost" id="lb-leave">Sair da sala</button>`;

    const startBtn = $('#lb-start');
    if (startBtn) startBtn.onclick = () => hostStartGame(room);

    $('#lb-leave').onclick = () => {
      confirmExit(() => renderSetup());
    };
  }

  async function loadLobbyInvites(room) {
    const box = $('#lb-invite');
    if (!box) return;
    try {
      const { data } = await B.getFriends();
      const friends = data.friends || [];
      const on = friends.filter((f) => B.onlineIds.has(f.profile.id));

      const render = () => {
        const b = $('#lb-invite');
        if (!b) return;
        b.innerHTML = on.length
          ? on.map((f) => `
              <div class="user-search-row glass mb-8" style="padding:8px 12px;">
                <div class="usr-avatar">${avatar(f.profile, 36)}</div>
                <div class="usr-info">
                  <b>${esc(f.profile.display_name)}</b>
                  <small style="color:#34d399;">🟢 online</small>
                </div>
                <div class="usr-actions">
                  <button class="btn btn-sm btn-neon" data-inv-id="${f.profile.id}">Convidar</button>
                </div>
              </div>`).join('')
          : `<p class="muted small">Nenhum amigo online neste momento. Partilha o código ou o link da sala acima!</p>`;

        $$('[data-inv-id]', b).forEach((btn) => (btn.onclick = () => {
          B.sendInvite(btn.dataset.invId, room.code, 'mexicana');
          btn.textContent = 'Enviado ✓';
          btn.disabled = true;
          toast('Convite enviado!', { type: 'good' });
        }));
      };

      render();
      B.on('presence', () => { if (currentScreen === 'lobby') render(); });
    } catch {
      box.innerHTML = `<p class="muted small">Partilha o código da sala com amigos.</p>`;
    }
  }

  /* ============ Anfitrião Começa a Partida ============ */
  async function hostStartGame(room) {
    const game = room.game;
    const max = room.maxPlayers || game.maxPlayers;
    const ms = room.members.slice(0, max);
    if (ms.length < game.minPlayers) {
      toast(`Precisas de pelo menos ${game.minPlayers} jogadores para jogar.`, { type: 'warn' });
      return;
    }

    const players = ms.map((m, i) => ({
      seat: i,
      key: m.key,
      userId: m.uid,
      name: m.name,
      avatar: m.avatar,
      color: m.color,
      xp: m.xp
    }));

    const token = uid(6);
    await room.setPlaying(true);
    room.send('start', { gameId: game.id, players, token });

    launchOnlineGame({
      game,
      players,
      role: 'host',
      mySeat: 0,
      room,
      token
    });
  }

  /* ============ Ecrã e Sessão de Jogo Online ============ */
  function launchOnlineGame(opts) {
    if (currentSession) currentSession.destroy();
    currentScreen = 'game';
    const { game, players, role, mySeat, room, token } = opts;
    const root = $('#game-root');

    root.innerHTML = `
      <section class="game-screen" style="--hue:330">
        <div class="gs-bar">
          <button class="btn btn-ghost btn-sm" id="gs-exit" type="button">← Sair</button>
          <h2><span>🃏</span> Mexicana</h2>
          <span class="room-chip">🌐 Sala ${esc(room.code)} · Online</span>
        </div>
        <div class="gs-players" id="gs-players"></div>
        <div class="gs-area glass" id="gs-area">
          <div class="loader"><i></i><i></i><i></i></div>
        </div>
      </section>`;

    const session = new O.GameSession({
      game,
      players,
      role,
      mySeats: [mySeat],
      room,
      token,
      onState: (s) => drawPlayers(session, s),
      onFinish: (res) => handleFinish(session, res)
    });

    currentSession = session;
    session.mount($('#gs-area'));
    drawPlayers(session, session.state);

    $('#gs-exit').onclick = () => {
      confirmExit(() => backToLobby());
    };
  }

  /* ============ Iniciar Partida Local (Mesmo Dispositivo) ============ */
  function launchLocalGame(game, players) {
    if (currentSession) currentSession.destroy();
    currentScreen = 'game';
    const root = $('#game-root');

    root.innerHTML = `
      <section class="game-screen" style="--hue:330">
        <div class="gs-bar">
          <button class="btn btn-ghost btn-sm" id="gs-exit" type="button">← Sair</button>
          <h2><span>🃏</span> Mexicana</h2>
          <span class="room-chip">📱 Mesmo dispositivo (${players.length} jogadores)</span>
        </div>
        <div class="gs-players" id="gs-players"></div>
        <div class="gs-area glass" id="gs-area">
          <div class="loader"><i></i><i></i><i></i></div>
        </div>
      </section>`;

    const session = new O.GameSession({
      game,
      players,
      role: 'local',
      mySeats: players.map((p) => p.seat),
      room: null,
      token: uid(6),
      onState: (s) => drawPlayers(session, s),
      onFinish: (res) => handleFinish(session, res)
    });

    currentSession = session;
    session.mount($('#gs-area'));
    drawPlayers(session, session.state);

    $('#gs-exit').onclick = () => {
      confirmExit(() => renderSetup('local'));
    };
  }

  /* ============ Barra de Jogadores no Topo da Mesa ============ */
  function drawPlayers(session, s) {
    const box = $('#gs-players');
    if (!box) return;
    const info = s && session.game.info ? session.game.info(s) : { turn: null, scores: [] };
    box.innerHTML = session.players.map((p, i) => `
      <div class="gp ${info.turn === i ? 'turn' : ''} ${session.mySeats.length === 1 && session.mySeats[0] === i ? 'me' : ''}" style="--c:${PCOL[i]}">
        ${avatar(p, 38)}
        <div>
          <b>${esc(p.name)}</b>
          <small>${esc(info.scores[i] ?? '')}</small>
        </div>
      </div>`).join('');
  }

  /* ============ Fim de Partida & Resultados ============ */
  function handleFinish(session, res) {
    if (currentSession !== session) return;
    const byseat = Object.fromEntries(res.map((r) => [r.seat, r]));
    const mySeat = session.role === 'local' ? 0 : session.mySeats[0];
    const mine = byseat[mySeat];
    const rw = REWARD[mine ? mine.result : 'loss'] || REWARD.loss;

    // Anfitrião grava a partida no Supabase:
    if (session.role !== 'guest') {
      B.submitMatch(session.record());
    } else {
      setTimeout(() => B.canNet && B.refreshProfile().catch(() => {}), 2500);
    }

    const order = [...res].sort((a, b) => (a.result === 'win' ? 0 : a.result === 'draw' ? 1 : 2) - (b.result === 'win' ? 0 : b.result === 'draw' ? 1 : 2) || b.score - a.score);
    const winners = res.filter((r) => r.result === 'win');
    const title = winners.length === 1 ? `${esc(session.players[winners[0].seat].name)} venceu!` : winners.length > 1 ? 'Vitória partilhada!' : 'Empate!';
    const xpFor = session.role === 'local' ? session.players[0].name : 'Tu';
    const isOnline = session.mode === 'online';
    const room = session.room;

    const m = openModal(`<div class="results ${mine ? mine.result : 'loss'}">
      <div class="res-burst"></div>
      <p class="eyebrow">🃏 Mexicana ${isOnline ? 'Online' : ''}</p>
      <h2>${title}</h2>
      <div class="res-list">${order.map((r, i) => {
        const p = session.players[r.seat];
        return `<div class="res-row ${r.result}" style="--c:${PCOL[r.seat]}">
          <span class="pos">${i + 1}</span>
          ${avatar(p, 40)}
          <b>${esc(p.name)}</b>
          <span class="rr-badge ${r.result}">${{ win: 'Vitória', loss: 'Derrota', draw: 'Empate' }[r.result]}</span>
          <span class="rr-score">${r.score} cartas</span>
        </div>`;
      }).join('')}</div>
      <div class="reward">
        <span>${esc(xpFor)}</span>
        <b>+${rw.xp} XP</b>
        <b>+${rw.coins} 🪙</b>
      </div>
      <div class="edit-actions" style="margin-top: 20px;">
        ${isOnline ? '<button class="btn btn-ghost" id="rs-room" type="button">Voltar ao Lobby da Sala</button>' : ''}
        ${!isOnline || room?.isHost ? '<button class="btn btn-neon btn-lg" id="rs-again" type="button">Jogar Outra Vez 🚀</button>' : '<span class="muted small">O anfitrião pode iniciar nova ronda…</span>'}
        <button class="btn btn-ghost" id="rs-exit" type="button">Sair para o Menu</button>
      </div>
    </div>`, { cls: 'modal-results', locked: true });

    const el = m.el;
    $('#rs-exit', el).onclick = () => {
      m.close();
      leaveAll();
      renderSetup();
    };

    const roomBtn = $('#rs-room', el);
    if (roomBtn) {
      roomBtn.onclick = () => {
        m.close();
        backToLobby();
      };
    }

    const againBtn = $('#rs-again', el);
    if (againBtn) {
      againBtn.onclick = async () => {
        m.close();
        if (isOnline) {
          const token = uid(6);
          await room.setPlaying(true);
          room.send('start', { gameId: session.game.id, players: session.players, token });
          launchOnlineGame({
            game: session.game,
            players: session.players,
            role: session.role,
            mySeat: session.mySeats[0],
            room,
            token
          });
        } else {
          launchLocalGame(session.game, session.players);
        }
      };
    }
  }

  /* ============ Inicialização da Página ============ */
  async function boot() {
    startBackground();
    await B.init();

    $('#btn-rules').onclick = openRules;
    $('#btn-exit-top').onclick = (e) => {
      e.preventDefault();
      confirmExit(() => { window.location.href = 'index.html'; });
    };
    $('#btn-back-brand').onclick = (e) => {
      e.preventDefault();
      confirmExit(() => { window.location.href = 'index.html'; });
    };

    renderUserPill();

    // Ouvir convites recebidos enquanto estiver na página de Mexicana:
    B.on('invite', (p) => {
      if (p.game !== 'mexicana') return;
      toast(`<b>${esc(p.from.display_name)}</b> convidou-te para jogar Mexicana (sala ${esc(p.room)})!`, {
        type: 'good',
        ms: 25000,
        actions: [{
          label: 'Entrar na Sala 🃏',
          onClick: () => joinOnlineRoom(p.room)
        }]
      });
    });

    // Verificar se a página foi aberta com parâmetros de URL:
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = (urlParams.get('room') || urlParams.get('r') || '').trim().toUpperCase();
    const inviteParam = (urlParams.get('invite') || urlParams.get('u') || '').trim();

    if (roomParam && roomParam.length === 4) {
      // Aberto diretamente com link de sala: ?room=ABCD
      setTimeout(() => joinOnlineRoom(roomParam), 300);
      return;
    }

    if (inviteParam) {
      // Aberto para desafiar um amigo: ?invite=username
      setTimeout(async () => {
        const doChallenge = async () => {
          try {
            const room = await createOnlineRoom(4);
            const { data } = await B.getFriends();
            const target = data?.friends?.find((f) => f.profile.username.toLowerCase() === inviteParam.toLowerCase());
            if (target) {
              B.sendInvite(target.profile.id, room.code, 'mexicana');
              toast(`Sala criada! Convite enviado a <b>@${esc(inviteParam)}</b>!`, { type: 'good' });
            } else {
              toast(`Sala criada (${room.code})! Partilha o link com <b>@${esc(inviteParam)}</b>.`, { type: 'good' });
            }
          } catch {
            renderSetup('online');
          }
        };

        if (!B.account) {
          openAuth('login', () => doChallenge());
        } else {
          doChallenge();
        }
      }, 400);
      return;
    }

    renderSetup('online');
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window.Omni);
