/* OmniPlay · utilitários partilhados (UI helpers, XP/níveis, avatares) */
window.Omni = window.Omni || {};
(function (O) {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rand = (a, b) => a + Math.random() * (b - a);
  const uid = (n = 8) => Array.from({ length: n }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');

  const LS = {
    get(k, d) { try { const v = localStorage.getItem('omni.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('omni.' + k, JSON.stringify(v)); } catch { /* quota */ } },
    del(k) { try { localStorage.removeItem('omni.' + k); } catch { /* ignore */ } }
  };

  /* ---------- Progressão unificada ---------- */
  // nível = floor(sqrt(xp/100)) + 1   ->  100xp = nv2, 400xp = nv3, 900xp = nv4 ...
  function levelInfo(xp) {
    xp = Math.max(0, xp | 0);
    const level = Math.floor(Math.sqrt(xp / 100)) + 1;
    const base = 100 * (level - 1) ** 2;
    const next = 100 * level ** 2;
    return { level, cur: xp - base, need: next - base, pct: Math.min(100, ((xp - base) / (next - base)) * 100) };
  }
  const FRAMES = [
    { cls: 'f0', min: 1, name: 'Sem moldura' },
    { cls: 'f1', min: 3, name: 'Anel Ciano' },
    { cls: 'f2', min: 6, name: 'Pulso Violeta' },
    { cls: 'f3', min: 10, name: 'Chama Elétrica' },
    { cls: 'f4', min: 15, name: 'Omni Prismático' }
  ];
  function frameFor(xp) {
    const l = levelInfo(xp).level;
    let f = FRAMES[0];
    for (const fr of FRAMES) if (l >= fr.min) f = fr;
    return f;
  }
  const REWARD = { win: { xp: 50, coins: 20 }, draw: { xp: 25, coins: 10 }, loss: { xp: 15, coins: 5 } };

  const PCOL = ['#22d3ee', '#f472b6', '#facc15', '#a78bfa', '#34d399', '#fb923c'];
  const AVATARS = ['🎮', '👾', '🚀', '🦊', '🐺', '🐙', '🦄', '🐲', '🤖', '👻', '🦉', '🐼', '🔥', '⚡', '🌙', '🍀', '💎', '🎲', '🧠', '🦖'];

  function avatar(p, size = 44) {
    p = p || {};
    return `<span class="avatar ${frameFor(p.xp || 0).cls}" style="--h:${p.color ?? 190};--s:${size}px"><span class="av-face">${esc(p.avatar || '🎮')}</span></span>`;
  }

  /* ---------- Toasts ---------- */
  function toast(msg, opts = {}) {
    const root = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + (opts.type || '');
    t.innerHTML = `<span class="toast-msg">${msg}</span>`;
    (opts.actions || []).forEach((a) => {
      const b = document.createElement('button');
      b.className = 'btn btn-sm ' + (a.cls || 'btn-neon');
      b.textContent = a.label;
      b.onclick = () => { a.onClick && a.onClick(); close(); };
      t.appendChild(b);
    });
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    const close = () => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); };
    if (opts.ms !== 0) setTimeout(close, opts.ms || 3600);
    return close;
  }

  /* ---------- Modais ---------- */
  let modalStack = [];
  function openModal(html, opts = {}) {
    const root = $('#modal-root');
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal glass ${opts.cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
    root.appendChild(back);
    requestAnimationFrame(() => back.classList.add('in'));
    const api = {
      el: back.firstElementChild,
      close() {
        back.classList.remove('in');
        modalStack = modalStack.filter((m) => m !== api);
        setTimeout(() => back.remove(), 250);
        opts.onClose && opts.onClose();
      }
    };
    if (!opts.locked) back.addEventListener('mousedown', (e) => { if (e.target === back) api.close(); });
    api.locked = !!opts.locked;
    modalStack.push(api);
    return api;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) { const m = modalStack[modalStack.length - 1]; if (!m.locked) m.close(); }
  });
  function closeAllModals() { [...modalStack].forEach((m) => m.close()); }

  /* ---------- Transição de portal (anel "O" que se expande) ---------- */
  async function portal(midCallback) {
    const p = $('#portal');
    p.className = 'portal in';
    await sleep(520);
    await midCallback();
    p.className = 'portal out';
    await sleep(620);
    p.className = 'portal';
  }

  function fmtDate(t) {
    const d = new Date(t);
    const now = new Date();
    const same = d.toDateString() === now.toDateString();
    const hm = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    return same ? `Hoje ${hm}` : d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) + ' ' + hm;
  }

  O.util = { $, $$, esc, sleep, clone, rand, uid, LS, levelInfo, frameFor, FRAMES, REWARD, PCOL, AVATARS, avatar, toast, openModal, closeAllModals, portal, fmtDate };
})(window.Omni);
