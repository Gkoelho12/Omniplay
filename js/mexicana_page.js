/* OmniPlay · Controlador dedicado da página mexicana.html */
(function (O) {
  const { $, $$, esc, avatar, toast, openModal, sleep, uid, LS, PCOL, AVATARS, REWARD, levelInfo } = O.util;
  const B = O.Backend;
  const SEAT_HUE = [190, 330, 48, 265, 160, 28];

  let currentSession = null;
  let currentRoom = null;

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

  /* ============ Ecrã de Configuração Inicial ============ */
  function renderSetup() {
    const root = $('#game-root');
    const game = O.games.get('mexicana');
    const me = B.me();
    const urlParams = new URLSearchParams(window.location.search);
    let n = parseInt(urlParams.get('players'), 10);
    if (!(n >= 2 && n <= 6)) n = 2;

    const saved = LS.get('localNames', []);
    const names = Array.from({ length: 6 }, (_, i) => (i === 0 ? me.display_name || me.username : saved[i] || `Jogador ${i + 1}`));

    const canOnline = B.configured && B.account && navigator.onLine;

    function drawSetup() {
      root.innerHTML = `
        <div class="mx-setup-container glass" style="--hue:330">
          <div class="setup-head">
            <span class="setup-ic big">🃏</span>
            <div>
              <h2>Mexicana</h2>
              <p class="muted">2 a 6 jogadores · 56 cartas (com 4 Jokers) · poderes especiais e regras completas</p>
            </div>
          </div>

          <div class="field">
            <span>Número de jogadores</span>
            <div class="pills">
              ${[2, 3, 4, 5, 6].map((x) => `<button type="button" class="pill ${x === n ? 'on' : ''}" data-n="${x}">${x} Jogadores</button>`).join('')}
            </div>
          </div>

          <div class="field">
            <span>Nomes dos jogadores</span>
            <div class="name-list">
              ${Array.from({ length: n }, (_, i) => `
                <label class="name-row" style="--c:${PCOL[i]}">
                  <i></i>
                  <input data-i="${i}" maxlength="14" value="${esc(names[i])}" placeholder="Jogador ${i + 1}">
                </label>`).join('')}
            </div>
          </div>

          <div class="edit-actions" style="margin-top: 18px;">
            <button class="btn btn-neon btn-lg" id="btn-start-local" type="button">Começar Partida ▸</button>
            ${canOnline ? `<button class="btn btn-ghost" id="btn-online-room" type="button">🌐 Criar Sala Online</button>` : ''}
          </div>
        </div>`;

      $$('.pill', root).forEach((b) => (b.onclick = () => { n = +b.dataset.n; drawSetup(); }));
      $$('.name-row input', root).forEach((inp) => inp.addEventListener('input', () => (names[+inp.dataset.i] = inp.value)));

      $('#btn-start-local', root).onclick = () => {
        LS.set('localNames', names);
        const players = names.slice(0, n).map((nm, i) => ({
          seat: i, name: nm.trim() || `Jogador ${i + 1}`,
          userId: i === 0 && B.user ? B.user.id : null,
          avatar: i === 0 ? me.avatar : AVATARS[(AVATARS.indexOf(me.avatar) + 4 * i + 3) % AVATARS.length],
          color: SEAT_HUE[i],
          xp: i === 0 ? me.xp : 0
        }));
        launchLocalGame(game, players);
      };

      const btnOnline = $('#btn-online-room', root);
      if (btnOnline) {
        btnOnline.onclick = () => {
          if (O.play && O.play.openSetup) O.play.openSetup(game);
        };
      }
    }

    drawSetup();
  }

  /* ============ Iniciar Partida Local ============ */
  function launchLocalGame(game, players) {
    if (currentSession) currentSession.destroy();
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

    $('#gs-exit').onclick = confirmExit;
  }

  /* ============ Barra de Jogadores ============ */
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

  /* ============ Fim de Partida ============ */
  function handleFinish(session, res) {
    if (currentSession !== session) return;
    const byseat = Object.fromEntries(res.map((r) => [r.seat, r]));
    const mySeat = session.role === 'local' ? 0 : session.mySeats[0];
    const mine = byseat[mySeat];
    const rw = REWARD[mine ? mine.result : 'loss'] || REWARD.loss;

    if (session.role !== 'guest') B.submitMatch(session.record());

    const order = [...res].sort((a, b) => (a.result === 'win' ? 0 : a.result === 'draw' ? 1 : 2) - (b.result === 'win' ? 0 : b.result === 'draw' ? 1 : 2) || b.score - a.score);
    const winners = res.filter((r) => r.result === 'win');
    const title = winners.length === 1 ? `${esc(session.players[winners[0].seat].name)} venceu!` : winners.length > 1 ? 'Vitória partilhada!' : 'Empate!';
    const xpFor = session.role === 'local' ? session.players[0].name : 'Tu';

    const m = openModal(`<div class="results ${mine ? mine.result : 'loss'}">
      <div class="res-burst"></div>
      <p class="eyebrow">🃏 Mexicana</p>
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
        <button class="btn btn-ghost" id="rs-setup" type="button">Alterar Jogadores</button>
        <button class="btn btn-neon btn-lg" id="rs-again" type="button">Jogar Outra Vez</button>
        <a class="btn btn-ghost" href="index.html" id="rs-exit">Menu Principal</a>
      </div>
    </div>`, { cls: 'modal-results', locked: true });

    const el = m.el;
    $('#rs-setup', el).onclick = () => { m.close(); currentSession.destroy(); currentSession = null; renderSetup(); };
    $('#rs-again', el).onclick = () => {
      m.close();
      launchLocalGame(session.game, session.players);
    };
  }

  /* ============ Confirmação de Saída ============ */
  function confirmExit() {
    if (!currentSession || currentSession.finished) {
      window.location.href = 'index.html';
      return;
    }
    const m = openModal(`<div class="confirm">
      <h2>Sair da partida?</h2>
      <p class="muted">O progresso desta partida será perdido.</p>
      <div class="edit-actions" style="margin-top: 18px;">
        <button class="btn btn-ghost" id="cf-stay" type="button">Ficar</button>
        <button class="btn btn-neon danger-btn" id="cf-leave" type="button">Sair para o Menu</button>
      </div>
    </div>`);
    $('#cf-stay', m.el).onclick = () => m.close();
    $('#cf-leave', m.el).onclick = () => {
      m.close();
      if (currentSession) currentSession.destroy();
      window.location.href = 'index.html';
    };
  }

  /* ============ Inicialização da Página ============ */
  async function boot() {
    startBackground();
    await B.init();

    $('#btn-rules').onclick = openRules;
    $('#btn-exit-top').onclick = (e) => {
      if (currentSession && !currentSession.finished) {
        e.preventDefault();
        confirmExit();
      }
    };
    $('#btn-back-brand').onclick = (e) => {
      if (currentSession && !currentSession.finished) {
        e.preventDefault();
        confirmExit();
      }
    };

    const me = B.me();
    const up = $('#mx-user-pill');
    if (up) {
      up.innerHTML = `${avatar(me, 26)} <span class="mx-user-name">${esc(me.display_name || me.username)}</span>`;
      up.title = B.account ? 'Sessão iniciada' : 'Modo convidado';
    }

    renderSetup();
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window.Omni);
