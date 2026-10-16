/* Quatro em Linha — 2 a 4 jogadores (tabuleiro cresce com o número de jogadores) */
(function (O) {
  const { esc, PCOL } = O.util;

  const dims = (n) => (n === 2 ? { cols: 7, rows: 6 } : n === 3 ? { cols: 8, rows: 7 } : { cols: 9, rows: 7 });

  function lineThrough(b, cols, rows, r, c, seat) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [[r, c]];
      for (const s of [1, -1]) {
        let rr = r + dr * s, cc = c + dc * s;
        while (rr >= 0 && rr < rows && cc >= 0 && cc < cols && b[rr * cols + cc] === seat) { cells.push([rr, cc]); rr += dr * s; cc += dc * s; }
      }
      if (cells.length >= 4) return cells;
    }
    return null;
  }

  O.games.register({
    id: 'connect4', name: 'Quatro em Linha', tagline: 'Alinha 4 discos antes dos teus rivais.',
    icon: '🔴', hue: 195, minPlayers: 2, maxPlayers: 4,

    init(n) {
      const { cols, rows } = dims(n);
      return { n, cols, rows, board: Array(cols * rows).fill(-1), turn: 0, over: false, winner: -1, line: [], last: null, moves: Array(n).fill(0) };
    },

    reduce(s, a, seat) {
      if (s.over || a.type !== 'drop' || seat !== s.turn) return null;
      const c = a.col;
      if (!(c >= 0 && c < s.cols)) return null;
      let r = -1;
      for (let i = s.rows - 1; i >= 0; i--) if (s.board[i * s.cols + c] === -1) { r = i; break; }
      if (r < 0) return null;
      s.board[r * s.cols + c] = seat; s.last = [r, c]; s.moves[seat]++;
      const line = lineThrough(s.board, s.cols, s.rows, r, c, seat);
      if (line) { s.over = true; s.winner = seat; s.line = line; }
      else if (s.board.every((x) => x !== -1)) { s.over = true; }
      else s.turn = (s.turn + 1) % s.n;
      return s;
    },

    result(s) {
      if (!s.over) return null;
      return Array.from({ length: s.n }, (_, i) => ({
        seat: i, score: s.moves[i],
        result: s.winner < 0 ? 'draw' : s.winner === i ? 'win' : 'loss'
      }));
    },

    info(s) { return { turn: s.over ? null : s.turn, scores: s.moves.map((m) => m + ' 🔴') }; },

    mount(root, ctx) {
      root.innerHTML = `<div class="c4-wrap"><div class="c4-status" id="c4s"></div><div class="c4-board" id="c4b"></div>
        <p class="hint">${ctx.hotseat ? 'Toca numa coluna na tua vez · ou teclas 1-9' : 'Clica numa coluna na tua vez · ou teclas 1-9'}</p></div>`;
      const boardEl = root.querySelector('#c4b'), statusEl = root.querySelector('#c4s');
      let cur = null, built = '';

      const key = (e) => {
        const n = parseInt(e.key, 10);
        if (n >= 1 && cur && n <= cur.cols) ctx.dispatch({ type: 'drop', col: n - 1 }, cur.turn);
      };
      document.addEventListener('keydown', key);

      function build(s) {
        built = s.cols + 'x' + s.rows;
        boardEl.style.setProperty('--cols', s.cols);
        boardEl.style.setProperty('--rows', s.rows);
        let h = '';
        for (let c = 0; c < s.cols; c++) {
          h += `<button class="c4-col" data-c="${c}" aria-label="Coluna ${c + 1}">`;
          for (let r = 0; r < s.rows; r++) h += `<span class="c4-cell" data-r="${r}"><i></i></span>`;
          h += '</button>';
        }
        boardEl.innerHTML = h;
        boardEl.querySelectorAll('.c4-col').forEach((b) => b.addEventListener('click', () => ctx.dispatch({ type: 'drop', col: +b.dataset.c }, cur.turn)));
      }

      return {
        update(s) {
          cur = s;
          if (built !== s.cols + 'x' + s.rows) build(s);
          const cols = boardEl.children;
          for (let c = 0; c < s.cols; c++) {
            const cells = cols[c].children;
            for (let r = 0; r < s.rows; r++) {
              const v = s.board[r * s.cols + c], el = cells[r], disc = el.firstChild;
              const had = el.dataset.v;
              el.dataset.v = v;
              disc.style.background = v >= 0 ? PCOL[v] : '';
              disc.style.boxShadow = v >= 0 ? `0 0 14px ${PCOL[v]}88, inset 0 -4px 8px rgba(0,0,0,.25)` : '';
              disc.className = v >= 0 ? 'on' : '';
              if (v >= 0 && String(had) !== String(v) && s.last && s.last[0] === r && s.last[1] === c) {
                disc.style.setProperty('--fall', r + 1);
                disc.classList.add('drop');
              }
              el.classList.toggle('win', s.line.some(([lr, lc]) => lr === r && lc === c));
            }
            cols[c].disabled = s.over;
          }
          const p = ctx.players[s.over ? Math.max(s.winner, 0) : s.turn];
          if (s.over) statusEl.innerHTML = s.winner < 0 ? 'Empate!' : `<b style="color:${PCOL[s.winner]}">${esc(p.name)}</b> venceu!`;
          else statusEl.innerHTML = `Vez de <b style="color:${PCOL[s.turn]}">${esc(p.name)}</b>${!ctx.hotseat && ctx.mySeats[0] === s.turn ? ' (tu)' : ''}`;
        },
        destroy() { document.removeEventListener('keydown', key); }
      };
    }
  });
})(window.Omni);
