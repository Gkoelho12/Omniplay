/* Mexicana — 2 a 6 jogadores · baralho de 52 cartas + 4 jokers (56 cartas)
 *
 * Fases:  setup  (cada um escolhe 3 das 6 cartas para ficarem viradas para cima)
 *         start  (quem tem a carta mais baixa sem "poderes" joga primeiro)
 *         play   (jogo normal, sentido do relógio)
 *         over
 *
 * Ordem (crescente): 4 5 6 7 8 9 J Q K A | 2 3 10 Joker
 * Poderes: 2 = reinicia · 3 = espelho · 7 = cima/baixo · 8 = bloqueia · 10 e Joker = limpam a mesa
 * Quatro cartas iguais seguidas no topo do monte também o limpam (o 3 nunca conta).
 */
(function (O) {
  const { esc, PCOL, openModal, avatar } = O.util;

  /* ============ Cartas ============ */
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  const ORDER = { '4': 0, '5': 1, '6': 2, '7': 3, '8': 4, '9': 5, J: 6, Q: 7, K: 8, A: 9, '2': 10, '3': 11, '10': 12, X: 13 };
  const ORDER_NAME = ['4', '5', '6', '7', '8', '9', 'J', 'Q', 'K', 'A', '2', '3', '10', 'Joker'];
  const POWER = new Set(['2', '3', '7', '8', '10', 'X']);
  const CLEAN = new Set(['10', 'X']);
  const GLYPH = { '2': '↺', '3': '🪞', '7': '↕', '8': '⛔', '10': '🧹', X: '🧹' };
  const SEVEN = ORDER['7'], EIGHT = ORDER['8'];
  const HUE = 330;

  const rk = (id) => (id >= 52 ? 'X' : RANKS[id % 13]);
  const su = (id) => (id >= 52 ? -1 : Math.floor(id / 13));
  const ord = (id) => ORDER[rk(id)];
  const cardTxt = (id) => (rk(id) === 'X' ? '🃏' : rk(id) + SUITS[su(id)]);
  const byOrder = (a, b) => ord(a) - ord(b) || su(a) - su(b);

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function nextSeq(s) {
    s.seq = (s.seq || 0) + 1;
    return s.seq;
  }

  /* ============ Regras ============ */
  /** valor efetivo da carta no topo: índice da ordem, ou null (mesa vazia / reiniciada por um 2) */
  function effAt(center, upto) {
    let e = null;
    for (let i = 0; i <= upto; i++) {
      const r = rk(center[i]);
      if (r === '2') e = null; else if (r !== '3') e = ORDER[r];
    }
    return e;
  }
  const effTop = (c) => (c.length ? effAt(c, c.length - 1) : null);

  /** esta carta (rank) pode ser jogada agora? */
  function playable(s, r) {
    if (r === '2' || r === '3' || r === '10' || r === 'X') return true;
    const e = effTop(s.center);
    if (e == null) return true;
    const o = ORDER[r];
    if (e === SEVEN && s.dir === 'down') return o <= SEVEN;
    if (e === SEVEN && s.dir === 'up') return o >= SEVEN;
    return o >= e;
  }

  /** jogada composta por várias cartas: iguais entre si (ou 10/Joker misturados), mais 3s que copiam */
  function group(s, ids) {
    if (!ids.length || new Set(ids).size !== ids.length) return null;
    const base = ids.filter((i) => rk(i) !== '3'), threes = ids.filter((i) => rk(i) === '3');
    const allClean = base.length > 0 && base.every((i) => CLEAN.has(rk(i)));
    if (!allClean && new Set(base.map(rk)).size > 1) return null;
    if (base.length && !playable(s, rk(base[0]))) return null;
    if (s.turnPlays > 0 && base.length && (s.turnRank == null || rk(base[0]) !== s.turnRank)) return null;
    return { base, threes };
  }

  function validPlay(s, ids) {
    const g = group(s, ids);
    if (!g) return null;
    if (s.phase === 'start') {
      if (s.startRank === '3') return g.base.length ? null : g;
      if (!g.base.length || g.base.some((i) => rk(i) !== s.startRank)) return null;
    }
    return g;
  }

  const fourKind = (c) => c.length >= 4 && rk(c[c.length - 1]) !== '3' && c.slice(-4).every((i) => rk(i) === rk(c[c.length - 1]));
  const finished = (s, seat) => !s.hands[seat].length && !s.faceUp[seat].length && !s.hidden[seat].length;
  const nm = (s, seat) => `<b>${esc(s.names[seat])}</b>`;
  function say(s, html) { s.log.push(html); if (s.log.length > 6) s.log.shift(); }

  /** repõe a mão até 3 cartas; sem baralho e sem mão, pega as cartas viradas para cima */
  function refill(s, seat) {
    const h = s.hands[seat];
    const drawn = [];
    while (h.length < 3 && s.stock.length) {
      const c = s.stock.pop();
      h.push(c);
      drawn.push(c);
    }
    if (!h.length && !s.stock.length && s.faceUp[seat].length) {
      h.push(...s.faceUp[seat].splice(0));
      say(s, `${nm(s, seat)} pegou as cartas viradas para cima`);
    }
    return drawn;
  }

  function advance(s, steps) {
    s.turn = (s.turn + steps) % s.n;
    s.turnPlays = 0; s.turnRank = null; s.canEnd = false; s.pending = null;
  }

  function endTurn(s, evt) {
    s.canEnd = false;
    const e = effTop(s.center);
    if (s.turnPlays > 0 && e === SEVEN) { s.pending = 'dir'; return; }
    let skip = 0;
    const blockedSeats = [];
    if (s.turnPlays > 0 && e === EIGHT) {
      for (let i = s.center.length - 1; i >= 0 && skip < s.turnPlays; i--) {
        const r = rk(s.center[i]);
        if (r !== '8' && !(r === '3' && effAt(s.center, i) === EIGHT)) break;
        skip++;
      }
      // Nunca bloqueia o próprio jogador que jogou (no máximo bloqueia todos os s.n - 1 adversários e volta a jogar)
      skip = Math.min(skip, Math.max(0, s.n - 1));
      for (let k = 1; k <= skip; k++) blockedSeats.push((s.turn + k) % s.n);
      if (skip) say(s, `⛔ ${skip} jogador${skip > 1 ? 'es' : ''} bloqueado${skip > 1 ? 's' : ''}`);
    }
    if (evt && blockedSeats.length) evt.blockedSeats = blockedSeats;
    advance(s, 1 + skip);
  }

  function doPlay(s, seat, g, extraEvt = {}) {
    const cards = [...g.base, ...g.threes];
    s.dir = null;
    s.center.push(...cards);
    s.turnPlays += cards.length;
    if (g.base.length) {
      s.turnRank = rk(g.base[0]);
    } else {
      const e = effTop(s.center);
      s.turnRank = e != null ? (ORDER_NAME[e] === 'Joker' ? 'X' : ORDER_NAME[e]) : '3';
    }
    say(s, `${nm(s, seat)} jogou ${cards.map(cardTxt).join(' ')}`);

    const hasCleanCard = g.base.some((i) => CLEAN.has(rk(i)));
    const isFour = !hasCleanCard && fourKind(s.center);
    if (hasCleanCard || isFour) {
      const cleared = [...s.center];
      const cleanKind = isFour ? 'four' : cards.some((i) => rk(i) === 'X') ? 'joker' : 'ten';
      s.discard.push(...s.center); s.center = [];
      s.turnPlays = 0; s.turnRank = null; s.canEnd = false;
      say(s, `🧹 ${nm(s, seat)} limpou a mesa e joga outra vez`);
      const drawn = refill(s, seat);
      if (finished(s, seat)) { s.phase = 'over'; s.winner = seat; }
      s.evt = {
        id: nextSeq(s),
        type: 'clean',
        seat,
        cards,
        cleared,
        cleanKind,
        drawnCount: drawn.length,
        ...extraEvt
      };
      return s;
    }

    const drawn = refill(s, seat);
    const topR = g.base.length ? rk(g.base[0]) : '3';
    const power = topR === '2' ? 'reset' : topR === '7' ? 'seven' : topR === '8' ? 'block' : g.threes.length ? 'mirror' : null;
    const evt = {
      id: nextSeq(s),
      type: 'play',
      seat,
      cards,
      power,
      drawnCount: drawn.length,
      lucky: false,
      blockedSeats: [],
      ...extraEvt
    };
    s.evt = evt;

    if (finished(s, seat)) { s.phase = 'over'; s.winner = seat; return s; }
    const can = s.hands[seat].some((i) => rk(i) === '3' || (s.turnRank != null && rk(i) === s.turnRank));
    if (drawn.length) {
      const lucky = drawn.some((i) => rk(i) === '3' || (s.turnRank != null && rk(i) === s.turnRank));
      if (lucky) {
        evt.lucky = true;
        say(s, `✨ ${nm(s, seat)} comprou ${drawn.map(cardTxt).join(' ')} — pode jogar por cima!`);
      }
    }
    if (can) s.canEnd = true; else endTurn(s, evt);
    return s;
  }

  function startPhase(s) {
    let best = Infinity;
    for (const h of s.hands) for (const i of h) if (!POWER.has(rk(i))) best = Math.min(best, ord(i));
    const nonPower = best !== Infinity;
    if (!nonPower) for (const h of s.hands) for (const i of h) best = Math.min(best, ord(i));
    s.starters = [];
    s.hands.forEach((h, seat) => { if (h.some((i) => ord(i) === best && (nonPower ? !POWER.has(rk(i)) : true))) s.starters.push(seat); });
    s.startRank = ORDER_NAME[best] === 'Joker' ? 'X' : ORDER_NAME[best];
    s.phase = 'start';
    say(s, s.starters.length === 1
      ? `${nm(s, s.starters[0])} tem a carta mais baixa (${s.startRank}) e começa`
      : `Empate de ${s.startRank}: quem jogar primeiro começa!`);
  }

  O.games.register({
    id: 'mexicana', name: 'Mexicana',
    tagline: 'Livra-te de todas as cartas: 3 escondidas, 3 à vista e muitos poderes.',
    icon: '🃏', hue: HUE, minPlayers: 2, maxPlayers: 6,

    init(n, { players }) {
      const deck = shuffle(Array.from({ length: 56 }, (_, i) => i));
      const hidden = [], hands = [];
      for (let i = 0; i < n; i++) hidden.push(deck.splice(0, 3));
      for (let i = 0; i < n; i++) hands.push(deck.splice(0, 6));
      return {
        n, phase: 'setup', names: players.map((p) => p.name),
        stock: deck, center: [], discard: [], hands, hidden, faceUp: Array.from({ length: n }, () => []),
        ready: Array(n).fill(false), starters: [], startRank: null,
        turn: 0, turnPlays: 0, turnRank: null, dir: null, pending: null, canEnd: false,
        winner: -1, flip: null, seq: 0, evt: null,
        log: ['As cartas foram dadas. Escolhe 3 para ficarem à vista.']
      };
    },

    reduce(s, a, seat) {
      if (s.phase === 'over') return null;

      /* --- escolha das cartas à vista --- */
      if (a.type === 'setup') {
        if (s.phase !== 'setup' || s.ready[seat] || !Array.isArray(a.ids)) return null;
        const ids = a.ids;
        if (ids.length !== 3 || new Set(ids).size !== 3 || !ids.every((i) => s.hands[seat].includes(i))) return null;
        s.faceUp[seat] = [...ids].sort(byOrder);
        s.hands[seat] = s.hands[seat].filter((i) => !ids.includes(i));
        s.ready[seat] = true;
        if (s.ready.every(Boolean)) {
          startPhase(s);
          s.evt = { id: nextSeq(s), type: 'start', starters: s.starters, startRank: s.startRank };
        }
        return s;
      }

      /* --- jogar cartas da mão (na fase "start" o primeiro a jogar começa) --- */
      if (a.type === 'play') {
        if (!Array.isArray(a.ids)) return null;
        if (s.phase === 'start') { if (!s.starters.includes(seat)) return null; }
        else if (s.phase !== 'play' || seat !== s.turn || s.pending) return null;
        if (!a.ids.every((i) => s.hands[seat].includes(i))) return null;
        const g = validPlay(s, a.ids);
        if (!g) return null;
        if (s.phase === 'start') { s.phase = 'play'; s.turn = seat; }
        s.hands[seat] = s.hands[seat].filter((i) => !a.ids.includes(i));
        return doPlay(s, seat, g);
      }

      if (s.phase !== 'play' || seat !== s.turn) return null;

      /* --- escolher cima/baixo depois de um 7 --- */
      if (a.type === 'dir') {
        if (s.pending !== 'dir' || (a.dir !== 'up' && a.dir !== 'down')) return null;
        s.dir = a.dir;
        say(s, `↕ ${nm(s, seat)} escolheu <b>${a.dir === 'up' ? 'ACIMA' : 'ABAIXO'}</b> do 7`);
        s.evt = { id: nextSeq(s), type: 'dir', seat, dir: a.dir };
        advance(s, 1);
        return s;
      }
      if (s.pending) return null;

      /* --- terminar a jogada (quando ainda podia jogar mais cartas iguais) --- */
      if (a.type === 'end') {
        if (!s.turnPlays || !s.canEnd) return null;
        const evt = { id: nextSeq(s), type: 'end', seat, blockedSeats: [] };
        endTurn(s, evt);
        if (evt.blockedSeats.length || s.pending === 'dir') s.evt = evt;
        return s;
      }

      /* --- pegar as cartas do meio --- */
      if (a.type === 'take') {
        if (s.turnPlays || !s.center.length) return null;
        const taken = [...s.center];
        say(s, `${nm(s, seat)} pegou ${s.center.length} carta${s.center.length > 1 ? 's' : ''} do meio`);
        s.hands[seat].push(...s.center);
        s.center = []; s.dir = null;
        const drawn = refill(s, seat);
        s.evt = { id: nextSeq(s), type: 'take', seat, taken, drawnCount: drawn.length };
        advance(s, 1);
        return s;
      }

      /* --- carta virada para baixo (às cegas) --- */
      if (a.type === 'blind') {
        if (s.turnPlays || s.hands[seat].length || s.faceUp[seat].length || s.stock.length) return null;
        if (!Number.isInteger(a.idx) || a.idx < 0 || a.idx >= s.hidden[seat].length) return null;
        const id = s.hidden[seat].splice(a.idx, 1)[0];
        const ok = playable(s, rk(id));
        s.flip = { seat, id, ok, n: (s.flip ? s.flip.n : 0) + 1 };
        if (ok) return doPlay(s, seat, rk(id) === '3' ? { base: [], threes: [id] } : { base: [id], threes: [] }, { blind: { id, ok: true, idx: a.idx } });
        const taken = [id, ...s.center];
        say(s, `${nm(s, seat)} virou ${cardTxt(id)} e não pode jogar — leva as cartas`);
        s.hands[seat].push(id, ...s.center);
        s.center = []; s.dir = null;
        s.evt = { id: nextSeq(s), type: 'blind_fail', seat, card: id, taken, blind: { id, ok: false, idx: a.idx } };
        advance(s, 1);
        return s;
      }
      return null;
    },

    result(s) {
      if (s.phase !== 'over') return null;
      return Array.from({ length: s.n }, (_, i) => ({
        seat: i, result: i === s.winner ? 'win' : 'loss',
        score: s.hands[i].length + s.faceUp[i].length + s.hidden[i].length
      }));
    },

    info(s) {
      return {
        turn: s.phase === 'play' ? s.turn : null,
        scores: s.hands.map((h, i) => (s.phase === 'over' && s.winner === i ? '🏆 sem cartas' : `✋${h.length} · 👁${s.faceUp[i].length} · 🂠${s.hidden[i].length}`))
      };
    },

    /* ============ Interface & Motor de Animações ============ */
    mount(root, ctx) {
      root.innerHTML = `<div class="mx-wrap" style="--hue:${HUE}"><div class="mx-board"></div><div class="mx-fx"></div><div class="mx-cover" hidden></div></div>`;
      const wrap = root.firstElementChild, board = wrap.querySelector('.mx-board'), fx = wrap.querySelector('.mx-fx'), cover = wrap.querySelector('.mx-cover');
      let cur = null, unlocked = 0, prevCenter = new Set(), lastKey = '', lastEvtId = -1, victoryShown = false;
      const sel = new Set();

      const viewSeat = (s) => {
        if (!ctx.hotseat) return ctx.mySeats[0];
        if (s.phase === 'setup') { const k = s.ready.findIndex((r) => !r); return k < 0 ? 0 : k; }
        if (s.phase === 'start') return s.starters[0];
        if (s.phase === 'over') return s.winner;
        return s.turn;
      };

      function card(id, o = {}) {
        const r = rk(id), s = su(id), tag = o.act ? 'button' : 'div';
        const cls = ['mx-card', r === 'X' ? 'joker' : '', s === 1 || s === 2 ? 'red' : '', POWER.has(r) ? 'power' : '', o.cls || ''].join(' ');
        const at = (o.act ? ` data-act="${o.act}" data-id="${id}" aria-label="${cardTxt(id)}"` : '') + (o.cid != null ? ` data-cid="${o.cid}"` : '');
        const st = o.style ? ` style="${o.style}"` : '';
        if (r === 'X') return `<${tag} class="${cls}"${at}${st}><span class="jk">🃏</span><em>JOKER</em></${tag}>`;
        return `<${tag} class="${cls}"${at}${st}><span class="ix">${r}<i>${SUITS[s]}</i></span><span class="big">${SUITS[s]}</span>`
          + `<span class="ix bot">${r}<i>${SUITS[s]}</i></span>${GLYPH[r] ? `<u class="pw">${GLYPH[r]}</u>` : ''}</${tag}>`;
      }
      const back = (o = {}) => `<${o.act ? 'button' : 'div'} class="mx-card back ${o.cls || ''}"${o.act ? ` data-act="${o.act}" data-i="${o.i}" aria-label="Carta virada para baixo"` : ''}${o.style ? ` style="${o.style}"` : ''}></${o.act ? 'button' : 'div'}>`;

      function need(s) {
        const e = effTop(s.center);
        if (!s.center.length) return 'Mesa vazia — joga qualquer carta';
        if (e == null) return 'Ciclo reiniciado — joga qualquer carta';
        if (e === SEVEN && s.dir === 'down') return 'Abaixo de 7: joga 4, 5, 6 ou 7 · (2, 3, 10 e Joker também)';
        if (e === SEVEN && s.dir === 'up') return 'Acima de 7: joga 7 ou mais · (2, 3, 10 e Joker também)';
        return `Joga ${ORDER_NAME[e]} ou acima · (2, 3, 10 e Joker passam sempre)`;
      }

      function tableRuleBadge(s) {
        if (s.phase === 'setup') return `<span class="mx-rule-pill setup">🂠 Fase de Preparação · Escolhe 3 cartas</span>`;
        if (s.phase === 'start') return `<span class="mx-rule-pill start">⚡ Carta mais baixa (${esc(s.startRank)}) começa!</span>`;
        if (s.phase === 'over') return `<span class="mx-rule-pill over">🏆 Partida Terminada</span>`;
        const e = effTop(s.center);
        if (!s.center.length) return `<span class="mx-rule-pill free">✨ Mesa Livre · Joga qualquer carta</span>`;
        if (e == null) return `<span class="mx-rule-pill reset">↺ Ciclo Reiniciado (2) · Qualquer carta</span>`;
        if (e === SEVEN && s.pending === 'dir') return `<span class="mx-rule-pill seven">↕ 7 na Mesa · A escolher Acima ou Abaixo…</span>`;
        if (e === SEVEN && s.dir === 'down') return `<span class="mx-rule-pill seven-down">↓ Abaixo de 7 (4, 5, 6 ou 7)</span>`;
        if (e === SEVEN && s.dir === 'up') return `<span class="mx-rule-pill seven-up">↑ Acima de 7 (7 ou maior)</span>`;
        const topId = s.center[s.center.length - 1];
        const isMirror = rk(topId) === '3';
        return `<span class="mx-rule-pill active">${isMirror ? '🪞 Espelho → ' : '🎯 Topo: '}<b>${ORDER_NAME[e]}</b> ou superior</span>`;
      }

      function slots(s, i, mine, blind) {
        const n = Math.max(s.hidden[i].length, s.faceUp[i].length);
        let h = '';
        for (let k = 0; k < n; k++) {
          const hb = s.hidden[i][k] != null ? (blind ? back({ act: 'blind', i: k, cls: 'pick' }) : back()) : '';
          const fu = s.faceUp[i][k] != null ? card(s.faceUp[i][k], { cls: 'up' }) : '';
          h += `<div class="mx-slot ${hb ? '' : 'nohid'}">${hb}${fu}</div>`;
        }
        return h || '<span class="mx-none">sem cartas na mesa</span>';
      }

      function oppHTML(s, i) {
        const p = ctx.players[i] || { name: s.names[i], avatar: '🎮', color: 200, xp: 0 };
        const isTurn = (s.phase === 'play' && s.turn === i) || (s.phase === 'start' && s.starters.includes(i));
        const st = s.phase === 'setup' ? (s.ready[i] ? '✓ pronto' : 'a escolher…') : `✋ ${s.hands[i].length}`;
        const nb = Math.min(s.hands[i].length, 7);
        return `<div class="mx-opp ${isTurn ? 'turn' : ''}" data-seat="${i}" style="--c:${PCOL[i]}">
          <div class="mx-opp-h">
            <div class="mx-opp-id">${avatar ? avatar(p, 26) : ''}<b>${esc(p.name)}</b></div>
            <small>${st}</small>
          </div>
          <div class="mx-slots">${slots(s, i, false, false)}</div>
          <div class="mx-mini">${Array.from({ length: nb }, (_, idx) => `<i style="--mi:${idx - (nb - 1) / 2}"></i>`).join('')}${s.hands[i].length > 7 ? `<span>+${s.hands[i].length - 7}</span>` : ''}</div>
        </div>`;
      }

      function renderStackLayers(count, isDiscard) {
        if (!count) return `<div class="mx-ph">${isDiscard ? '<span>🧹</span>' : '<span>∅</span>'}</div>`;
        const layers = Math.min(3, Math.ceil(count / 8));
        let h = '';
        for (let i = layers; i >= 1; i--) {
          h += `<div class="mx-stk-layer" style="--ly:${i}"></div>`;
        }
        h += back({ cls: 'stk' });
        return h;
      }

      /* ============ Helpers de Animação no Ecrã (.mx-fx) ============ */
      function relCenter(el) {
        const wr = wrap.getBoundingClientRect();
        if (!el) return { x: wr.width / 2, y: wr.height / 2, w: 60, h: 84 };
        const r = el.getBoundingClientRect();
        return {
          x: r.left - wr.left + r.width / 2,
          y: r.top - wr.top + r.height / 2,
          w: r.width,
          h: r.height
        };
      }

      function getSeatPos(seat, v) {
        if (seat === v) {
          const meEl = board.querySelector('.mx-me .mx-hand') || board.querySelector('.mx-me');
          return relCenter(meEl);
        }
        const oppEl = board.querySelector(`.mx-opp[data-seat="${seat}"]`);
        return relCenter(oppEl);
      }

      function spawnShockwave(x, y, color = '#22d3ee', big = false) {
        const ring = document.createElement('div');
        ring.className = 'mx-shockwave' + (big ? ' big' : '');
        ring.style.left = `${x}px`;
        ring.style.top = `${y}px`;
        ring.style.setProperty('--sw-col', color);
        fx.appendChild(ring);
        setTimeout(() => ring.remove(), 950);
      }

      function spawnParticles(x, y, symbols, count = 16) {
        for (let i = 0; i < count; i++) {
          const p = document.createElement('span');
          p.className = 'mx-particle';
          p.textContent = symbols[i % symbols.length];
          p.style.left = `${x}px`;
          p.style.top = `${y}px`;
          fx.appendChild(p);
          const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
          const dist = 55 + Math.random() * 95;
          const tx = Math.cos(angle) * dist;
          const ty = Math.sin(angle) * dist - 15;
          const rot = (Math.random() - 0.5) * 260;
          if (p.animate) {
            const anim = p.animate([
              { transform: 'translate(-50%, -50%) scale(0.3) rotate(0deg)', opacity: 1 },
              { transform: `translate(calc(-50% + ${tx * 0.65}px), calc(-50% + ${ty * 0.65}px)) scale(1.25) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.45 },
              { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty + 28}px)) scale(0.4) rotate(${rot}deg)`, opacity: 0 }
            ], { duration: 750 + Math.random() * 350, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
            anim.onfinish = () => p.remove();
          } else {
            setTimeout(() => p.remove(), 900);
          }
        }
      }

      function flyCard({ html, from, to, delay = 0, duration = 430, rotStart = -16, rotEnd = 0, scaleStart = 0.78, scalePeak = 1.18, scaleEnd = 1, onLand }) {
        const el = document.createElement('div');
        el.className = 'mx-fly-card';
        el.innerHTML = html;
        el.style.left = `${to.x}px`;
        el.style.top = `${to.y}px`;
        fx.appendChild(el);

        const dx = from.x - to.x;
        const dy = from.y - to.y;
        const midX = dx * 0.38;
        const midY = dy * 0.38 - 34;

        if (el.animate) {
          const anim = el.animate([
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scaleStart}) rotate(${rotStart}deg)`, opacity: 0.25 },
            { transform: `translate(calc(-50% + ${midX}px), calc(-50% + ${midY}px)) scale(${scalePeak}) rotate(${(rotStart + rotEnd) * 0.5}deg)`, opacity: 1, offset: 0.52 },
            { transform: `translate(-50%, -50%) scale(${scaleEnd}) rotate(${rotEnd}deg)`, opacity: 1 }
          ], { duration, delay, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' });
          anim.onfinish = () => {
            if (onLand) onLand();
            el.remove();
          };
        } else {
          setTimeout(() => {
            if (onLand) onLand();
            el.remove();
          }, delay + duration);
        }
      }

      function spawnSeatStamp(seat, v, text, cls = 'block') {
        const pos = getSeatPos(seat, v);
        const st = document.createElement('div');
        st.className = `mx-seat-stamp ${cls}`;
        st.style.left = `${pos.x}px`;
        st.style.top = `${pos.y}px`;
        st.innerHTML = text;
        fx.appendChild(st);
        setTimeout(() => st.remove(), 1750);
      }

      function banner(html, cls = '') {
        const d = document.createElement('div');
        d.className = 'mx-banner ' + cls;
        d.innerHTML = html;
        fx.appendChild(d);
        setTimeout(() => d.remove(), 1850);
      }

      function showBlindFlip(blindInfo, seatName) {
        const d = document.createElement('div');
        d.className = 'mx-flip-3d ' + (blindInfo.ok ? 'ok' : 'no');
        d.innerHTML = `
          <div class="mx-flip-card-inner">
            <div class="mx-flip-face front">${back()}</div>
            <div class="mx-flip-face reveal">${card(blindInfo.id)}</div>
          </div>
          <span class="mx-flip-txt"><b>${esc(seatName)}</b> virou às cegas: <em>${blindInfo.ok ? '✓ Serve!' : '✗ Não serve!'}</em></span>`;
        fx.appendChild(d);
        setTimeout(() => d.remove(), 2000);
      }

      function animateDeckDraws(seat, v, count) {
        if (!count) return;
        const stockEl = board.querySelector('.mx-pbox-stock .mx-stk');
        if (!stockEl) return;
        const from = relCenter(stockEl);
        const to = getSeatPos(seat, v);
        const n = Math.min(count, 3);
        for (let i = 0; i < n; i++) {
          flyCard({
            html: back(),
            from,
            to,
            delay: 280 + i * 90,
            duration: 390,
            rotStart: -12,
            rotEnd: (i - 1) * 8,
            scaleStart: 0.72,
            scalePeak: 0.92,
            scaleEnd: 0.65
          });
        }
      }

      function runEventAnimations(s, evt, v) {
        const centerEl = board.querySelector('.mx-center');
        const tableEl = board.querySelector('.mx-table');
        const discardEl = board.querySelector('.mx-pbox-discard .mx-stk');
        const centerPos = relCenter(centerEl);
        const fromPos = evt.seat != null ? getSeatPos(evt.seat, v) : centerPos;
        const seatCol = evt.seat != null ? PCOL[evt.seat] : '#22d3ee';

        if (evt.blind) {
          showBlindFlip(evt.blind, s.names[evt.seat]);
        }

        if (evt.type === 'start') {
          spawnShockwave(centerPos.x, centerPos.y, '#22d3ee', true);
          banner(`⚡ Começa quem tem <b>${esc(evt.startRank)}</b>!`, 'start-bn');
          return;
        }

        if (evt.type === 'dir') {
          const isUp = evt.dir === 'up';
          spawnShockwave(centerPos.x, centerPos.y, isUp ? '#22d3ee' : '#a78bfa', false);
          spawnParticles(centerPos.x, centerPos.y, isUp ? ['↑', '✨', '7'] : ['↓', '✨', '7'], 12);
          banner(isUp ? '↑ ACIMA DE 7!' : '↓ ABAIXO DE 7!', 'power-bn');
          return;
        }

        if (evt.type === 'end') {
          if (evt.blockedSeats && evt.blockedSeats.length) {
            banner(`⛔ ${evt.blockedSeats.length > 1 ? evt.blockedSeats.length + ' Bloqueados!' : esc(s.names[evt.blockedSeats[0]]) + ' Bloqueado!'}`, 'block-bn');
            evt.blockedSeats.forEach((bs) => spawnSeatStamp(bs, v, '⛔ BLOQUEADO', 'block'));
          }
          return;
        }

        if (evt.type === 'take' || evt.type === 'blind_fail') {
          const taken = (evt.taken || []).slice(-6);
          const toPos = getSeatPos(evt.seat, v);
          spawnShockwave(centerPos.x, centerPos.y, '#fb7185', false);
          taken.forEach((cid, idx) => {
            flyCard({
              html: card(cid),
              from: centerPos,
              to: toPos,
              delay: idx * 55,
              duration: 440,
              rotStart: ((cid * 7) % 9) - 4,
              rotEnd: (idx - 2) * 8,
              scaleStart: 0.95,
              scalePeak: 1.05,
              scaleEnd: 0.65
            });
          });
          banner(`📥 <b>${esc(s.names[evt.seat])}</b> recolheu ${evt.taken ? evt.taken.length : ''} carta${evt.taken && evt.taken.length > 1 ? 's' : ''}!`, 'take-bn');
          if (evt.drawnCount) animateDeckDraws(evt.seat, v, evt.drawnCount);
          return;
        }

        if (evt.type === 'clean') {
          const cards = evt.cards || [];
          const cleared = (evt.cleared || []).slice(-6);
          // Mostra temporariamente as cartas no centro antes de explodirem para o descarte
          if (centerEl && cleared.length) {
            centerEl.innerHTML = cleared.map((id, k) => card(id, {
              cid: id,
              cls: cards.includes(id) ? 'wait-land ' : '',
              style: `--rot:${((id * 7) % 9) - 4}deg;--k:${k}`
            })).join('');
          }

          cards.forEach((cid, idx) => {
            const targetCardEl = centerEl ? centerEl.querySelector(`[data-cid="${cid}"]`) : null;
            flyCard({
              html: card(cid),
              from: fromPos,
              to: centerPos,
              delay: idx * 65,
              duration: 360,
              rotStart: evt.seat === v ? -12 : 18,
              rotEnd: ((cid * 7) % 9) - 4,
              scaleStart: 0.8,
              scalePeak: 1.24,
              scaleEnd: 1,
              onLand: () => {
                if (targetCardEl) targetCardEl.classList.remove('wait-land');
              }
            });
          });

          const sweepDelay = 350 + Math.max(0, cards.length - 1) * 65;
          setTimeout(() => {
            if (tableEl) {
              tableEl.classList.add('is-cleaning');
              setTimeout(() => tableEl.classList.remove('is-cleaning'), 1000);
            }
            const cleanCol = evt.cleanKind === 'joker' ? '#a78bfa' : evt.cleanKind === 'four' ? '#fb923c' : '#22d3ee';
            spawnShockwave(centerPos.x, centerPos.y, cleanCol, true);
            const emojis = evt.cleanKind === 'joker'
              ? ['🃏', '🧹', '✨', '💥', '⚡']
              : evt.cleanKind === 'four'
                ? ['🔥', '💥', '⚡', '✨', '🧹']
                : ['🧹', '✨', '💨', '⚡'];
            spawnParticles(centerPos.x, centerPos.y, emojis, 20);

            const title = evt.cleanKind === 'joker'
              ? '🃏 JOKER! MESA LIMPA!'
              : evt.cleanKind === 'four'
                ? '🔥 4 IGUAIS! MESA LIMPA!'
                : '🧹 10! MESA LIMPA!';
            banner(`${title}<small>${esc(s.names[evt.seat])} joga outra vez!</small>`, 'clean');

            // Faz as cartas do centro voarem em espiral para o monte de Descartadas
            const discPos = discardEl ? relCenter(discardEl) : { x: centerPos.x + 110, y: centerPos.y };
            cleared.forEach((cid, idx) => {
              flyCard({
                html: card(cid),
                from: centerPos,
                to: discPos,
                delay: idx * 45,
                duration: 460,
                rotStart: ((cid * 7) % 9) - 4,
                rotEnd: 180 + idx * 25,
                scaleStart: 1,
                scalePeak: 0.9,
                scaleEnd: 0.45
              });
            });
            if (centerEl) {
              centerEl.innerHTML = '<div class="mx-empty"><span class="mx-empty-ic">✨</span><span>Mesa livre</span></div>';
            }
          }, sweepDelay);

          if (evt.drawnCount) animateDeckDraws(evt.seat, v, evt.drawnCount);
          return;
        }

        if (evt.type === 'play') {
          const cards = evt.cards || [];
          cards.forEach((cid, idx) => {
            const targetCardEl = centerEl ? centerEl.querySelector(`[data-cid="${cid}"]`) : null;
            if (targetCardEl) targetCardEl.classList.add('wait-land');
            flyCard({
              html: card(cid),
              from: fromPos,
              to: centerPos,
              delay: idx * 70,
              duration: 410,
              rotStart: evt.seat === v ? -14 : 18,
              rotEnd: ((cid * 7) % 9) - 4,
              scaleStart: 0.8,
              scalePeak: 1.2,
              scaleEnd: 1,
              onLand: () => {
                if (targetCardEl) {
                  targetCardEl.classList.remove('wait-land');
                  targetCardEl.classList.add('landed-pop');
                }
                spawnShockwave(centerPos.x, centerPos.y, seatCol, cards.length > 1);
              }
            });
          });

          const landTime = 380 + Math.max(0, cards.length - 1) * 70;
          setTimeout(() => {
            if (evt.power === 'reset') {
              spawnShockwave(centerPos.x, centerPos.y, '#22d3ee', true);
              spawnParticles(centerPos.x, centerPos.y, ['↺', '✨', '2'], 12);
              banner('↺ CICLO REINICIADO!', 'power-bn');
            } else if (evt.power === 'mirror') {
              spawnShockwave(centerPos.x, centerPos.y, '#a78bfa', false);
              spawnParticles(centerPos.x, centerPos.y, ['🪞', '✨', '3'], 12);
              banner('🪞 ESPELHO!', 'power-bn');
            } else if (evt.power === 'seven') {
              spawnShockwave(centerPos.x, centerPos.y, '#fbbf24', false);
            }

            if (evt.blockedSeats && evt.blockedSeats.length) {
              spawnParticles(centerPos.x, centerPos.y, ['⛔', '💥'], 12);
              banner(`⛔ ${evt.blockedSeats.length > 1 ? evt.blockedSeats.length + ' JOGADORES BLOQUEADOS!' : esc(s.names[evt.blockedSeats[0]]) + ' BLOQUEADO!'}`, 'block-bn');
              evt.blockedSeats.forEach((bs) => spawnSeatStamp(bs, v, '⛔ BLOQUEADO', 'block'));
            }

            if (evt.lucky) {
              spawnSeatStamp(evt.seat, v, '✨ COMPRA IGUAL!', 'lucky');
            }
          }, landTime);

          if (evt.drawnCount) animateDeckDraws(evt.seat, v, evt.drawnCount);
        }
      }

      function draw() {
        const s = cur;
        if (!s) return;
        const v = viewSeat(s);
        const locked = ctx.hotseat && s.phase !== 'over' && v !== unlocked;
        const key = s.phase + ':' + s.turn + ':' + s.pending + ':' + v;
        if (key !== lastKey) { sel.clear(); lastKey = key; }
        [...sel].forEach((id) => { if (!s.hands[v].includes(id)) sel.delete(id); });

        const myTurn = s.phase === 'play' && s.turn === v;
        const blindPhase = s.phase === 'play' && !s.hands[v].length && !s.faceUp[v].length && !s.stock.length;
        const hand = [...s.hands[v]].sort(byOrder);
        const ids = [...sel];
        const g = ids.length ? validPlay(s, ids) : null;

        /* mensagem de estado */
        let msg;
        if (s.phase === 'setup') {
          msg = s.ready[v] ? 'À espera dos outros jogadores…' : `Escolhe <b>3 cartas</b> para ficarem viradas para cima na mesa (${sel.size}/3)`;
        } else if (s.phase === 'start') {
          msg = s.starters.includes(v)
            ? `Tens a carta mais baixa (<b>${s.startRank}</b>)! Joga-a primeiro${s.starters.length > 1 ? ' — o mais rápido começa' : ''}`
            : `<b>${esc(s.names[s.starters[0]])}${s.starters.length > 1 ? ' ou outro' : ''}</b> vai começar…`;
        } else if (s.phase === 'over') {
          msg = `🏆 <b style="color:${PCOL[s.winner]}">${esc(s.names[s.winner])}</b> ficou sem cartas e venceu!`;
        } else if (s.pending === 'dir') {
          msg = s.turn === v ? 'Jogaste um <b>7</b>: o próximo joga acima ou abaixo?' : `<b>${esc(s.names[s.turn])}</b> está a escolher cima ou baixo…`;
        } else if (myTurn) {
          msg = blindPhase ? 'Escolhe uma carta <b>virada para baixo</b> (ou pega as do meio)'
            : s.canEnd ? '✨ <b>Carta igual ou 3!</b> Podes jogar por cima ou terminar a jogada.'
            : `<b>A tua vez!</b> ${need(s)}`;
        } else {
          msg = s.canEnd
            ? `<b>${esc(s.names[s.turn])}</b> pode jogar mais cartas iguais ou um 3…`
            : `Vez de <b style="color:${PCOL[s.turn]}">${esc(s.names[s.turn])}</b> · ${need(s)}`;
        }

        /* mesa central */
        const shown = s.center.slice(-6);
        const hasNewEvent = s.evt && s.evt.id !== lastEvtId;
        const centerH = shown.length
          ? shown.map((id, k) => card(id, {
            cid: id,
            cls: (!hasNewEvent && !prevCenter.has(id) ? 'drop ' : '') + (rk(id) === '3' ? 'mirror' : ''),
            style: `--rot:${((id * 7) % 9) - 4}deg;--k:${k}`
          })).join('')
          : '<div class="mx-empty"><span class="mx-empty-ic">🃏</span><span>Mesa livre</span></div>';

        const activeTurnSeat = s.phase === 'play' ? s.turn : (s.phase === 'start' && s.starters.length ? s.starters[0] : v);
        const eff = effTop(s.center);
        const tableState = !s.center.length ? 'free' : eff == null ? 'reset' : eff === SEVEN ? (s.dir ? `seven-${s.dir}` : 'seven') : 'active';

        /* ações */
        let actions = '';
        if (s.phase === 'setup' && !s.ready[v]) {
          actions = `<button class="btn btn-neon" data-act="confirm" ${sel.size === 3 ? '' : 'disabled'}>Confirmar (${sel.size}/3)</button>`;
        } else if (s.phase === 'start' && s.starters.includes(v)) {
          actions = `<button class="btn btn-neon" data-act="play" ${g ? '' : 'disabled'}>Jogar ${ids.length ? ids.length : ''} carta${ids.length > 1 ? 's' : ''} 🚀</button>`;
        } else if (myTurn && s.pending === 'dir') {
          actions = `<button class="btn btn-neon" data-act="dir" data-d="up">↑ Acima de 7</button><button class="btn btn-neon" data-act="dir" data-d="down">↓ Abaixo de 7</button>`;
        } else if (myTurn) {
          actions = `${blindPhase ? '' : `<button class="btn btn-neon" data-act="play" ${g ? '' : 'disabled'}>Jogar ${ids.length || ''} carta${ids.length > 1 ? 's' : ''} 🃏</button>`}
            ${s.center.length && !s.turnPlays ? `<button class="btn btn-ghost" data-act="take">📥 Pegar ${s.center.length} do meio</button>` : ''}
            ${s.canEnd ? '<button class="btn btn-ghost" data-act="end">✓ Terminar jogada</button>' : ''}`;
        }
        actions += '<button class="btn btn-ghost btn-sm" data-act="rules">📖 Regras</button>';

        const opps = [];
        for (let k = 1; k < s.n; k++) opps.push((v + k) % s.n);

        board.innerHTML = `
          <div class="mx-opps">${opps.map((i) => oppHTML(s, i)).join('')}</div>
          <div class="mx-table" data-state="${tableState}" style="--turn-c:${PCOL[activeTurnSeat]}">
            <div class="mx-table-rim" aria-hidden="true"></div>
            <div class="mx-table-head">
              ${tableRuleBadge(s)}
            </div>
            <div class="mx-table-body">
              <div class="mx-pbox mx-pbox-stock">
                <div class="mx-stk">${renderStackLayers(s.stock.length, false)}</div>
                <small>Baralho · <b>${s.stock.length}</b></small>
              </div>
              <div class="mx-center-box">
                <div class="mx-center-ring" aria-hidden="true"></div>
                <div class="mx-center">${centerH}</div>
                <small class="mx-count">${s.center.length ? `${s.center.length} carta${s.center.length > 1 ? 's' : ''} na mesa` : 'Joga para o centro'}</small>
              </div>
              <div class="mx-pbox mx-pbox-discard ${s.discard.length ? '' : 'dim'}">
                <div class="mx-stk">${renderStackLayers(s.discard.length, true)}</div>
                <small>Limpas · <b>${s.discard.length}</b></small>
              </div>
            </div>
          </div>
          <div class="mx-msg">${msg}</div>
          <div class="mx-log">${s.log.slice(-3).map((l, i, a) => `<p class="${i === a.length - 1 ? 'new' : ''}">${l}</p>`).join('')}</div>
          <div class="mx-me ${myTurn || (s.phase === 'start' && s.starters.includes(v)) ? 'turn' : ''}" data-seat="${v}" style="--c:${PCOL[v]}">
            <div class="mx-opp-h">
              <div class="mx-opp-id">${avatar ? avatar(ctx.players[v] || { name: s.names[v] }, 28) : ''}<b>${esc(ctx.players[v].name)}${!ctx.hotseat ? ' (tu)' : ''}</b></div>
              <small>✋ ${s.hands[v].length} na mão</small>
            </div>
            <div class="mx-slots mine">${slots(s, v, true, myTurn && blindPhase && !s.pending && !s.turnPlays)}</div>
            <div class="mx-hand ${hand.length > 10 ? 'dense' : ''}">${hand.map((id) => card(id, {
              act: 'sel',
              cls: (sel.has(id) ? 'sel ' : '') + (myTurn && s.canEnd && (rk(id) === '3' || rk(id) === s.turnRank) ? 'match-pulse ' : '')
            })).join('') || '<span class="mx-none">sem cartas na mão</span>'}</div>
            <div class="mx-actions">${actions}</div>
          </div>`;

        /* disparar animações de eventos sincronizados */
        if (s.evt && s.evt.id !== lastEvtId) {
          lastEvtId = s.evt.id;
          if (!locked) runEventAnimations(s, s.evt, v);
        }

        if (s.phase === 'over' && !victoryShown) {
          victoryShown = true;
          const cPos = relCenter(board.querySelector('.mx-center'));
          spawnShockwave(cPos.x, cPos.y, '#34d399', true);
          spawnParticles(cPos.x, cPos.y, ['🏆', '🎉', '✨', '🃏', '⭐'], 24);
        } else if (s.phase !== 'over') {
          victoryShown = false;
        }

        prevCenter = new Set(s.center);

        /* ecrã de passagem (mesmo dispositivo) */
        cover.hidden = !locked;
        cover.classList.toggle('hidden', !locked);
        cover.style.display = locked ? 'grid' : 'none';
        if (locked) {
          cover.innerHTML = `<div class="mx-cover-in glass"><span class="mx-lock">🔒</span>
            <h3>Passa o dispositivo a <b style="color:${PCOL[v]}">${esc(ctx.players[v].name)}</b></h3>
            <p class="muted">Os outros jogadores não devem olhar para o ecrã.</p>
            <button class="btn btn-neon btn-lg" data-act="unlock" type="button">Ver as minhas cartas</button></div>`;
        } else {
          cover.innerHTML = '';
        }
      }

      function rules() {
        openModal(`<div class="mx-rules"><h2>🃏 Regras da Mexicana</h2>
          <ul>
            <li><b>Objetivo:</b> ficar sem cartas (mão, à vista e viradas para baixo). O baralho tem 52 cartas + 4 jokers.</li>
            <li><b>Início:</b> escolhe 3 das 6 cartas para ficarem à vista. Começa quem tiver a carta mais baixa sem poderes (4, 5, 6, 9…).</li>
            <li><b>Mão:</b> tens sempre 3 cartas até o baralho acabar. Se jogares uma carta e a que comprares do baralho for igual ou um 3, podes jogá-la logo por cima, tendo de comprar outra a seguir (o mínimo na mão é sempre 3 cartas). Depois jogas as <i>à vista</i> e, por fim, as <i>viradas para baixo</i> (às cegas).</li>
            <li><b>Ordem:</b> 4 5 6 7 8 9 J Q K A · <b>2, 3, 10 e Joker</b> jogam-se sobre qualquer carta.</li>
            <li><b>Várias cartas:</b> podes jogar cartas iguais de uma vez (ou uma a seguir à outra na mesma jogada).</li>
            <li><b>2 ↺</b> reinicia o ciclo · <b>3 🪞</b> copia a carta anterior (sozinho vale 3 e reinicia).</li>
            <li><b>7 ↕</b> só sobre 4-7 ou 2; quem o joga escolhe se o próximo joga acima ou abaixo.</li>
            <li><b>8 ⛔</b> bloqueia o próximo jogador (cada 8 ou 3-cópia bloqueia mais um).</li>
            <li><b>10 e Joker 🧹</b> limpam a mesa — jogas outra vez. <b>4 cartas iguais seguidas</b> também (o 3 não conta).</li>
            <li>Se não podes (ou não queres) jogar, <b>pegas todas as cartas do meio</b>. Descartadas não voltam ao jogo.</li>
          </ul></div>`, { cls: 'modal-wide' });
      }

      cover.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act="unlock"]');
        if (btn && cur) {
          e.preventDefault();
          e.stopPropagation();
          unlocked = viewSeat(cur);
          draw();
        }
      });

      wrap.addEventListener('click', (e) => {
        const t = e.target.closest('[data-act]');
        if (!t || !cur) return;
        const s = cur, v = viewSeat(s), act = t.dataset.act;
        if (act === 'unlock') { unlocked = v; draw(); return; }
        if (act === 'rules') { rules(); return; }
        if (act === 'sel') {
          const id = +t.dataset.id;
          if (sel.has(id)) sel.delete(id);
          else if (s.phase !== 'setup' || sel.size < 3) sel.add(id);
          draw(); return;
        }
        if (act === 'confirm') { ctx.dispatch({ type: 'setup', ids: [...sel] }, v); sel.clear(); return; }
        if (act === 'play') { const ids = [...sel]; sel.clear(); ctx.dispatch({ type: 'play', ids }, v); return; }
        if (act === 'take') { ctx.dispatch({ type: 'take' }, v); return; }
        if (act === 'end') { ctx.dispatch({ type: 'end' }, v); return; }
        if (act === 'dir') { ctx.dispatch({ type: 'dir', dir: t.dataset.d }, v); return; }
        if (act === 'blind') { ctx.dispatch({ type: 'blind', idx: +t.dataset.i }, v); }
      });

      return {
        update(s) {
          if (!cur && s && s.evt && s.seq > 1) lastEvtId = s.evt.id;
          cur = s;
          draw();
        },
        destroy() { fx.innerHTML = ''; }
      };
    }
  });
})(window.Omni);
