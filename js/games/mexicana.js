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
  const { esc, PCOL, openModal } = O.util;

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

  function endTurn(s) {
    s.canEnd = false;
    const e = effTop(s.center);
    if (s.turnPlays > 0 && e === SEVEN) { s.pending = 'dir'; return; }
    let skip = 0;
    if (s.turnPlays > 0 && e === EIGHT) {
      for (let i = s.center.length - 1; i >= 0 && skip < s.turnPlays; i--) {
        const r = rk(s.center[i]);
        if (r !== '8' && !(r === '3' && effAt(s.center, i) === EIGHT)) break;
        skip++;
      }
      if (skip) say(s, `⛔ ${skip} jogador${skip > 1 ? 'es' : ''} bloqueado${skip > 1 ? 's' : ''}`);
    }
    advance(s, 1 + skip);
  }

  function doPlay(s, seat, g) {
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

    if (g.base.some((i) => CLEAN.has(rk(i))) || fourKind(s.center)) {
      s.discard.push(...s.center); s.center = [];
      s.turnPlays = 0; s.turnRank = null; s.canEnd = false;
      say(s, `🧹 ${nm(s, seat)} limpou a mesa e joga outra vez`);
      refill(s, seat);
      if (finished(s, seat)) { s.phase = 'over'; s.winner = seat; }
      return s;
    }
    const drawn = refill(s, seat);
    if (finished(s, seat)) { s.phase = 'over'; s.winner = seat; return s; }
    const can = s.hands[seat].some((i) => rk(i) === '3' || (s.turnRank != null && rk(i) === s.turnRank));
    if (drawn.length) {
      const lucky = drawn.some((i) => rk(i) === '3' || (s.turnRank != null && rk(i) === s.turnRank));
      if (lucky) {
        say(s, `✨ ${nm(s, seat)} comprou ${drawn.map(cardTxt).join(' ')} — pode jogar por cima!`);
      }
    }
    if (can) s.canEnd = true; else endTurn(s);
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
        winner: -1, flip: null, log: ['As cartas foram dadas. Escolhe 3 para ficarem à vista.']
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
        if (s.ready.every(Boolean)) startPhase(s);
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
        advance(s, 1);
        return s;
      }
      if (s.pending) return null;

      /* --- terminar a jogada (quando ainda podia jogar mais cartas iguais) --- */
      if (a.type === 'end') {
        if (!s.turnPlays || !s.canEnd) return null;
        endTurn(s);
        return s;
      }

      /* --- pegar as cartas do meio --- */
      if (a.type === 'take') {
        if (s.turnPlays || !s.center.length) return null;
        say(s, `${nm(s, seat)} pegou ${s.center.length} carta${s.center.length > 1 ? 's' : ''} do meio`);
        s.hands[seat].push(...s.center);
        s.center = []; s.dir = null;
        refill(s, seat);
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
        if (ok) return doPlay(s, seat, rk(id) === '3' ? { base: [], threes: [id] } : { base: [id], threes: [] });
        say(s, `${nm(s, seat)} virou ${cardTxt(id)} e não pode jogar — leva as cartas`);
        s.hands[seat].push(id, ...s.center);
        s.center = []; s.dir = null;
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

    /* ============ Interface ============ */
    mount(root, ctx) {
      root.innerHTML = `<div class="mx-wrap" style="--hue:${HUE}"><div class="mx-board"></div><div class="mx-fx"></div><div class="mx-cover" hidden></div></div>`;
      const wrap = root.firstElementChild, board = wrap.querySelector('.mx-board'), fx = wrap.querySelector('.mx-fx'), cover = wrap.querySelector('.mx-cover');
      let cur = null, unlocked = 0, prevCenter = new Set(), prevDiscard = null, prevFlip = 0, lastKey = '';
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
        const at = o.act ? ` data-act="${o.act}" data-id="${id}" aria-label="${cardTxt(id)}"` : '';
        const st = o.style ? ` style="${o.style}"` : '';
        if (r === 'X') return `<${tag} class="${cls}"${at}${st}><span class="jk">🃏</span><em>JOKER</em></${tag}>`;
        return `<${tag} class="${cls}"${at}${st}><span class="ix">${r}<i>${SUITS[s]}</i></span><span class="big">${SUITS[s]}</span>`
          + `<span class="ix bot">${r}<i>${SUITS[s]}</i></span>${GLYPH[r] ? `<u class="pw">${GLYPH[r]}</u>` : ''}</${tag}>`;
      }
      const back = (o = {}) => `<${o.act ? 'button' : 'div'} class="mx-card back ${o.cls || ''}"${o.act ? ` data-act="${o.act}" data-i="${o.i}" aria-label="Carta virada para baixo"` : ''}></${o.act ? 'button' : 'div'}>`;

      function need(s) {
        const e = effTop(s.center);
        if (!s.center.length) return 'Mesa vazia — joga qualquer carta';
        if (e == null) return 'Ciclo reiniciado — joga qualquer carta';
        if (e === SEVEN && s.dir === 'down') return 'Abaixo de 7: joga 4, 5, 6 ou 7 · (2, 3, 10 e Joker também)';
        if (e === SEVEN && s.dir === 'up') return 'Acima de 7: joga 7 ou mais · (2, 3, 10 e Joker também)';
        return `Joga ${ORDER_NAME[e]} ou acima · (2, 3, 10 e Joker passam sempre)`;
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
        const p = ctx.players[i];
        const isTurn = (s.phase === 'play' && s.turn === i) || (s.phase === 'start' && s.starters.includes(i));
        const st = s.phase === 'setup' ? (s.ready[i] ? '✓ pronto' : 'a escolher…') : `✋ ${s.hands[i].length}`;
        const nb = Math.min(s.hands[i].length, 6);
        return `<div class="mx-opp ${isTurn ? 'turn' : ''}" style="--c:${PCOL[i]}">
          <div class="mx-opp-h"><b>${esc(p.name)}</b><small>${st}</small></div>
          <div class="mx-slots">${slots(s, i, false, false)}</div>
          <div class="mx-mini">${Array.from({ length: nb }, () => '<i></i>').join('')}${s.hands[i].length > 6 ? `<span>+${s.hands[i].length - 6}</span>` : ''}</div>
        </div>`;
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

        /* mesa */
        const shown = s.center.slice(-6);
        const centerH = shown.length
          ? shown.map((id, k) => card(id, {
            cls: (prevCenter.has(id) ? '' : 'drop ') + (rk(id) === '3' ? 'mirror' : ''),
            style: `--rot:${((id * 7) % 9) - 4}deg;--k:${k}`
          })).join('')
          : '<div class="mx-empty">Mesa vazia</div>';

        /* ações */
        let actions = '';
        if (s.phase === 'setup' && !s.ready[v]) {
          actions = `<button class="btn btn-neon" data-act="confirm" ${sel.size === 3 ? '' : 'disabled'}>Confirmar (${sel.size}/3)</button>`;
        } else if (s.phase === 'start' && s.starters.includes(v)) {
          actions = `<button class="btn btn-neon" data-act="play" ${g ? '' : 'disabled'}>Jogar ${ids.length ? ids.length : ''} carta${ids.length > 1 ? 's' : ''}</button>`;
        } else if (myTurn && s.pending === 'dir') {
          actions = `<button class="btn btn-neon" data-act="dir" data-d="up">↑ Acima de 7</button><button class="btn btn-neon" data-act="dir" data-d="down">↓ Abaixo de 7</button>`;
        } else if (myTurn) {
          actions = `${blindPhase ? '' : `<button class="btn btn-neon" data-act="play" ${g ? '' : 'disabled'}>Jogar ${ids.length || ''} carta${ids.length > 1 ? 's' : ''}</button>`}
            ${s.center.length && !s.turnPlays ? `<button class="btn btn-ghost" data-act="take">Pegar ${s.center.length} do meio</button>` : ''}
            ${s.canEnd ? '<button class="btn btn-ghost" data-act="end">Terminar jogada</button>' : ''}`;
        }
        actions += '<button class="btn btn-ghost btn-sm" data-act="rules">📖 Regras</button>';

        const opps = [];
        for (let k = 1; k < s.n; k++) opps.push((v + k) % s.n);

        board.innerHTML = `
          <div class="mx-opps">${opps.map((i) => oppHTML(s, i)).join('')}</div>
          <div class="mx-table">
            <div class="mx-pbox"><div class="mx-stk">${s.stock.length ? back({ cls: 'stk' }) : '<div class="mx-ph"></div>'}</div><small>Baralho · ${s.stock.length}</small></div>
            <div class="mx-center-box">
              <div class="mx-center">${centerH}</div>
              <small class="mx-count">${s.center.length ? `${s.center.length} carta${s.center.length > 1 ? 's' : ''} no meio` : ''}</small>
            </div>
            <div class="mx-pbox dim"><div class="mx-stk">${s.discard.length ? back({ cls: 'stk' }) : '<div class="mx-ph"></div>'}</div><small>Descartadas · ${s.discard.length}</small></div>
          </div>
          <div class="mx-msg">${msg}</div>
          <div class="mx-log">${s.log.slice(-3).map((l, i, a) => `<p class="${i === a.length - 1 ? 'new' : ''}">${l}</p>`).join('')}</div>
          <div class="mx-me ${myTurn || (s.phase === 'start' && s.starters.includes(v)) ? 'turn' : ''}" style="--c:${PCOL[v]}">
            <div class="mx-opp-h"><b>${esc(ctx.players[v].name)}${!ctx.hotseat ? ' (tu)' : ''}</b><small>✋ ${s.hands[v].length}</small></div>
            <div class="mx-slots mine">${slots(s, v, true, myTurn && blindPhase && !s.pending && !s.turnPlays)}</div>
            <div class="mx-hand ${hand.length > 10 ? 'dense' : ''}">${hand.map((id) => card(id, {
              act: 'sel',
              cls: (sel.has(id) ? 'sel ' : '') + (myTurn && s.canEnd && (rk(id) === '3' || rk(id) === s.turnRank) ? 'match-pulse ' : '')
            })).join('') || '<span class="mx-none">sem cartas na mão</span>'}</div>
            <div class="mx-actions">${actions}</div>
          </div>`;

        /* efeitos */
        if (prevDiscard != null && s.discard.length > prevDiscard) banner('🧹 Limpeza!', 'clean');
        if (s.flip && s.flip.n !== prevFlip) {
          if (prevFlip || s.flip.n > 0) {
            const d = document.createElement('div');
            d.className = 'mx-flip ' + (s.flip.ok ? 'ok' : 'no');
            d.innerHTML = `${card(s.flip.id)}<span>${esc(s.names[s.flip.seat])}: ${s.flip.ok ? 'serve!' : 'não serve!'}</span>`;
            fx.appendChild(d); setTimeout(() => d.remove(), 1900);
          }
          prevFlip = s.flip.n;
        }
        prevDiscard = s.discard.length;
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

      function banner(html, cls) {
        const d = document.createElement('div');
        d.className = 'mx-banner ' + cls; d.innerHTML = html;
        fx.appendChild(d); setTimeout(() => d.remove(), 1700);
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
        update(s) { cur = s; draw(); },
        destroy() { fx.innerHTML = ''; }
      };
    }
  });
})(window.Omni);
