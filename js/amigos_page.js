/* OmniPlay · Página Dedicada: Adicionar e Gerir Amigos */
(function (O) {
  const { $, $$, esc, avatar, levelInfo, toast, openModal, LS, AVATARS } = O.util;
  const B = O.Backend;

  let currentFriendsCache = [];

  function startBackground() {
    const cv = $('#bg');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W, H, stars = [];
    const resize = () => {
      W = cv.width = innerWidth;
      H = cv.height = innerHeight;
      stars = Array.from({ length: Math.round((W * H) / 9000) }, () => ({
        x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.9 + 0.1,
        h: [190, 265, 28, 320][Math.floor(Math.random() * 4)], tw: Math.random() * 6
      }));
    };
    resize();
    addEventListener('resize', resize);
    let t = 0;
    (function frame() {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        s.x -= s.z * 0.12;
        if (s.x < 0) s.x = W;
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t * s.z + s.tw));
        ctx.fillStyle = `hsla(${s.h},90%,75%,${a * s.z})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.z * 1.5, 0, 6.283);
        ctx.fill();
      }
      if (!reduce) requestAnimationFrame(frame);
    })();
  }

  function renderUserPill() {
    const pill = $('#amigos-user-pill');
    if (!pill) return;
    const me = B.me();
    pill.innerHTML = `${avatar(me, 28)}<span class="mx-user-name">${esc(me.display_name || me.username)}</span>`;
    pill.onclick = () => {
      if (!B.account) openAuth();
      else toast(`Sessão iniciada como <b>@${esc(me.username)}</b>`, { type: 'good' });
    };
  }

  function openAuth(tab = 'login') {
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
            <svg class="logo big" viewBox="0 0 64 64">
              <defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".55" stop-color="#a78bfa"/><stop offset="1" stop-color="#fb923c"/></linearGradient></defs>
              <circle cx="32" cy="32" r="26" fill="none" stroke="url(#lg1)" stroke-width="6"/>
              <path d="M20 32c0-5 3.5-8 7-8 6 0 5 16 11 16 3.5 0 7-3 7-8" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>
            </svg>
          </div>
          <h2>Conta OmniPlay</h2>
          <p class="muted">Entra para guardar e gerir a tua lista de amigos</p>
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
      $('#au-eye', el).textContent = showPass ? '🙈' : '👁️';
    };

    $$('.av-opt', el).forEach((b) => b.addEventListener('click', () => {
      avIdx = +b.dataset.i;
      $$('.av-opt', el).forEach((x) => x.classList.toggle('sel', x === b));
    }));

    $('#au-hue', el)?.addEventListener('input', (e) => { hue = +e.target.value; });

    $$('.auth-acc-chip', el).forEach((b) => {
      b.onclick = () => {
        $('#au-user', el).value = b.dataset.u;
        setTab('login');
        $('#au-pass', el).focus();
      };
    });

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
        renderAmigosPage();
      } catch (err) {
        $('#au-err', el).textContent = err.message || 'Erro na autenticação';
        btn.disabled = false;
        btn.textContent = mode === 'login' ? 'Entrar no OmniPlay 🚀' : 'Criar Conta 🎉';
      }
    };
  }

  function renderAmigosPage() {
    const root = $('#amigos-root');
    if (!root) return;

    if (!B.account) {
      root.innerHTML = `
        <div class="glass fr-guest-hero">
          <div class="fgh-icon">🤝</div>
          <h2>Adicionar e Conectar Amigos</h2>
          <p class="muted">Entra na tua conta para adicionar amigos, partilhar o teu código pessoal e desafiá-los para jogar Mexicana!</p>
          <div class="fgh-features">
            <div class="fgh-feat"><span>🃏</span><b>Desafia para Mexicana</b><small>Convida amigos para salas online em segundos.</small></div>
            <div class="fgh-feat"><span>⚔️</span><b>Histórico Frente a Frente</b><small>Compara o registo de vitórias e derrotas.</small></div>
            <div class="fgh-feat"><span>🟢</span><b>Presença Online</b><small>Vê na hora quem está disponível para jogar.</small></div>
          </div>
          <div class="fgh-actions">
            <button class="btn btn-neon btn-lg" id="btn-login-cta">🔑 Entrar / Criar Conta Grátis</button>
          </div>
        </div>`;
      $('#btn-login-cta').onclick = () => openAuth('login');
      return;
    }

    const me = B.me();
    const li = levelInfo(me.xp);
    const hostUrl = `${location.origin}${location.pathname.replace(/\/$/, '')}`;
    const inviteUrl = `${hostUrl}?u=${encodeURIComponent(me.username)}`;

    const urlParams = new URLSearchParams(location.search);
    const searchTarget = urlParams.get('u') || urlParams.get('add') || urlParams.get('username') || '';
    const initialTab = urlParams.get('tab') === 'friends' ? 'friends' : (urlParams.get('tab') === 'requests' ? 'requests' : 'add');

    root.innerHTML = `
      <div class="page-head friends-head">
        <div>
          <h2>Adicionar Amigos</h2>
          <p class="muted">Pesquisa jogadores pelo username, partilha o teu link ou gere os teus pedidos.</p>
        </div>
        <div class="friends-top-actions">
          <button class="btn btn-sm btn-ghost" id="btn-quick-share">🔗 Partilhar o Meu Link</button>
        </div>
      </div>

      <!-- Segmented Tab Switcher (3 Abas dedicadas) -->
      <div class="friend-tabs-wrap">
        <div class="friend-tabs glass">
          <button class="tab-btn ${initialTab === 'friends' ? 'active' : ''}" data-tab="friends" id="tab-btn-friends">
            <span>👥 Os Teus Amigos</span>
            <span class="tab-badge" id="tab-fr-badge">0</span>
          </button>
          <button class="tab-btn ${initialTab === 'requests' ? 'active' : ''}" data-tab="requests" id="tab-btn-requests">
            <span>📬 Pedidos Recebidos</span>
            <span class="tab-badge pulse req-alert" id="tab-req-badge" hidden>0</span>
          </button>
          <button class="tab-btn ${initialTab === 'add' ? 'active' : ''}" data-tab="add" id="tab-btn-add">
            <span>➕ Adicionar Amigo</span>
          </button>
        </div>
      </div>

      <!-- Aba 1: Os Teus Amigos -->
      <div id="tab-content-friends" class="tab-pane ${initialTab === 'friends' ? 'active' : ''}">
        <div class="friends-toolbar">
          <div class="fr-filter-pills">
            <button class="pill-btn active" data-filter="all" id="filter-all">Todos <small id="cnt-all">0</small></button>
            <button class="pill-btn" data-filter="online" id="filter-online">🟢 Online <small id="cnt-online">0</small></button>
          </div>
          <div class="fr-tb-right">
            <input type="text" id="fr-list-search" class="fr-mini-search" placeholder="Filtrar amigos..." autocomplete="off">
            <button class="btn btn-sm btn-neon" id="btn-goto-add">➕ Adicionar Novo</button>
          </div>
        </div>
        <div id="fr-friends-container"><div class="loader"><i></i><i></i><i></i></div></div>
      </div>

      <!-- Aba 2: Pedidos Recebidos (Dedicada) -->
      <div id="tab-content-requests" class="tab-pane ${initialTab === 'requests' ? 'active' : ''}">
        <div class="requests-pane-wrap">
          <div class="requests-pane-head mb-16">
            <div>
              <h3 class="sec-title">📬 Pedidos de Amizade Recebidos</h3>
              <p class="muted small">Jogadores que querem ser teus amigos e jogar no OmniPlay.</p>
            </div>
          </div>

          <!-- Pedidos Recebidos -->
          <div id="fr-incoming-box" class="pending-section mb-24"><div class="loader"><i></i><i></i><i></i></div></div>

          <!-- Pedidos Enviados Pendentes -->
          <div id="fr-outgoing-box" class="pending-section"></div>
        </div>
      </div>

      <!-- Aba 3: Adicionar Amigos -->
      <div id="tab-content-add" class="tab-pane ${initialTab === 'add' ? 'active' : ''}">
        <!-- Cartão de Partilha Pessoal -->
        <div class="share-card glass">
          <div class="sc-left">
            ${avatar(me, 58)}
            <span class="sc-lvl">Nv ${li.level}</span>
          </div>
          <div class="sc-content">
            <span class="sc-eyebrow">O TEU CARTÃO DE JOGADOR</span>
            <div class="sc-title-row">
              <h3>${esc(me.display_name || me.username)}</h3>
              <span class="sc-tag">@${esc(me.username)}</span>
            </div>
            <div class="share-box">
              <input type="text" readonly id="share-link-input" class="share-input" value="${inviteUrl}">
              <button class="btn btn-sm btn-neon" id="btn-copy-invite" type="button">📋 Copiar Link</button>
              ${navigator.share ? '<button class="btn btn-sm btn-ghost" id="btn-native-share" type="button">📲 Partilhar</button>' : ''}
              <button class="btn btn-sm btn-ghost" id="btn-copy-uname" type="button">🏷️ Copiar @${esc(me.username)}</button>
            </div>
            <p class="muted small sc-hint">Partilha o teu link ou username com amigos para eles te adicionarem diretamente.</p>
          </div>
        </div>

        <!-- Pesquisa em Tempo Real -->
        <div class="add-search-section glass pad">
          <div class="search-head">
            <h3>🔍 Procurar Jogadores</h3>
            <p class="muted small">Pesquisa qualquer jogador pelo username ou nome para enviar pedido de amizade.</p>
          </div>
          <div class="search-input-wrap">
            <span class="search-ic">🔎</span>
            <input id="fr-search-input" placeholder="Escreve um username (ex: alex, marco, catarina)..." maxlength="20" autocomplete="off" value="${esc(searchTarget)}">
            <button type="button" id="fr-search-clear" class="search-clear-btn" hidden>×</button>
          </div>
          <div id="fr-search-results" class="search-results-box"></div>
        </div>

        <!-- Sugestões da Comunidade -->
        <div id="fr-suggestions-box" class="suggest-section"></div>
      </div>`;

    // Wiring Tabs
    const tabFriendsBtn = $('#tab-btn-friends');
    const tabRequestsBtn = $('#tab-btn-requests');
    const tabAddBtn = $('#tab-btn-add');
    const paneFriends = $('#tab-content-friends');
    const paneRequests = $('#tab-content-requests');
    const paneAdd = $('#tab-content-add');

    function switchTab(t) {
      tabFriendsBtn?.classList.toggle('active', t === 'friends');
      tabRequestsBtn?.classList.toggle('active', t === 'requests');
      tabAddBtn?.classList.toggle('active', t === 'add');
      paneFriends?.classList.toggle('active', t === 'friends');
      paneRequests?.classList.toggle('active', t === 'requests');
      paneAdd?.classList.toggle('active', t === 'add');
    }

    tabFriendsBtn && (tabFriendsBtn.onclick = () => switchTab('friends'));
    tabRequestsBtn && (tabRequestsBtn.onclick = () => switchTab('requests'));
    tabAddBtn && (tabAddBtn.onclick = () => switchTab('add'));
    $('#btn-goto-add') && ($('#btn-goto-add').onclick = () => switchTab('add'));
    $('#btn-quick-share') && ($('#btn-quick-share').onclick = () => { switchTab('add'); $('#btn-copy-invite')?.click(); });

    // Copiar Link
    const copyBtn = $('#btn-copy-invite');
    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(inviteUrl);
          copyBtn.textContent = 'Copiado! ✓';
          toast('Link de convite copiado para a área de transferência! 🎉', { type: 'good' });
          setTimeout(() => { if (copyBtn) copyBtn.textContent = '📋 Copiar Link'; }, 2500);
        } catch {
          const inp = $('#share-link-input');
          if (inp) { inp.select(); document.execCommand('copy'); toast('Link copiado!', { type: 'good' }); }
        }
      };
    }

    const copyUnameBtn = $('#btn-copy-uname');
    if (copyUnameBtn) {
      copyUnameBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(me.username);
          toast(`Username @${me.username} copiado!`, { type: 'good' });
        } catch { /* ignore */ }
      };
    }

    const natShareBtn = $('#btn-native-share');
    if (natShareBtn) {
      natShareBtn.onclick = async () => {
        try {
          await navigator.share({
            title: 'Joga comigo no OmniPlay!',
            text: `Adiciona-me no OmniPlay (@${me.username}) para jogarmos Mexicana!`,
            url: inviteUrl
          });
        } catch { /* cancel */ }
      };
    }

    // Search wiring
    const searchInp = $('#fr-search-input');
    const clearBtn = $('#fr-search-clear');
    let searchTm;

    const doSearch = (val) => {
      clearBtn.hidden = !val.trim();
      clearTimeout(searchTm);
      searchTm = setTimeout(() => execSearch(val), 220);
    };

    searchInp.addEventListener('input', (e) => doSearch(e.target.value));
    clearBtn.onclick = () => { searchInp.value = ''; searchInp.focus(); doSearch(''); };

    if (searchTarget) {
      doSearch(searchTarget);
    }

    loadData();
  }

  async function execSearch(text) {
    const box = $('#fr-search-results');
    if (!box) return;
    text = text.trim();
    if (!text) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="loader"><i></i><i></i><i></i></div>';
    try {
      const [{ data: fr }, users] = await Promise.all([
        B.getFriends(),
        B.searchUsers(text)
      ]);
      if (!users.length) {
        box.innerHTML = `<div class="empty-search muted small">Nenhum jogador encontrado com o nome "<b>${esc(text)}</b>".</div>`;
        return;
      }
      const friendIds = new Set(fr.friends.map((f) => f.profile.id));
      const incMap = new Map(fr.incoming.map((i) => [i.profile.id, i.fid]));
      const outMap = new Map(fr.outgoing.map((o) => [o.profile.id, o.fid]));
      const me = B.me();

      box.innerHTML = users.map((u) => {
        const isMe = me && (u.id === me.id || u.username === me.username || (me.username && (u.id === 'usr_' + me.username || u.username === me.username)));
        let actionHtml = '';
        if (isMe) {
          actionHtml = `<span class="chip">(És tu)</span>`;
        } else if (friendIds.has(u.id) || friendIds.has(u.username) || (u.id && friendIds.has(u.id.replace(/^usr_/, '')))) {
          actionHtml = `<span class="chip good">✓ Amigos</span><button class="btn btn-sm btn-ghost" data-act="view-prof" data-pid="${u.id || u.username}">Ver Perfil</button>`;
        } else if (incMap.has(u.id) || incMap.has(u.username)) {
          const fid = incMap.get(u.id) || incMap.get(u.username);
          actionHtml = `<button class="btn btn-sm btn-neon" data-act="accept" data-fid="${fid}">Aceitar Pedido 🎉</button>`;
        } else if (outMap.has(u.id) || outMap.has(u.username) || (u.id && outMap.has(u.id.replace(/^usr_/, '')))) {
          const fid = outMap.get(u.id) || outMap.get(u.username) || outMap.get(u.id.replace(/^usr_/, ''));
          actionHtml = `<span class="chip">Pedido enviado ⏳</span><button class="btn btn-sm btn-ghost danger" data-act="cancel" data-fid="${fid}">Cancelar</button>`;
        } else {
          actionHtml = `<button class="btn btn-sm btn-neon" data-act="add" data-id="${u.id}" data-name="${esc(u.display_name)}">➕ Adicionar Amigo</button>`;
        }

        const subtitle = `@${esc(u.username)} · Nv ${levelInfo(u.xp).level}`;

        return `<div class="user-search-row glass" data-id="${u.id}">
          <div class="usr-avatar">${avatar(u, 44)}</div>
          <div class="usr-info">
            <b>${esc(u.display_name || '@' + u.username)}</b>
            <small class="muted">${subtitle}</small>
          </div>
          <div class="usr-actions">${actionHtml}</div>
        </div>`;
      }).join('');

      $$('[data-act=view-prof]', box).forEach((b) => (b.onclick = () => openFriendProfileModal(b.dataset.pid)));
      $$('[data-act=accept]', box).forEach((b) => (b.onclick = () => handleAct(() => B.acceptRequest(+b.dataset.fid), 'Pedido aceite! Agora são amigos. 🎉')));
      $$('[data-act=cancel]', box).forEach((b) => (b.onclick = () => handleAct(() => B.removeFriendship(+b.dataset.fid), 'Pedido cancelado.')));
      $$('[data-act=add]', box).forEach((b) => (b.onclick = async () => {
        b.disabled = true;
        try {
          await B.sendRequest(b.dataset.id);
          toast(`Pedido de amizade enviado a <b>${b.dataset.name}</b>!`, { type: 'good' });
          loadData();
          execSearch($('#fr-search-input')?.value || '');
        } catch (e) {
          toast(e.message, { type: 'bad' });
          b.disabled = false;
        }
      }));
    } catch (e) {
      box.innerHTML = `<p class="muted small">${esc(e.message)}</p>`;
    }
  }

  async function loadData() {
    const listContainer = $('#fr-friends-container');
    const incomingBox = $('#fr-incoming-box');
    const outgoingBox = $('#fr-outgoing-box');
    const suggestBox = $('#fr-suggestions-box');
    if (!listContainer) return;

    try {
      const [{ data: fr }, h2h, suggested] = await Promise.all([
        B.getFriends(),
        B.getAllH2H().catch(() => ({ data: [] })),
        B.getSuggestedUsers().catch(() => [])
      ]);

      currentFriendsCache = fr.friends;
      const byFriend = {};
      (h2h.data || []).forEach((r) => (byFriend[r.friend_id] = byFriend[r.friend_id] || []).push(r));

      // Badges
      const reqBadge = $('#tab-req-badge');
      if (reqBadge) {
        reqBadge.hidden = !fr.incoming.length;
        reqBadge.textContent = fr.incoming.length;
      }
      updateCounts();

      renderFriendsList(fr.friends, byFriend);

      // Pedidos Recebidos
      if (incomingBox) {
        if (fr.incoming.length) {
          incomingBox.innerHTML = `
            <div class="incoming-req-cards-grid">
              ${fr.incoming.map((i) => `
                <div class="incoming-req-card glass glow-alert" data-fid="${i.fid}">
                  <div class="irc-top">
                    ${avatar(i.profile, 56)}
                    <div class="irc-info">
                      <div class="irc-name-line">
                        <b>${esc(i.profile.display_name)}</b>
                        <span class="chip mini">Nv ${levelInfo(i.profile.xp).level}</span>
                      </div>
                      <small class="muted">@${esc(i.profile.username)}</small>
                      <span class="irc-sub-text muted small">📬 Quer ser teu amigo no OmniPlay</span>
                    </div>
                  </div>
                  <div class="irc-actions">
                    <button class="btn btn-sm btn-neon irc-btn-accept" data-act="accept" data-fid="${i.fid}">🎉 Aceitar Pedido</button>
                    <button class="btn btn-sm btn-ghost" data-act="view-prof" data-pid="${i.profile.id || i.profile.username}">👁️ Ver Perfil</button>
                    <button class="btn btn-sm btn-ghost danger" data-act="remove" data-fid="${i.fid}" title="Recusar pedido">✕ Recusar</button>
                  </div>
                </div>`).join('')}
            </div>`;
          $$('[data-act=accept]', incomingBox).forEach((b) => (b.onclick = () => handleAct(() => B.acceptRequest(+b.dataset.fid), 'Agora são amigos! 🎉')));
          $$('[data-act=remove]', incomingBox).forEach((b) => (b.onclick = () => handleAct(() => B.removeFriendship(+b.dataset.fid), 'Pedido recusado.')));
          $$('[data-act=view-prof]', incomingBox).forEach((b) => (b.onclick = () => openFriendProfileModal(b.dataset.pid)));
        } else {
          incomingBox.innerHTML = `
            <div class="empty glass pad text-center empty-requests">
              <div class="empty-ic" style="font-size:3.5rem;margin-bottom:12px;">📭</div>
              <h3>Sem pedidos recebidos</h3>
              <p class="muted mb-16">Não tens nenhum pedido de amizade pendente neste momento.</p>
              <button class="btn btn-neon" id="btn-goto-add-from-req">➕ Procurar e Adicionar Amigos</button>
            </div>`;
          $('#btn-goto-add-from-req', incomingBox)?.addEventListener('click', () => switchTab('add'));
        }
      }

      // Pedidos Enviados
      if (outgoingBox) {
        if (fr.outgoing.length) {
          outgoingBox.innerHTML = `
            <div class="section-card glass pad">
              <h3 class="sec-title muted">📤 Pedidos Enviados Pendentes <small>(${fr.outgoing.length})</small></h3>
              <p class="muted small mb-12">Jogadores a quem enviaste pedido e que ainda não responderam.</p>
              <div class="pending-list">${fr.outgoing.map((i) => `
                <div class="pending-row" data-fid="${i.fid}">
                  ${avatar(i.profile, 44)}
                  <div class="p-info">
                    <b>${esc(i.profile.display_name)}</b>
                    <small class="muted">@${esc(i.profile.username)} · À espera de confirmação...</small>
                  </div>
                  <div class="p-actions">
                    <button class="btn btn-sm btn-ghost danger" data-act="cancel-out" data-fid="${i.fid}">Cancelar Pedido</button>
                  </div>
                </div>`).join('')}</div>
            </div>`;
          $$('[data-act=cancel-out]', outgoingBox).forEach((b) => (b.onclick = () => handleAct(() => B.removeFriendship(+b.dataset.fid), 'Pedido cancelado.')));
        } else {
          outgoingBox.innerHTML = '';
        }
      }

      // Sugestões: Apenas Amigos de Amigos
      if (suggestBox) {
        const friendIds = new Set(fr.friends.map((f) => f.profile.id));
        const incMap = new Map(fr.incoming.map((i) => [i.profile.id, i.fid]));
        const outMap = new Map(fr.outgoing.map((o) => [o.profile.id, o.fid]));
        const filteredSug = (suggested || []).filter((u) => !friendIds.has(u.id));

        if (filteredSug.length) {
          suggestBox.innerHTML = `
            <div class="section-card glass pad">
              <h3 class="sec-title">👥 Amigos de Amigos</h3>
              <p class="muted small mb-12">Jogadores conectados aos teus amigos no OmniPlay.</p>
              <div class="suggest-grid">${filteredSug.map((u) => {
                let btnHtml = '';
                if (outMap.has(u.id)) {
                  btnHtml = `<span class="chip w-full center">Pedido enviado ⏳</span>`;
                } else if (incMap.has(u.id)) {
                  btnHtml = `<button class="btn btn-sm btn-neon w-full" data-act="sug-accept" data-fid="${incMap.get(u.id)}">Aceitar 🎉</button>`;
                } else {
                  btnHtml = `<button class="btn btn-sm btn-neon w-full" data-act="sug-add" data-id="${u.id}" data-name="${esc(u.display_name)}">➕ Adicionar</button>`;
                }
                return `
                  <div class="suggest-card glass">
                    <div class="sug-top">
                      ${avatar(u, 48)}
                      <div class="sug-info">
                        <b>${esc(u.display_name)}</b>
                        <small class="muted">@${esc(u.username)}</small>
                        <span class="chip mini mutual-chip">🔗 Amigo de ${esc(u.mutual_friend || 'um amigo')}</span>
                      </div>
                    </div>
                    ${btnHtml}
                  </div>`;
              }).join('')}</div>
            </div>`;
          $$('[data-act=sug-add]', suggestBox).forEach((b) => (b.onclick = async () => {
            b.disabled = true;
            try {
              await B.sendRequest(b.dataset.id);
              toast(`Pedido de amizade enviado a <b>${b.dataset.name}</b>!`, { type: 'good' });
              loadData();
            } catch (e) {
              toast(e.message, { type: 'bad' });
              b.disabled = false;
            }
          }));
          $$('[data-act=sug-accept]', suggestBox).forEach((b) => (b.onclick = () => handleAct(() => B.acceptRequest(+b.dataset.fid), 'Agora são amigos! 🎉')));
        } else {
          suggestBox.innerHTML = '';
        }
      }
    } catch (e) {
      listContainer.innerHTML = '<div class="empty muted small">Sem dados offline. Liga-te à internet para carregar amigos.</div>';
    }
  }

  function updateCounts() {
    const total = currentFriendsCache.length;
    const online = currentFriendsCache.filter((f) => B.onlineIds.has(f.profile.id)).length;
    const cntAll = $('#cnt-all'), cntOn = $('#cnt-online'), tabBadge = $('#tab-fr-badge');
    if (cntAll) cntAll.textContent = total;
    if (cntOn) cntOn.textContent = online;
    if (tabBadge) tabBadge.textContent = total;
  }

  function renderFriendsList(friends, byFriend) {
    const listContainer = $('#fr-friends-container');
    if (!listContainer) return;
    const searchFilter = ($('#fr-list-search')?.value || '').toLowerCase().trim();
    const activeFilter = $('.pill-btn.active')?.dataset.filter || 'all';

    let list = friends;
    if (activeFilter === 'online') {
      list = list.filter((f) => B.onlineIds.has(f.profile.id));
    }
    if (searchFilter) {
      list = list.filter((f) => {
        const u = f.profile.username.toLowerCase();
        const d = (f.profile.display_name || '').toLowerCase();
        return u.includes(searchFilter) || d.includes(searchFilter);
      });
    }

    if (!list.length) {
      if (friends.length === 0) {
        listContainer.innerHTML = `
          <div class="empty glass empty-friends">
            <div class="empty-ic">👥</div>
            <h3>Ainda não tens amigos adicionados</h3>
            <p class="muted">Usa a pesquisa acima ou partilha o teu link para adicionares amigos para jogar Mexicana!</p>
            <button class="btn btn-neon btn-lg" id="btn-empty-add">➕ Procurar e Adicionar Amigos</button>
          </div>`;
        const b = $('#btn-empty-add');
        if (b) b.onclick = () => $('#tab-btn-add')?.click();
      } else {
        listContainer.innerHTML = `<div class="empty-search muted small">Nenhum amigo corresponde ao filtro selecionado.</div>`;
      }
      return;
    }

    listContainer.innerHTML = `
      <div class="friend-grid">
        ${list.map((f) => friendCard(f, byFriend[f.profile.id])).join('')}
      </div>`;

    $$('[data-act=invite-mx]', listContainer).forEach((b) => (b.onclick = () => {
      const u = b.dataset.uname;
      toast(`A iniciar Mexicana para convidar <b>${esc(u)}</b>...`, { type: 'good' });
      setTimeout(() => { location.href = `mexicana.html?invite=${encodeURIComponent(u)}`; }, 400);
    }));

    $$('[data-act=profile]', listContainer).forEach((b) => (b.onclick = () => openFriendProfileModal(b.dataset.pid)));

    $$('[data-act=remove]', listContainer).forEach((b) => (b.onclick = () => {
      const name = b.dataset.name;
      if (confirm(`Queres mesmo remover ${name} dos teus amigos?`)) {
        handleAct(() => B.removeFriendship(+b.dataset.fid), 'Amigo removido.');
      }
    }));

    $$('.pill-btn').forEach((p) => {
      p.onclick = () => {
        $$('.pill-btn').forEach((x) => x.classList.remove('active'));
        p.classList.add('active');
        renderFriendsList(currentFriendsCache, byFriend);
      };
    });

    const searchInput = $('#fr-list-search');
    if (searchInput && !searchInput.dataset.wired) {
      searchInput.dataset.wired = '1';
      searchInput.addEventListener('input', () => renderFriendsList(currentFriendsCache, byFriend));
    }
  }

  /* ===================== RENDER H2H TODOS OS JOGOS ===================== */
  function renderAllGamesH2H(games, otherName, otherUsername) {
    if (!games || !games.length) {
      return `<div class="empty-search muted small">Sem dados de confrontos para apresentar.</div>`;
    }
    const totWins = games.reduce((a, g) => a + (g.wins || 0), 0);
    const totLosses = games.reduce((a, g) => a + (g.losses || 0), 0);
    const totDraws = games.reduce((a, g) => a + (g.draws || 0), 0);
    const totPlayed = games.reduce((a, g) => a + (g.played || 0), 0);

    let leadText = '';
    if (totPlayed === 0) {
      leadText = `Ainda não disputaram nenhuma partida um contra o outro. Desafia o ${esc(otherName)} abaixo!`;
    } else if (totWins > totLosses) {
      leadText = `🏆 Estás em vantagem geral no confronto direto (+${totWins - totLosses} vitória${totWins - totLosses === 1 ? '' : 's'})!`;
    } else if (totWins < totLosses) {
      leadText = `⚠️ O ${esc(otherName)} está em vantagem no confronto direto (+${totLosses - totWins} vitória${totLosses - totWins === 1 ? '' : 's'}). Hora da desforra!`;
    } else {
      leadText = `🤝 Estão rigorosamente empatados no confronto geral!`;
    }

    return `
      <div class="h2h-summary-banner glass">
        <div class="h2h-sb-lead">
          <span class="h2h-badge-total">Todos os Jogos (${totPlayed} partida${totPlayed === 1 ? '' : 's'})</span>
          <p class="h2h-lead-txt">${leadText}</p>
        </div>
        <div class="h2h-sb-score">
          <div class="h2h-score-col me">
            <span class="h2h-lbl">Tu</span>
            <b class="h2h-big-val win">${totWins}</b>
            <span class="h2h-sub-lbl">vitórias</span>
          </div>
          <div class="h2h-score-sep">×</div>
          <div class="h2h-score-col them">
            <span class="h2h-lbl">${esc(otherName)}</span>
            <b class="h2h-big-val loss">${totLosses}</b>
            <span class="h2h-sub-lbl">vitórias</span>
          </div>
        </div>
      </div>

      <div class="h2h-platform-grid">
        ${games.map((g) => {
          const played = g.played || 0;
          const wPct = played ? Math.round((g.wins / played) * 100) : 0;
          const lPct = played ? Math.round((g.losses / played) * 100) : 0;
          const dPct = played ? Math.max(0, 100 - wPct - lPct) : 0;

          let statusBadge = '';
          if (played === 0) {
            statusBadge = '<span class="chip mini muted">Por estrear</span>';
          } else if (g.wins > g.losses) {
            statusBadge = '<span class="chip mini good">À frente 🏆</span>';
          } else if (g.wins < g.losses) {
            statusBadge = '<span class="chip mini danger">Atrás ⚔️</span>';
          } else {
            statusBadge = '<span class="chip mini">Empatados 🤝</span>';
          }

          let playAction = '';
          if (g.id === 'mexicana') {
            playAction = `<a href="mexicana.html?invite=${encodeURIComponent(otherUsername || '')}" class="btn btn-sm btn-neon">🃏 Desafiar Mexicana</a>`;
          } else if (g.id === 'connect4') {
            playAction = `<a href="index.html#game/connect4" class="btn btn-sm btn-ghost">🔴 Jogar 4 em Linha</a>`;
          } else {
            playAction = `<a href="index.html#game/reflex" class="btn btn-sm btn-ghost">⚡ Jogar Reflexo</a>`;
          }

          return `
            <div class="h2h-game-card glass" style="--ghue:${g.hue || 200}">
              <div class="h2h-gc-top">
                <div class="h2h-gc-title">
                  <span class="h2h-gc-ic">${g.icon}</span>
                  <div>
                    <b>${esc(g.name)}</b>
                    <small class="muted">${played === 0 ? 'Nenhum jogo disputado' : `${played} jogo${played === 1 ? '' : 's'}`}</small>
                  </div>
                </div>
                ${statusBadge}
              </div>

              <div class="h2h-gc-score-row">
                <div class="h2h-side me">
                  <span class="h2h-side-tag">Tu</span>
                  <span class="h2h-num win">${g.wins}</span>
                  <small class="muted">vitórias</small>
                </div>
                <div class="h2h-vs-sign">vs</div>
                <div class="h2h-side them">
                  <span class="h2h-side-tag">${esc(otherName)}</span>
                  <span class="h2h-num loss">${g.losses}</span>
                  <small class="muted">vitórias</small>
                </div>
              </div>

              <div class="h2h-bar-wrap" title="${g.wins}V - ${g.losses}D - ${g.draws || 0}E">
                <div class="h2h-bar-track">
                  <div class="h2h-bar-fill me" style="width:${wPct}%"></div>
                  <div class="h2h-bar-fill draw" style="width:${dPct}%"></div>
                  <div class="h2h-bar-fill them" style="width:${lPct}%"></div>
                </div>
                <div class="h2h-bar-legend">
                  <span>${wPct}% teu</span>
                  ${g.draws > 0 ? `<small class="muted">${g.draws} empates</small>` : ''}
                  <span>${lPct}% adversário</span>
                </div>
              </div>

              <div class="h2h-gc-footer">
                ${playAction}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  async function openFriendProfileModal(pid) {
    const m = openModal(`
      <div class="friend-profile-modal">
        <div class="loader"><i></i><i></i><i></i></div>
      </div>`, { cls: 'modal-fpm' });
    const modalEl = m.el.querySelector('.friend-profile-modal');
    try {
      const [{ data: prof }, { data: h2hData }] = await Promise.all([
        B.getProfile(pid),
        B.getH2H(pid)
      ]);
      const li = levelInfo(prof.xp);
      modalEl.innerHTML = `
        <div class="fpm-head glass pad mb-16">
          <div class="fpm-avatar">${avatar(prof, 72)}</div>
          <div class="fpm-info">
            <h3 class="fpm-title">${esc(prof.display_name)}</h3>
            <p class="muted small">@${esc(prof.username)} · Nível ${li.level} · ⭐ ${prof.xp} XP</p>
            ${prof.bio ? `<p class="fpm-bio">${esc(prof.bio)}</p>` : ''}
          </div>
        </div>
        <div class="fpm-h2h-section">
          <h4 class="sec-title mb-8">⚔️ Confronto Direto vs ${esc(prof.display_name)} (Todos os Jogos)</h4>
          <p class="muted small mb-16">Histórico de vitórias e derrotas em cada jogo da plataforma OmniPlay.</p>
          ${renderAllGamesH2H(h2hData, prof.display_name, prof.username)}
        </div>
        <div class="fpm-actions mt-20" style="display:flex;justify-content:space-between;align-items:center;">
          <a href="index.html#profile?id=${encodeURIComponent(prof.id || prof.username)}" class="btn btn-ghost btn-sm">Abrir Página Completa ↗</a>
          <button class="btn btn-neon btn-sm" id="btn-fpm-close">Fechar</button>
        </div>`;
      $('#btn-fpm-close', modalEl)?.addEventListener('click', () => m.close());
    } catch (err) {
      modalEl.innerHTML = `
        <div class="empty glass pad text-center" style="padding:24px;">
          <div class="empty-ic" style="font-size:3rem;margin-bottom:8px;">👤</div>
          <h3>Perfil não encontrado</h3>
          <p class="muted mb-16">Este utilizador não existe ou ainda não criou conta no OmniPlay.</p>
          <button class="btn btn-neon btn-sm" id="btn-fpm-err-close">Fechar</button>
        </div>`;
      $('#btn-fpm-err-close', modalEl)?.addEventListener('click', () => m.close());
    }
  }

  function friendCard(f, rows) {
    const p = f.profile;
    const on = B.onlineIds.has(p.id);
    const tw = (rows || []).reduce((a, r) => a + r.wins, 0);
    const tl = (rows || []).reduce((a, r) => a + r.losses, 0);

    return `<article class="friend-card glass" data-pid="${p.id}">
      <div class="fc-header">
        <div class="fc-avatar-wrap">
          ${avatar(p, 54)}
          <span class="fc-dot ${on ? 'on' : ''}" title="${on ? 'Online' : 'Offline'}"></span>
        </div>
        <div class="fc-user-info">
          <b>${esc(p.display_name)}</b>
          <small class="muted">@${esc(p.username)} · Nv ${levelInfo(p.xp).level}</small>
          <span class="fc-status-txt muted small">${on ? '🟢 Online' : '⚪ Offline'}</span>
        </div>
      </div>

      <div class="fc-h2h">
        <div class="fc-h2h-head">
          <span>Tu × ${esc(p.display_name)}</span>
          <span class="vs"><b class="w">${tw}</b><i>×</i><b class="l">${tl}</b></span>
        </div>
      </div>

      <div class="fc-actions">
        <button class="btn btn-sm btn-neon" data-act="invite-mx" data-pid="${p.id}" data-uname="${esc(p.username)}">🃏 Desafiar Mexicana</button>
        <button class="btn btn-sm btn-ghost" data-act="profile" data-pid="${p.id}">👁️ Ver Perfil & H2H</button>
        <button class="btn btn-sm btn-ghost danger" data-act="remove" data-fid="${f.fid}" data-name="${esc(p.display_name)}" title="Remover amigo">✕</button>
      </div>
    </article>`;
  }

  async function handleAct(fn, msg) {
    try {
      await fn();
      toast(msg, { type: 'good' });
      loadData();
    } catch (e) {
      toast(e.message || 'Erro', { type: 'bad' });
    }
  }

  // Presença online
  B.on('presence', () => {
    $$('.friend-card').forEach((card) => {
      const pid = card.dataset.pid;
      const on = B.onlineIds.has(pid);
      const dot = card.querySelector('.fc-dot');
      const label = card.querySelector('.fc-status-txt');
      if (dot) dot.classList.toggle('on', on);
      if (label) label.textContent = on ? '🟢 Online' : '⚪ Offline';
    });
    updateCounts();
  });

  async function boot() {
    startBackground();
    await B.init();
    renderUserPill();
    renderAmigosPage();
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window.Omni);
