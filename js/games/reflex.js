/* Corrida de Reflexos — 2 a 4 jogadores. Espera pelo verde e carrega primeiro! */
(function (O) {
  const { esc, PCOL, rand } = O.util;
  const ROUNDS = 5;
  const KEYS = ['q', 'p', 'v', 'm']; // teclas no modo mesmo dispositivo (jogadores 1-4)

  O.games.register({
    id: 'reflex', name: 'Corrida de Reflexos', tagline: 'Espera pelo verde. Carrega primeiro. Não te precipites!',
    icon: '⚡', hue: 48, minPlayers: 2, maxPlayers: 4,

    init(n) {
      return { n, round: 1, rounds: ROUNDS, phase: 'wait', waitUntil: null, goAt: 0, until: 0,
        scores: Array(n).fill(0), early: Array(n).fill(false), winner: -1, ms: 0, over: false };
    },

    tick(s, now) {
      if (s.over) return null;
      if (s.phase === 'wait') {
        if (s.waitUntil == null) { s.waitUntil = now + rand(1800, 5200); return s; }
        if (now >= s.waitUntil) { s.phase = 'go'; s.goAt = now; return s; }
        return null;
      }
      if (s.phase === 'go' && now - s.goAt > 4000) { return this._endRound(s, -1, 0, now); }
      if (s.phase === 'result' && now >= s.until) {
        if (s.round >= s.rounds) { s.over = true; return s; }
        s.round++; s.phase = 'wait'; s.waitUntil = null; s.early = Array(s.n).fill(false); s.winner = -1; s.ms = 0;
        return s;
      }
      return null;
    },

    _endRound(s, winner, ms, now) {
      s.phase = 'result'; s.winner = winner; s.ms = ms; s.until = now + 2200;
      if (winner >= 0) s.scores[winner]++;
      return s;
    },

    reduce(s, a, seat, now) {
      if (s.over || a.type !== 'press' || !(seat >= 0 && seat < s.n)) return null;
      if (s.early[seat]) return null;
      if (s.phase === 'wait') {
        s.early[seat] = true;                        // queimaste a partida: fora desta ronda
        if (s.early.every(Boolean)) return this._endRound(s, -1, 0, now);
        return s;
      }
      if (s.phase === 'go') return this._endRound(s, seat, now - s.goAt, now);
      return null;
    },

    result(s) {
      if (!s.over) return null;
      const top = Math.max(...s.scores);
      const winners = s.scores.filter((x) => x === top).length;
      return s.scores.map((sc, i) => ({ seat: i, score: sc, result: sc === top ? (winners > 1 ? 'draw' : 'win') : 'loss' }));
    },

    info(s) { return { turn: null, scores: s.scores.map((x) => x + ' pts') }; },

    mount(root, ctx) {
      const keyHint = (i) => (ctx.hotseat ? `Tecla <kbd>${KEYS[i].toUpperCase()}</kbd> ou toca` : 'Espaço ou toca');
      root.innerHTML = `<div class="rx-wrap">
        <div class="rx-round" id="rxr"></div>
        <div class="rx-stage" id="rxs"><div class="rx-big" id="rxb"></div><div class="rx-sub" id="rxu"></div></div>
        <div class="rx-pads" id="rxp">${ctx.players.map((p, i) => ctx.mySeats.includes(i) ? `
          <button class="rx-pad" data-seat="${i}" style="--c:${PCOL[i]}">
            <b>${esc(p.name)}</b><span>${keyHint(i)}</span><em id="rxs${i}">0</em></button>` : `
          <div class="rx-pad ghost" style="--c:${PCOL[i]}"><b>${esc(p.name)}</b><em id="rxs${i}">0</em></div>`).join('')}</div></div>`;
      const stage = root.querySelector('#rxs'), big = root.querySelector('#rxb'), sub = root.querySelector('#rxu'), rd = root.querySelector('#rxr');
      let cur = null;

      const press = (seat) => ctx.dispatch({ type: 'press' }, seat);
      root.querySelectorAll('.rx-pad[data-seat]').forEach((b) =>
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(+b.dataset.seat); b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 140); }));
      const key = (e) => {
        if (e.repeat) return;
        if (ctx.hotseat) { const i = KEYS.indexOf(e.key.toLowerCase()); if (i >= 0 && i < ctx.players.length) press(i); }
        else if (e.code === 'Space') { e.preventDefault(); press(ctx.mySeats[0]); }
      };
      document.addEventListener('keydown', key);

      return {
        update(s) {
          cur = s;
          rd.textContent = `Ronda ${Math.min(s.round, s.rounds)} / ${s.rounds}`;
          s.scores.forEach((v, i) => { const e = root.querySelector('#rxs' + i); if (e) e.textContent = v; });
          stage.dataset.phase = s.phase;
          if (s.phase === 'wait') {
            big.textContent = 'Espera…';
            const burned = s.early.map((b, i) => b ? esc(ctx.players[i].name) : null).filter(Boolean);
            sub.innerHTML = burned.length ? `Precipitaram-se: ${burned.join(', ')}` : 'Não carregues ainda!';
          } else if (s.phase === 'go') {
            big.textContent = 'JÁ!'; sub.textContent = '';
          } else {
            if (s.winner >= 0) { big.innerHTML = `<span style="color:${PCOL[s.winner]}">${esc(ctx.players[s.winner].name)}</span>`; sub.textContent = `${s.ms} ms`; }
            else { big.textContent = 'Ninguém!'; sub.textContent = 'Ronda anulada'; }
          }
        },
        destroy() { document.removeEventListener('keydown', key); }
      };
    }
  });
})(window.Omni);
