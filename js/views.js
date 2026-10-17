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

  /* ===================== AMIGOS & ADICIONAR ===================== */
  O.views.friends = {
    async render(root, params = {}) {
      if (!B.account) {
        root.innerHTML = `<section class="page friends-page">
          <div class="glass fr-guest-hero">
            <div class="fgh-icon">🤝</div>
            <h2>O Teu Círculo de Jogos no OmniPlay</h2>
            <p class="muted">Adiciona amigos pelo username, partilha o teu link pessoal e compara vitórias e derrotas frente a frente no Mexicana e outros jogos.</p>
            <div class="fgh-features">
              <div class="fgh-feat"><span>🃏</span><b>Desafios Diretos</b><small>Convida amigos para salas privadas de Mexicana com 1 clique.</small></div>
              <div class="fgh-feat"><span>⚔️</span><b>Histórico Frente a Frente</b><small>Vê quem é o verdadeiro campeão de cada jogo.</small></div>
              <div class="fgh-feat"><span>🟢</span><b>Presença em Tempo Real</b><small>Sabe na hora quem está online para começar uma partida.</small></div>
            </div>
            <div class="fgh-actions">
              <button class="btn btn-neon btn-lg" id="fr-guest-login">🔑 Entrar / Criar Conta Grátis</button>
            </div>
          </div>
        </section>`;
        $('#fr-guest-login').onclick = () => O.app.openAuth();
        return;
      }

      const me = B.me();
      const li = levelInfo(me.xp);
      const hostUrl = `${location.origin}${location.pathname.replace(/\/$/, '')}`;
      const inviteUrl = `${hostUrl}#add-friend?u=${encodeURIComponent(me.username)}`;
      const initialTab = params.tab || (params.u || params.username ? 'add' : 'friends');

      root.innerHTML = `<section class="page friends-page">
        <div class="page-head friends-head">
          <div>
            <h2>Amigos & Conexões</h2>
            <p class="muted">Encontra jogadores, partilha o teu link e desafia amigos para jogar Mexicana.</p>
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

        <!-- Conteúdo Aba 1: Os Teus Amigos -->
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
          <div id="fr-friends-container">${loading()}</div>
        </div>

        <!-- Conteúdo Aba 2: Pedidos Recebidos (Dedicada) -->
        <div id="tab-content-requests" class="tab-pane ${initialTab === 'requests' ? 'active' : ''}">
          <div class="requests-pane-wrap">
            <div class="requests-pane-head mb-16">
              <div>
                <h3 class="sec-title">📬 Pedidos de Amizade Recebidos</h3>
                <p class="muted small">Jogadores que querem ser teus amigos e jogar contigo no OmniPlay.</p>
              </div>
            </div>

            <!-- Pedidos Recebidos -->
            <div id="fr-incoming-box" class="pending-section mb-24">${loading()}</div>

            <!-- Pedidos Enviados Pendentes -->
            <div id="fr-outgoing-box" class="pending-section"></div>
          </div>
        </div>

        <!-- Conteúdo Aba 3: Adicionar Amigos -->
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

          <!-- Pesquisa de Jogadores em Tempo Real -->
          <div class="add-search-section glass pad">
            <div class="search-head">
              <h3>🔍 Procurar Jogadores</h3>
              <p class="muted small">Pesquisa qualquer jogador pelo username ou nome para enviar pedido de amizade.</p>
            </div>
            <div class="search-input-wrap">
              <span class="search-ic">🔎</span>
              <input id="fr-search-input" placeholder="Escreve um username (ex: alex, marco, catarina)..." maxlength="20" autocomplete="off" value="${esc(params.u || params.username || '')}">
              <button type="button" id="fr-search-clear" class="search-clear-btn" hidden>×</button>
            </div>
            <div id="fr-search-results" class="search-results-box"></div>
          </div>

          <!-- Sugestões da Comunidade -->
          <div id="fr-suggestions-box" class="suggest-section"></div>
        </div>
      </section>`;

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

      // Copiar Link & Partilha
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
              text: `Adiciona-me no OmniPlay (@${me.username}) para jogarmos Mexicana e outros jogos multiplayer!`,
              url: inviteUrl
            });
          } catch { /* user cancel */ }
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

      // Se passou username por parâmetro, pesquisa automaticamente
      if (params.u || params.username) {
        doSearch(params.u || params.username);
      }

      loadData();
    }
  };

  // Atualização em tempo real de presença
  B.on('presence', () => {
    if (O.app.current !== 'friends') return;
    $$('.friend-card').forEach((card) => {
      const pid = card.dataset.pid;
      const on = B.onlineIds.has(pid);
      const dot = card.querySelector('.fc-dot');
      const label = card.querySelector('.fc-status-txt');
      if (dot) {
        dot.classList.toggle('on', on);
        dot.title = on ? 'Online' : 'Offline';
      }
      if (label) label.textContent = on ? 'Online' : 'Offline';
    });
    updateFilterCounts();
  });

  let currentFriendsCache = [];

  function updateFilterCounts() {
    const total = currentFriendsCache.length;
    const online = currentFriendsCache.filter((f) => B.onlineIds.has(f.profile.id)).length;
    const cntAll = $('#cnt-all'), cntOn = $('#cnt-online'), tabBadge = $('#tab-fr-badge');
    if (cntAll) cntAll.textContent = total;
    if (cntOn) cntOn.textContent = online;
    if (tabBadge) tabBadge.textContent = total;
  }

  async function execSearch(text) {
    const box = $('#fr-search-results');
    if (!box) return;
    text = text.trim();
    if (!text) { box.innerHTML = ''; return; }
    box.innerHTML = loading();
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
          actionHtml = `<span class="chip good">✓ Amigos</span><button class="btn btn-sm btn-ghost" data-act="view" data-u="${esc(u.username)}">Ver Perfil</button>`;
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

      $$('[data-act=view]', box).forEach((b) => (b.onclick = () => goProfile({ username: b.dataset.u })));
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
      const [{ data: fr, stale: s1 }, h2h, suggested] = await Promise.all([
        B.getFriends(),
        B.getAllH2H().catch(() => ({ data: [] })),
        B.getSuggestedUsers().catch(() => [])
      ]);

      if (!$('#fr-friends-container')) return;
      currentFriendsCache = fr.friends;
      const byFriend = {};
      (h2h.data || []).forEach((r) => (byFriend[r.friend_id] = byFriend[r.friend_id] || []).push(r));

      // Atualiza badges
      const reqBadge = $('#tab-req-badge');
      if (reqBadge) {
        reqBadge.hidden = !fr.incoming.length;
        reqBadge.textContent = fr.incoming.length;
      }
      updateFilterCounts();
      O.app.refreshBadge && O.app.refreshBadge();

      // Render Friends List
      renderFriendsList(fr.friends, byFriend, s1);

      // Render Incoming Requests
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
          $$('[data-act=view-prof]', incomingBox).forEach((b) => (b.onclick = () => goProfile({ id: b.dataset.pid })));
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

      // Render Outgoing Requests
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
      listContainer.innerHTML = empty('📡', 'Sem dados offline', 'Liga-te à internet para carregar a lista de amigos.');
    }
  }

  function renderFriendsList(friends, byFriend, isStale) {
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
        listContainer.innerHTML = stale(isStale) + `
          <div class="empty glass empty-friends">
            <div class="empty-ic">👥</div>
            <h3>Ainda não tens amigos adicionados</h3>
            <p class="muted">Partilha o teu link ou procura usernames para começarem a jogar Mexicana juntos!</p>
            <button class="btn btn-neon btn-lg" id="btn-empty-add">➕ Procurar e Adicionar Amigos</button>
          </div>`;
        const b = $('#btn-empty-add');
        if (b) b.onclick = () => $('#tab-btn-add')?.click();
      } else {
        listContainer.innerHTML = stale(isStale) + `
          <div class="empty-search muted small">Nenhum amigo corresponde ao filtro selecionado.</div>`;
      }
      return;
    }

    listContainer.innerHTML = stale(isStale) + `
      <div class="friend-grid">
        ${list.map((f) => friendCard(f, byFriend[f.profile.id])).join('')}
      </div>`;

    // Ações dos cartões
    $$('[data-act=profile]', listContainer).forEach((b) => (b.onclick = () => goProfile({ id: b.dataset.id })));
    $$('[data-act=invite-mx]', listContainer).forEach((b) => (b.onclick = () => {
      const u = b.dataset.uname;
      toast(`A iniciar Mexicana para convidar <b>${esc(u)}</b>...`, { type: 'good' });
      setTimeout(() => { location.href = `mexicana.html?invite=${encodeURIComponent(u)}`; }, 400);
    }));
    $$('[data-act=remove]', listContainer).forEach((b) => (b.onclick = () => {
      const name = b.dataset.name;
      if (confirm(`Queres mesmo remover ${name} dos teus amigos?`)) {
        handleAct(() => B.removeFriendship(+b.dataset.fid), 'Amigo removido.');
      }
    }));

    // Wiring filtros
    $$('.pill-btn').forEach((p) => {
      p.onclick = () => {
        $$('.pill-btn').forEach((x) => x.classList.remove('active'));
        p.classList.add('active');
        renderFriendsList(currentFriendsCache, byFriend, isStale);
      };
    });

    const searchInput = $('#fr-list-search');
    if (searchInput && !searchInput.dataset.wired) {
      searchInput.dataset.wired = '1';
      searchInput.addEventListener('input', () => renderFriendsList(currentFriendsCache, byFriend, isStale));
    }
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

  function friendCard(f, rows) {
    const p = f.profile;
    const on = B.onlineIds.has(p.id);
    const tw = (rows || []).reduce((a, r) => a + r.wins, 0);
    const tl = (rows || []).reduce((a, r) => a + r.losses, 0);
    const td = (rows || []).reduce((a, r) => a + (r.draws || 0), 0);

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
          ${rows && rows.length ? score(tw, tl, td) : '<small class="muted">0 jogos</small>'}
        </div>
        ${h2hRows(rows, 'Ainda não jogaram juntos online.')}
      </div>

      <div class="fc-actions">
        <button class="btn btn-sm btn-neon" data-act="invite-mx" data-pid="${p.id}" data-uname="${esc(p.username)}">🃏 Desafiar Mexicana</button>
        <button class="btn btn-sm btn-ghost" data-act="profile" data-id="${p.id}">Perfil</button>
        <button class="btn btn-sm btn-ghost danger" data-act="remove" data-fid="${f.fid}" data-name="${esc(p.display_name)}" title="Remover amigo">✕</button>
      </div>
    </article>`;
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
            playAction = `<a href="#game/connect4" class="btn btn-sm btn-ghost">🔴 Jogar 4 em Linha</a>`;
          } else {
            playAction = `<a href="#game/reflex" class="btn btn-sm btn-ghost">⚡ Jogar Reflexo</a>`;
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

  /* ===================== PERFIL ===================== */
  O.views.profile = {
    async render(root, params) {
      const self = params.self || (B.user && (params.id === B.user.id || (B.user.username && params.username === B.user.username)));
      root.innerHTML = `<section class="page">${loading()}</section>`;
      const page = root.firstElementChild;
      let prof, st = false;

      try {
        if (self) {
          prof = B.me();
          if (!prof) throw new Error('Perfil não encontrado.');
        } else {
          const target = params.id || params.username;
          if (!target) throw new Error('Perfil não encontrado.');
          const r = await B.getProfile(target);
          if (!r || !r.data) throw new Error('Perfil não encontrado.');
          prof = r.data;
          st = r.stale;
        }
      } catch (e) {
        page.innerHTML = `
          <div class="empty glass pad text-center" style="max-width:560px;margin:40px auto;text-align:center;">
            <div class="empty-ic" style="font-size:3.5rem;margin-bottom:12px;">👤</div>
            <h3 style="margin-bottom:8px;">Perfil não encontrado</h3>
            <p class="muted" style="margin-bottom:20px;">Este utilizador não existe ou ainda não criou conta no OmniPlay.</p>
            <button class="btn btn-neon" id="pf-back-btn">⬅️ Voltar aos Amigos</button>
          </div>`;
        const b = $('#pf-back-btn', page);
        if (b) b.onclick = () => O.app.nav('friends');
        return;
      }

      const id = prof.id || prof.username, li = levelInfo(prof.xp), fr = frameFor(prof.xp);

      page.innerHTML = `
        <div class="profile-head glass">
          <div class="ph-avatar">${avatar(prof, 112)}</div>
          <div class="ph-main">
            <h2>${esc(prof.display_name)} ${self && !B.account ? '<small>(convidado)</small>' : ''}</h2>
            <p class="muted">@${esc(prof.username)}${prof.created_at ? ' · membro desde ' + new Date(prof.created_at).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }) : ''}</p>
            ${prof.bio ? `<p class="bio">${esc(prof.bio)}</p>` : ''}
            <div class="xp-line"><b>Nível ${li.level}</b><div class="xp-bar"><i style="width:${li.pct}%"></i></div><span>${li.cur} / ${li.need} XP</span></div>
            <div class="chips"><span class="chip">⭐ ${prof.xp} XP total</span><span class="chip">🪙 ${prof.coins || 0} moedas</span><span class="chip">🖼️ ${esc(fr.name)}</span></div>
            <div class="ph-actions" id="ph-actions"></div>
          </div>
        </div>
        ${stale(st)}
        <div class="cols">
          <div class="col-main">
            ${!self ? `
              <div class="section-card glass pad mb-24">
                <div class="sec-head">
                  <h3 class="sec-title">⚔️ Confronto Direto vs ${esc(prof.display_name)} (Todos os Jogos)</h3>
                  <p class="muted small">Vê quantas vezes ganhaste e perdeste contra o teu amigo em cada um dos jogos da plataforma.</p>
                </div>
                <div id="pf-all-h2h">${loading()}</div>
              </div>` : `
              <div class="section-card glass pad mb-24">
                <div class="sec-head">
                  <h3 class="sec-title">👥 Confrontos Diretos com os Teus Amigos (Todos os Jogos)</h3>
                  <p class="muted small">O teu registo de vitórias e derrotas contra cada um dos teus amigos na plataforma.</p>
                </div>
                <div id="pf-friends-h2h">${loading()}</div>
              </div>`}

            <h3 class="sec">Estatísticas Gerais na Plataforma</h3>
            <div id="pf-stats">${loading()}</div>

            <h3 class="sec">Histórico de partidas</h3>
            <div id="pf-hist">${loading()}</div>
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

      // ações de topo
      const ac = $('#ph-actions');
      if (self) {
        ac.innerHTML = `<button class="btn btn-ghost btn-sm" id="pf-edit">✏️ Editar perfil</button>` +
          (B.account ? `<button class="btn btn-ghost btn-sm danger" id="pf-out">Terminar sessão</button>` : `<button class="btn btn-neon btn-sm" id="pf-in">Entrar / Criar conta</button>`);
        $('#pf-edit').onclick = () => editProfile();
        if (B.account) $('#pf-out').onclick = async () => { await B.signOut(); toast('Sessão terminada.'); };
        else $('#pf-in').onclick = () => O.app.openAuth();
      } else {
        relationButtons(ac, id, prof);
      }

      // H2H Todos os Jogos
      if (!self) {
        try {
          const { data: h2hData } = await B.getH2H(id);
          const t = $('#pf-all-h2h');
          if (t) t.innerHTML = renderAllGamesH2H(h2hData, prof.display_name, prof.username);
        } catch {
          const t = $('#pf-all-h2h');
          if (t) t.innerHTML = '<p class="muted small">Sem dados de confrontos diretos disponíveis.</p>';
        }
      } else {
        try {
          const [{ data: frData }, h2hRes] = await Promise.all([
            B.getFriends(),
            B.getAllH2H().catch(() => ({ data: [] }))
          ]);
          const friends = frData.friends || [];
          const box = $('#pf-friends-h2h');
          if (box) {
            if (!friends.length) {
              box.innerHTML = `
                <div class="empty-search muted small">
                  Ainda não tens amigos adicionados. <button class="btn btn-sm btn-neon ml-8" id="btn-self-add-fr">➕ Adicionar Amigos</button>
                </div>`;
              $('#btn-self-add-fr', box)?.addEventListener('click', () => O.app.nav('friends'));
            } else {
              const byFriend = {};
              (h2hRes.data || []).forEach((r) => {
                const k = r.friend_id || r.other;
                if (k) (byFriend[k] = byFriend[k] || []).push(r);
              });
              box.innerHTML = `
                <div class="self-h2h-friends-grid">
                  ${friends.map((f) => {
                    const fid = f.profile.id || f.profile.username;
                    const frows = byFriend[fid] || byFriend[f.profile.username] || [];
                    const tw = frows.reduce((a, r) => a + (r.wins || 0), 0);
                    const tl = frows.reduce((a, r) => a + (r.losses || 0), 0);
                    const td = frows.reduce((a, r) => a + (r.draws || 0), 0);
                    const tp = tw + tl + td;
                    return `
                      <div class="self-h2h-friend-card glass" data-fid="${fid}">
                        <div class="shf-top">
                          ${avatar(f.profile, 44)}
                          <div class="shf-info">
                            <b>${esc(f.profile.display_name)}</b>
                            <small class="muted">@${esc(f.profile.username)}</small>
                          </div>
                        </div>
                        <div class="shf-score-row">
                          <span class="shf-pill win">Tu: <b>${tw}V</b></span>
                          <span class="shf-pill loss">Amigo: <b>${tl}D</b></span>
                          ${td > 0 ? `<span class="shf-pill draw"><b>${td}E</b></span>` : ''}
                        </div>
                        <button class="btn btn-sm btn-ghost w-full" data-goto-prof="${fid}">⚔️ Ver Todos os Jogos vs ${esc(f.profile.display_name)}</button>
                      </div>`;
                  }).join('')}
                </div>`;
              $$('[data-goto-prof]', box).forEach((b) => (b.onclick = () => goProfile({ id: b.dataset.gotoProf })));
            }
          }
        } catch {
          const box = $('#pf-friends-h2h');
          if (box) box.innerHTML = '<p class="muted small">Sem dados de amigos.</p>';
        }
      }

      // Estatísticas gerais por jogo
      try {
        const { data: stats } = await B.getUserStats(id);
        $('#pf-stats').innerHTML = stats.length ? `<div class="stat-grid">${stats.map((s) => `
          <div class="stat-card glass" style="--hue:${gm(s.game_id).hue}"><div class="sc-head"><span>${gm(s.game_id).icon}</span><b>${esc(gm(s.game_id).name)}</b></div>
            ${score(s.wins, s.losses, s.draws)}
            <div class="wr"><i style="width:${s.played ? (s.wins / s.played) * 100 : 0}%"></i></div>
            <small class="muted">${s.played} jogos · ${s.played ? Math.round((s.wins / s.played) * 100) : 0}% vitórias</small></div>`).join('')}</div>`
          : empty('🎯', 'Sem partidas ainda', 'Joga para ver as estatísticas aqui.');
      } catch { $('#pf-stats').innerHTML = '<p class="muted">Sem dados offline.</p>'; }

      // Histórico
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
