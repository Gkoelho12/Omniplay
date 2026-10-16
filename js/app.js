/* OmniPlay · shell da aplicação: arranque, router, passaporte, login, hub (carrossel infinito) */
(function (O) {
  const { $, $$, esc, avatar, levelInfo, toast, openModal, LS, AVATARS } = O.util;
  const B = O.Backend;

  O.views = O.views || {};
  const app = (O.app = { current: null, params: null, currentView: null });

  /* ================= Router ================= */
  app.nav = function (name, params = {}) {
    const root = $('#view');
    if (app.currentView && app.currentView.destroy) app.currentView.destroy();
    app.current = name; app.params = params;
    app.currentView = O.views[name];
    root.className = 'view view-' + name;
    root.innerHTML = '';
    O.views[name].render(root, params);
    root.classList.remove('enter'); void root.offsetWidth; root.classList.add('enter');
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.nav === name || (name === 'profile' && false)));
    $('#topbar').classList.toggle('hidden-bar', name === 'game');
    window.scrollTo(0, 0);
  };

  /* ================= Passaporte Omni ================= */
  function renderPassport() {
    const me = B.me(), li = levelInfo(me.xp);
    $('#passport').innerHTML = `
      ${avatar(me, 44)}
      <span class="pp-text">
        <b>${esc(me.display_name || me.username)}${B.account ? '' : ' <small>(convidado)</small>'}</b>
        <span class="pp-lvl">Nv ${li.level}<span class="pp-bar"><i style="width:${li.pct}%"></i></span></span>
      </span>
      <span class="pp-coins" title="Moedas Omni">🪙 ${me.coins}</span>`;

    const loginBtn = $('#btn-top-login');
    if (loginBtn) {
      loginBtn.style.display = B.account ? 'none' : 'inline-flex';
    }
  }

  function renderNet() {
    const pill = $('#net-pill'), q = LS.get('queue', []).length;
    let cls, txt;
    if (!navigator.onLine) { cls = 'off'; txt = 'Offline'; }
    else if (!B.configured) { cls = 'local'; txt = 'Modo local'; }
    else if (B.account) { cls = 'on'; txt = 'Online'; }
    else { cls = 'guest'; txt = 'Convidado'; }
    if (q) txt += ` · ${q} por sincronizar`;
    pill.className = 'net-pill ' + cls;
    pill.querySelector('span').textContent = txt;
  }

  app.refreshBadge = async function () {
    const badge = $('#friend-badge');
    if (!B.canNet) { badge.hidden = true; return; }
    try {
      const { data } = await B.getFriends();
      badge.hidden = !data.incoming.length; badge.textContent = data.incoming.length;
    } catch { /* ignore */ }
  };

  /** Pede conta quando uma funcionalidade a exige */
  app.requireAccount = function (reason) {
    if (B.account) return true;
    toast(reason || 'Entra na tua conta para usar esta funcionalidade.', { type: 'warn' });
    app.openAuth();
    return false;
  };

  /* ================= Login / Registo ================= */
  app.openAuth = function (tab = 'login', opts = {}) {
    if (document.querySelector('.modal-auth')) return;

    let avIdx = Math.floor(Math.random() * AVATARS.length);
    let hue = Math.floor(Math.random() * 360);
    const savedAccounts = B.getSavedAccounts ? B.getSavedAccounts() : [];

    const modeBadge = B.configured
      ? `<div class="auth-mode-pill on"><i class="auth-dot"></i><span>Servidor Online Supabase</span></div>`
      : `<div class="auth-mode-pill local"><i class="auth-dot"></i><span>Modo Local · Contas guardadas no navegador</span></div>`;

    const savedHtml = savedAccounts.length
      ? `<div class="auth-saved-box">
          <span class="auth-saved-label">Contas neste dispositivo:</span>
          <div class="auth-saved-list">
            ${savedAccounts.map((a) => `
              <button type="button" class="auth-acc-chip" data-u="${esc(a.username)}" title="Entrar como @${esc(a.username)}">
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
              <circle cx="32" cy="32" r="26" fill="none" stroke="url(#lg1)" stroke-width="6"/>
              <path d="M20 32c0-5 3.5-8 7-8 6 0 5 16 11 16 3.5 0 7-3 7-8" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>
            </svg>
          </div>
          <h2>Passaporte OmniPlay</h2>
          <p class="auth-subtitle">Inicia sessão para guardar o teu nível, moedas e histórico de jogo.</p>
          ${modeBadge}
        </div>

        ${savedHtml}

        <div class="tabs auth-tabs">
          <button type="button" data-t="login" class="tab ${tab === 'login' ? 'active' : ''}">🔑 Iniciar Sessão</button>
          <button type="button" data-t="register" class="tab ${tab === 'register' ? 'active' : ''}">✨ Criar Conta</button>
        </div>

        <form id="auth-form" autocomplete="on">
          <label class="field">
            <span>Username</span>
            <div class="field-wrap">
              <span class="field-ic">👤</span>
              <input id="au-user" name="username" autocomplete="username" maxlength="16" placeholder="ex.: jogador_1" required spellcheck="false">
            </div>
          </label>

          <label class="field">
            <span>Password</span>
            <div class="field-wrap field-pass-wrap">
              <span class="field-ic">🔒</span>
              <input id="au-pass" name="password" type="password" autocomplete="current-password" minlength="4" placeholder="mínimo 4 caracteres" required>
              <button type="button" class="btn-eye" id="au-eye" aria-label="Ver password" title="Mostrar/ocultar password">👁️</button>
            </div>
          </label>

          <div class="reg-only" id="au-reg-fields" style="${tab === 'register' ? '' : 'display:none;'}">
            <div class="field">
              <span>Pré-visualização do teu Avatar</span>
              <div class="auth-preview-card">
                <div id="au-preview-avatar">
                  ${avatar({ avatar: AVATARS[avIdx], color: hue, xp: 0 }, 62)}
                </div>
                <div class="auth-preview-details">
                  <b id="au-preview-name">@jogador</b>
                  <small class="muted">Nível 1 · Guardado no teu perfil</small>
                </div>
              </div>
            </div>

            <div class="field">
              <span>Escolhe o teu Avatar</span>
              <div class="av-pick" id="au-avs">
                ${AVATARS.map((a, i) => `<button type="button" class="av-opt ${i === avIdx ? 'sel' : ''}" data-i="${i}" data-a="${a}">${a}</button>`).join('')}
              </div>
            </div>

            <label class="field">
              <span>Cor do teu Aura</span>
              <input id="au-hue" type="range" min="0" max="360" value="${hue}" class="hue-range">
            </label>
          </div>

          <div class="form-err" id="au-err" role="alert"></div>

          <button class="btn btn-neon btn-lg auth-submit-btn" id="au-submit" type="submit">
            ${tab === 'login' ? 'Entrar no OmniPlay 🚀' : 'Criar Conta e Jogar 🎉'}
          </button>
        </form>

        <div class="auth-divider"><span>ou</span></div>
        <button class="btn btn-ghost auth-guest-btn" id="au-guest" type="button">
          🎮 Continuar como Convidado (jogar sem conta)
        </button>
      </div>`, { cls: 'modal-auth' });

    const el = m.el;
    let mode = tab;

    const updatePreview = () => {
      const uVal = ($('#au-user', el).value.trim().toLowerCase()) || 'jogador';
      const prevAv = $('#au-preview-avatar', el);
      const prevNm = $('#au-preview-name', el);
      if (prevAv) prevAv.innerHTML = avatar({ avatar: AVATARS[avIdx], color: hue, xp: 0 }, 62);
      if (prevNm) prevNm.textContent = '@' + uVal;
    };

    const setTab = (t) => {
      mode = t;
      $$('.tab', el).forEach((b) => b.classList.toggle('active', b.dataset.t === t));
      const regFields = $('#au-reg-fields', el);
      if (regFields) regFields.style.display = t === 'register' ? '' : 'none';
      $('#au-submit', el).textContent = t === 'login' ? 'Entrar no OmniPlay 🚀' : 'Criar Conta e Jogar 🎉';
      $('#au-pass', el).autocomplete = t === 'login' ? 'current-password' : 'new-password';
      $('#au-err', el).textContent = '';
      if (t === 'register') updatePreview();
    };

    $$('.tab', el).forEach((b) => b.addEventListener('click', () => setTab(b.dataset.t)));

    // Eye toggle
    let showPass = false;
    const eyeBtn = $('#au-eye', el);
    const passInput = $('#au-pass', el);
    if (eyeBtn && passInput) {
      eyeBtn.onclick = () => {
        showPass = !showPass;
        passInput.type = showPass ? 'text' : 'password';
        eyeBtn.textContent = showPass ? '🙈' : '👁️';
      };
    }

    // Avatar picker
    $$('.av-opt', el).forEach((b) => b.addEventListener('click', () => {
      avIdx = +b.dataset.i;
      $$('.av-opt', el).forEach((x) => x.classList.toggle('sel', x === b));
      updatePreview();
    }));

    // Hue slider
    const hueInput = $('#au-hue', el);
    if (hueInput) {
      hueInput.addEventListener('input', (e) => {
        hue = +e.target.value;
        updatePreview();
      });
    }

    // Username input update for live preview
    const userInput = $('#au-user', el);
    if (userInput) {
      userInput.addEventListener('input', () => {
        if (mode === 'register') updatePreview();
      });
    }

    // Saved accounts click
    $$('.auth-acc-chip', el).forEach((b) => {
      b.onclick = () => {
        const u = b.dataset.u;
        userInput.value = u;
        setTab('login');
        passInput.focus();
      };
    });

    // Guest button
    $('#au-guest', el).addEventListener('click', () => {
      LS.set('skipAuth', true);
      sessionStorage.setItem('omni.guestSession', 'true');
      m.close();
      toast('A jogar em modo <b>Convidado</b>. Podes iniciar sessão a qualquer momento no botão Entrar!', { type: 'good', ms: 4000 });
    });

    // Submit form
    $('#auth-form', el).addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#au-submit', el), err = $('#au-err', el);
      err.textContent = '';
      btn.disabled = true;
      btn.classList.add('loading');
      try {
        const u = $('#au-user', el).value.trim();
        const p = $('#au-pass', el).value;
        if (mode === 'login') {
          await B.signIn(u, p);
        } else {
          await B.signUp(u, p, AVATARS[avIdx], hue);
        }
        m.close();
        toast(`Bem-vindo, <b>${esc(B.user.display_name || B.user.username)}</b>! 🚀`, { type: 'good', ms: 4000 });
      } catch (ex) {
        err.textContent = ex.message || 'Algo correu mal. Verifica os dados.';
      }
      btn.disabled = false;
      btn.classList.remove('loading');
    });

    setTab(tab);
    setTimeout(() => $('#au-user', el)?.focus(), 300);
  };

  /* ================= HUB: carrossel infinito ================= */
  O.views.hub = (function () {
    let idx = 0, keyHandler, wheelLock = false;

    function render(root) {
      const games = O.games.list;
      root.innerHTML = `
        <section class="hub">
          <div class="hero">
            <p class="eyebrow">Multiverso de jogos</p>
            <h1>Todos os jogos.<br><span class="grad">Um só universo.</span></h1>
            <p class="lead">Joga online com amigos, ou no mesmo dispositivo. Sem internet? Também funciona.</p>
            <button class="btn btn-roulette" id="roulette"><span class="dice">🎲</span><span>Roleta Omni</span></button>
          </div>
          <div class="carousel" id="carousel" tabindex="0" aria-label="Jogos disponíveis">
            ${games.map((g, i) => `
              <article class="portal-card ${g.soon ? 'soon' : ''}" data-i="${i}" style="--hue:${g.hue}" role="button" aria-label="${esc(g.name)}">
                <div class="pc-rings"><i></i><i></i><i></i></div>
                <div class="pc-icon">${g.icon}</div>
                <h3>${esc(g.name)}</h3>
                <p>${esc(g.tagline)}</p>
                <span class="pc-tag">${g.soon ? 'Em breve' : g.minPlayers + '–' + g.maxPlayers + ' jogadores'}</span>
              </article>`).join('')}
            <button class="car-arrow left" id="car-prev" aria-label="Anterior">‹</button>
            <button class="car-arrow right" id="car-next" aria-label="Seguinte">›</button>
          </div>
          <div class="game-info glass" id="ginfo"></div>
          <div class="dots" id="dots">${games.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>
        </section>`;
      const first = games.findIndex((g) => !g.soon);
      idx = Math.max(0, first);
      layout();

      const car = $('#carousel');
      $('#car-prev').onclick = () => go(-1);
      $('#car-next').onclick = () => go(1);
      $$('.portal-card', car).forEach((c) => c.addEventListener('click', () => {
        const i = +c.dataset.i;
        if (i !== idx) { idx = i; layout(); } else launch();
      }));
      $$('#dots i').forEach((d) => d.addEventListener('click', () => { idx = +d.dataset.i; layout(); }));
      $('#roulette').onclick = () => O.play.roulette();

      let sx = null;
      car.addEventListener('pointerdown', (e) => { sx = e.clientX; });
      car.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 50) go(e.clientX < sx ? 1 : -1); sx = null; });
      car.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) < 8 || wheelLock) return;
        wheelLock = true; go(e.deltaX > 0 ? 1 : -1); setTimeout(() => (wheelLock = false), 350);
      }, { passive: true });
      keyHandler = (e) => {
        if (O.app.current !== 'hub' || document.querySelector('.modal-back')) return;
        if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === 'Enter' && document.activeElement === car) launch();
      };
      document.addEventListener('keydown', keyHandler);
    }

    function go(dir) { const n = O.games.list.length; idx = (idx + dir + n) % n; layout(); }

    function layout() {
      const games = O.games.list, n = games.length;
      const narrow = window.innerWidth < 720, step = narrow ? 175 : 285;
      $$('.portal-card').forEach((c, i) => {
        let d = ((i - idx) % n + n) % n; if (d > n / 2) d -= n;
        const a = Math.abs(d);
        c.classList.toggle('active', d === 0);
        c.style.transform = `translateX(calc(-50% + ${d * step}px)) translateZ(${-a * 140}px) rotateY(${-d * 26}deg) scale(${1 - a * 0.1})`;
        c.style.opacity = a > 2 ? 0 : 1 - a * 0.28;
        c.style.zIndex = 10 - a;
        c.style.pointerEvents = a > 2 ? 'none' : 'auto';
        c.tabIndex = d === 0 ? 0 : -1;
      });
      $$('#dots i').forEach((d, i) => d.classList.toggle('on', i === idx));
      const g = games[idx];
      $('#ginfo').style.setProperty('--hue', g.hue);
      $('#ginfo').innerHTML = `
        <div class="gi-main"><h2>${esc(g.name)}</h2><p>${esc(g.tagline)}</p>
          <div class="chips"><span class="chip">🧑‍🤝‍🧑 ${g.minPlayers}–${g.maxPlayers} jogadores</span><span class="chip">📱 Mesmo dispositivo</span>
          <span class="chip">🌐 Online</span><span class="chip">✈️ Funciona offline</span></div></div>
        <button class="btn btn-neon btn-lg" id="play-btn" ${g.soon ? 'disabled' : ''}>${g.soon ? 'Em breve' : 'Jogar'}</button>`;
      const pb = $('#play-btn'); if (pb) pb.onclick = launch;
    }

    function launch() {
      const g = O.games.list[idx];
      if (g.soon) return toast('Este jogo chega em breve! 🚀');
      if (g.id === 'mexicana') {
        window.location.href = 'mexicana.html';
        return;
      }
      O.play.openSetup(g);
    }

    window.addEventListener('resize', () => { if (O.app.current === 'hub') layout(); });
    return { render, destroy() { document.removeEventListener('keydown', keyHandler); } };
  })();

  /* ================= Fundo animado (estrelas) ================= */
  function startBackground() {
    const cv = $('#bg'), ctx = cv.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W, H, stars = [];
    const resize = () => {
      W = cv.width = innerWidth; H = cv.height = innerHeight;
      stars = Array.from({ length: Math.round((W * H) / 9000) }, () => ({
        x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.9 + 0.1,
        h: [190, 265, 28, 320][Math.floor(Math.random() * 4)], tw: Math.random() * 6
      }));
    };
    resize(); addEventListener('resize', resize);
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

  /* ================= Arranque ================= */
  async function boot() {
    startBackground();
    await B.init();

    const refresh = () => { renderPassport(); renderNet(); };
    ['profile', 'net', 'queue', 'presence'].forEach((e) => B.on(e, refresh));
    B.on('auth', () => {
      refresh(); app.refreshBadge();
      if (['friends', 'profile', 'ranking'].includes(app.current)) app.nav(app.current === 'profile' ? 'profile' : app.current, app.current === 'profile' ? { self: true } : app.params);
    });
    B.on('invite', (p) => {
      const g = O.games.get(p.game);
      if (!g) return;
      toast(`<b>${esc(p.from.display_name)}</b> convidou-te para <b>${esc(g.name)}</b> (sala ${esc(p.room)})`, {
        type: 'good', ms: 20000, actions: [{ label: 'Entrar', onClick: () => O.play.joinByCode(p.room, g.id) }]
      });
    });
    refresh();

    $$('.nav-btn').forEach((b) => b.addEventListener('click', () => {
      if (O.play.inGame()) return O.play.confirmLeave(() => app.nav(b.dataset.nav));
      app.nav(b.dataset.nav);
    }));
    $('#brand').addEventListener('click', (e) => { e.preventDefault(); if (O.play.inGame()) O.play.confirmLeave(() => app.nav('hub')); else app.nav('hub'); });
    $('#passport').addEventListener('click', () => app.nav('profile', { self: true }));

    const topLogin = $('#btn-top-login');
    if (topLogin) topLogin.addEventListener('click', () => app.openAuth('login'));

    O.openAuth = app.openAuth;

    app.nav('hub');
    app.refreshBadge();
    setInterval(app.refreshBadge, 60000);

    // Ecrã de Login ao entrar no site:
    if (!B.account) {
      setTimeout(() => app.openAuth('login', { onEntry: true }), 320);
    } else {
      setTimeout(() => {
        toast(`Bem-vindo de volta, <b>${esc(B.user.display_name || B.user.username)}</b>! 👋`, { type: 'good', ms: 3000 });
      }, 400);
    }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window.Omni);
