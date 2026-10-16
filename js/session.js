/* OmniPlay · registo de jogos, salas online (Supabase Realtime) e sessões de jogo
 *
 * CONTRATO DE UM JOGO  (OmniPlay.games.register({...}))
 *   id, name, tagline, icon, hue, minPlayers, maxPlayers, soon?
 *   init(n, {players})          -> estado inicial (JSON puro)
 *   reduce(state, action, seat, now) -> novo estado (pode alterar o recebido) ou null se inválido
 *   tick?(state, now)           -> novo estado ou null (só corre no anfitrião/local, a cada 100 ms)
 *   result(state)               -> null | [{seat, result:'win'|'loss'|'draw', score}]
 *   info?(state)                -> {turn:seat|null, scores:[...]}  (para a barra de jogadores)
 *   mount(root, ctx)            -> {update(state), destroy()}
 *       ctx = { players, mySeats, dispatch(action, seat?), online, hotseat }
 * O anfitrião (ou o dispositivo local) é a autoridade: os convidados enviam ações e recebem estados.
 */
(function (O) {
  const { uid, sleep, clone } = O.util;
  const B = O.Backend;

  /* ============ Registo ============ */
  const games = {
    list: [],
    register(g) { this.list.push(g); },
    get(id) { return this.list.find((g) => g.id === id); }
  };

  /* ============ Sala online ============ */
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

  class Room {
    constructor(code, game, isHost) {
      this.code = code; this.game = game; this.isHost = isHost;
      this.key = uid(8); this.t = Date.now(); this.playing = false;
      this.members = []; this.handlers = {}; this.closed = false;
    }
    on(evt, fn) { (this.handlers[evt] = this.handlers[evt] || []).push(fn); return this; }
    emit(evt, data) { (this.handlers[evt] || []).forEach((fn) => fn(data)); }

    meta() {
      const me = B.me();
      return { uid: B.user ? B.user.id : null, name: me.display_name || me.username, avatar: me.avatar, color: me.color, xp: me.xp,
        host: this.isHost, t: this.t, playing: this.playing };
    }

    async open() {
      const ch = this.ch = B.sb.channel('room:' + this.code, { config: { presence: { key: this.key }, broadcast: { self: false, ack: false } } });
      ch.on('presence', { event: 'sync' }, () => this._sync());
      ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (this.closed) return;
        (leftPresences || []).forEach((p) => this.emit(p.host ? 'hostleft' : 'memberleft', p));
      });
      ['start', 'state', 'action', 'abort', 'need_state'].forEach((evt) => ch.on('broadcast', { event: evt }, ({ payload }) => this.emit(evt, payload)));
      await new Promise((res, rej) => {
        let done = false;
        const to = setTimeout(() => { if (!done) { done = true; rej(new Error('Sem ligação ao servidor.')); } }, 9000);
        ch.subscribe((st) => {
          if (done) return;
          if (st === 'SUBSCRIBED') { done = true; clearTimeout(to); res(); }
          else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { done = true; clearTimeout(to); rej(new Error('Sem ligação ao servidor.')); }
        });
      });
      await ch.track(this.meta());
      await sleep(700); // deixa a presença sincronizar
      this._sync();
    }

    _sync() {
      const st = this.ch.presenceState();
      const list = Object.entries(st).map(([key, metas]) => ({ key, ...metas[0] }));
      list.sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0) || a.t - b.t || a.key.localeCompare(b.key));
      this.members = list;
      this.emit('members', list);
    }

    /** Validação feita por quem entra */
    checkJoin() {
      if (!this.members.some((m) => m.host)) throw new Error('Sala não encontrada.');
      const host = this.members.find((m) => m.host);
      if (host.playing) throw new Error('Esse jogo já começou.');
      const idx = this.members.findIndex((m) => m.key === this.key);
      if (idx >= this.game.maxPlayers || idx < 0) throw new Error('Sala cheia.');
      const me = B.user && B.user.id;
      if (me && this.members.some((m) => m.uid === me && m.key !== this.key)) throw new Error('Já estás nesta sala noutro separador.');
    }

    async setPlaying(v) { this.playing = v; await this.ch.track(this.meta()); }
    send(event, payload) { if (!this.closed) this.ch.send({ type: 'broadcast', event, payload }); }
    close() { this.closed = true; try { B.sb.removeChannel(this.ch); } catch { /* ignore */ } }
  }

  const Rooms = {
    async create(game) {
      for (let i = 0; i < 4; i++) {
        const room = new Room(newCode(), game, true);
        await room.open();
        if (room.members.filter((m) => m.host).length <= 1) return room; // código livre
        room.close();
      }
      throw new Error('Não foi possível criar a sala.');
    },
    async join(code, game) {
      const room = new Room(code.toUpperCase(), game, false);
      await room.open();
      try { room.checkJoin(); } catch (e) { room.close(); throw e; }
      return room;
    }
  };

  /* ============ Sessão de jogo ============ */
  class GameSession {
    /** opts: {game, players:[{seat,name,avatar,color,xp,userId,key}], role:'local'|'host'|'guest', mySeats, room, token, onState, onFinish} */
    constructor(opts) {
      Object.assign(this, opts);
      this.state = null; this.version = 0; this.finished = false; this.view = null; this.startedAt = Date.now();
      this.mode = this.role === 'local' ? 'local' : 'online';
      this._bind();
      if (this.role !== 'guest') {
        this.state = this.game.init(this.players.length, { players: this.players });
        this.version = 1;
        if (this.role === 'host') this._broadcast();
        this._check();
      } else {
        setTimeout(() => { if (!this.state && !this.dead) this.room.send('need_state', {}); }, 900);
      }
      if (this.game.tick && this.role !== 'guest') {
        this.timer = setInterval(() => {
          if (this.finished || !this.state) return;
          const ns = this.game.tick(clone(this.state), Date.now());
          if (ns) this._set(ns);
        }, 100);
      }
    }

    _bind() {
      if (!this.room) return;
      this.room.on('state', (p) => { if (this.role === 'guest' && p.token === this.token) this._receive(p); });
      this.room.on('action', (p) => {
        if (this.role !== 'host' || p.token !== this.token) return;
        this._apply(p.action, p.seat);
      });
      this.room.on('need_state', () => { if (this.role === 'host') this._broadcast(); });
    }

    _receive(p) {
      if (p.v <= this.version) return;
      this.version = p.v; this.state = p.state;
      this.view && this.view.update(this.state);
      this.onState && this.onState(this.state);
      this._check();
    }

    _broadcast() { this.room.send('state', { token: this.token, v: this.version, state: this.state }); }

    mount(root) {
      const ctx = {
        players: this.players, mySeats: this.mySeats, online: this.mode === 'online', hotseat: this.mySeats.length > 1,
        dispatch: (action, seat) => this.dispatch(action, seat)
      };
      this.view = this.game.mount(root, ctx);
      if (this.state) { this.view.update(this.state); this.onState && this.onState(this.state); }
    }

    dispatch(action, seat) {
      if (this.finished) return;
      if (this.mySeats.length === 1) seat = this.mySeats[0];
      if (seat == null) seat = this.mySeats[0];
      if (this.role === 'guest') { this.room.send('action', { token: this.token, action, seat }); return; }
      this._apply(action, seat);
    }

    _apply(action, seat) {
      if (this.finished || !this.state) return;
      const ns = this.game.reduce(clone(this.state), action, seat, Date.now());
      if (ns) this._set(ns);
    }

    _set(ns) {
      this.state = ns; this.version++;
      if (this.role === 'host') this._broadcast();
      this.view && this.view.update(ns);
      this.onState && this.onState(ns);
      this._check();
    }

    _check() {
      if (this.finished || !this.state) return;
      const res = this.game.result(this.state);
      if (!res) return;
      this.finished = true; this.results = res;
      this.duration = Math.round((Date.now() - this.startedAt) / 1000);
      clearInterval(this.timer);
      setTimeout(() => this.onFinish && this.onFinish(res), 900); // deixa ver o último lance
    }

    /** Registo para guardar na base de dados (só o anfitrião/local o envia) */
    record() {
      const byseat = Object.fromEntries(this.results.map((r) => [r.seat, r]));
      return {
        key: (this.room ? this.room.code : 'L') + '-' + this.token + '-' + this.startedAt.toString(36),
        game: this.game.id, mode: this.mode, duration: this.duration,
        players: this.players.map((p) => ({
          user_id: p.userId || null, name: p.name, seat: p.seat,
          result: byseat[p.seat]?.result || 'loss', score: byseat[p.seat]?.score || 0
        }))
      };
    }

    destroy() {
      this.dead = true; clearInterval(this.timer);
      try { this.view && this.view.destroy(); } catch (e) { console.error(e); }
    }
  }

  O.games = games;
  O.Rooms = Rooms;
  O.GameSession = GameSession;
})(window.Omni);
