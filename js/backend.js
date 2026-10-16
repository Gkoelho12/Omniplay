/* OmniPlay · camada de dados (Supabase + modo offline/convidado) */
(function (O) {
  const { LS, levelInfo, REWARD, uid, AVATARS } = O.util;
  const CFG = window.OMNI_CONFIG || {};

  const listeners = {};
  const Backend = {
    sb: null,
    configured: false,
    user: null,            // perfil da conta (null = convidado)
    guest: null,           // perfil local de convidado
    onlineIds: new Set(),  // amigos/utilizadores online (presence)
    hub: null,

    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    emit(evt, data) { (listeners[evt] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); },

    get account() { return !!this.user; },
    get netOk() { return navigator.onLine; },
    /** Pode falar com o servidor? */
    get canNet() { return !!(this.sb && this.user && navigator.onLine); },
    /** Perfil ativo (conta ou convidado) */
    me() { return this.user || this.guest; },

    /* ============ Arranque ============ */
    async init() {
      this.configured = !!(CFG.SUPABASE_ANON_KEY && window.supabase);
      this.guest = LS.get('guest', null) || {
        id: null, username: 'convidado', display_name: 'Convidado',
        avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], color: Math.floor(Math.random() * 360),
        xp: 0, coins: 0, bio: '', history: []
      };
      LS.set('guest', this.guest);

      const cached = LS.get('profile', null);
      const isLoggedIn = LS.get('loggedIn', false);

      if (this.configured) {
        this.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: 'omni.auth' },
          realtime: { params: { eventsPerSecond: 20 } }
        });
        let session = null;
        try { session = (await this.sb.auth.getSession()).data.session; } catch { /* offline */ }
        if (session) {
          this.user = cached && cached.id === session.user.id ? cached : null;
          if (navigator.onLine) await this.refreshProfile(session.user.id).catch(() => {});
        } else if (cached && isLoggedIn && !navigator.onLine) {
          this.user = cached; // offline: usa a conta em cache
        }
        this.sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && this.user) this._clearAccount(); });
      } else {
        // Sem Supabase: restaura sessão local se existir
        if (cached && isLoggedIn) {
          this.user = cached;
        }
      }

      window.addEventListener('online', () => { this.emit('net'); this.flushQueue(); this.joinHub(); });
      window.addEventListener('offline', () => this.emit('net'));
      if (this.user) { this.flushQueue(); this.joinHub(); }
    },

    /* ============ Autenticação ============ */
    _email(username) { return `${username}@${CFG.EMAIL_DOMAIN || 'omniplay.app'}`; },
    validUsername(u) { return /^[a-z0-9_]{3,16}$/.test(u); },

    getSavedAccounts() {
      const accounts = LS.get('accounts', {});
      return Object.values(accounts).map((a) => ({
        username: a.username,
        display_name: a.display_name || a.username,
        avatar: a.avatar || '🎮',
        color: a.color ?? 190,
        xp: a.xp || 0
      }));
    },

    async signUp(username, password, avatar, color) {
      username = (username || '').trim().toLowerCase();
      if (!this.validUsername(username)) throw new Error('Username deve ter 3 a 16 caracteres (letras, números ou _).');
      if (!password || password.length < 4) throw new Error('A password precisa de pelo menos 4 caracteres.');

      if (this.configured) {
        const { data, error } = await this.sb.auth.signUp({
          email: this._email(username), password,
          options: { data: { username, display_name: username, avatar, color } }
        });
        if (error) throw new Error(/already|registered/i.test(error.message) ? 'Esse username já existe.' : error.message);
        if (!data.session) throw new Error('Desativa "Confirm email" no Supabase (Authentication > Providers > Email).');
        await this.refreshProfile(data.user.id);
        this._afterLogin();
        return this.user;
      }

      // Registo Local / Offline
      const accounts = LS.get('accounts', {});
      if (accounts[username]) throw new Error('O username "@' + username + '" já existe neste dispositivo.');

      const bonusXp = this.guest ? (this.guest.xp || 0) : 0;
      const bonusCoins = this.guest ? (this.guest.coins || 0) : 0;
      const bonusHist = this.guest ? (this.guest.history || []) : [];

      const newAccount = {
        id: 'loc_' + uid(12),
        username,
        display_name: username,
        password,
        avatar: avatar || AVATARS[0],
        color: typeof color === 'number' ? color : Math.floor(Math.random() * 360),
        xp: bonusXp,
        coins: 50 + bonusCoins,
        bio: 'Jogador do OmniPlay 🚀',
        created_at: new Date().toISOString(),
        history: bonusHist
      };

      accounts[username] = newAccount;
      LS.set('accounts', accounts);
      this.user = newAccount;
      LS.set('profile', newAccount);
      this._afterLogin();
      return newAccount;
    },

    async signIn(username, password) {
      username = (username || '').trim().toLowerCase();
      if (!username) throw new Error('Por favor introduz o teu username.');
      if (!password) throw new Error('Por favor introduz a tua password.');

      if (this.configured) {
        const { data, error } = await this.sb.auth.signInWithPassword({ email: this._email(username), password });
        if (error) throw new Error(/invalid/i.test(error.message) ? 'Username ou password incorretos.' : error.message);
        await this.refreshProfile(data.user.id);
        this._afterLogin();
        return this.user;
      }

      // Login Local / Offline
      const accounts = LS.get('accounts', {});
      const acc = accounts[username];
      if (!acc) throw new Error('Conta "@' + username + '" não encontrada neste dispositivo. Clica em "Criar conta" para te registares!');
      if (acc.password !== password) throw new Error('Password incorreta. Tenta novamente.');

      this.user = acc;
      LS.set('profile', acc);
      this._afterLogin();
      return acc;
    },

    _afterLogin() { LS.set('loggedIn', true); this.flushQueue(); this.joinHub(); this.emit('auth'); },

    async signOut() {
      try { await this.sb?.auth.signOut(); } catch { /* ignore */ }
      this._clearAccount();
    },
    _clearAccount() {
      this.user = null;
      LS.del('profile'); LS.set('loggedIn', false);
      this.leaveHub();
      this.emit('auth');
    },

    async refreshProfile(id) {
      id = id || this.user?.id;
      if (!this.sb) return this.user;
      const { data, error } = await this.sb.from('profiles').select('*').eq('id', id).single();
      if (error) throw error;
      this.user = data;
      LS.set('profile', data);
      this.emit('profile');
      return data;
    },

    async updateProfile(patch) {
      if (!this.user) {
        Object.assign(this.guest, patch); LS.set('guest', this.guest); this.emit('profile'); return;
      }
      Object.assign(this.user, patch); LS.set('profile', this.user);
      const accounts = LS.get('accounts', {});
      if (accounts[this.user.username]) {
        Object.assign(accounts[this.user.username], patch);
        LS.set('accounts', accounts);
      }
      this.emit('profile');
      if (this.canNet) {
        const { error } = await this.sb.from('profiles').update(patch).eq('id', this.user.id);
        if (error) throw error;
      }
    },

    /* ============ Cache offline de leituras ============ */
    async cached(key, fn) {
      const k = 'c.' + (this.user?.id || 'guest') + '.' + key;
      try {
        if (!this.canNet) throw new Error('offline');
        const v = await fn();
        LS.set(k, { t: Date.now(), v });
        return { data: v, stale: false };
      } catch (e) {
        const c = LS.get(k, null);
        if (c) return { data: c.v, stale: true };
        throw e;
      }
    },

    /* ============ Perfis ============ */
    async getProfile(idOrName) {
      const isId = /^[0-9a-f-]{36}$/i.test(idOrName);
      return this.cached('p.' + idOrName, async () => {
        const q = this.sb.from('profiles').select('id,username,display_name,avatar,color,bio,xp,coins,created_at');
        const { data, error } = await (isId ? q.eq('id', idOrName) : q.eq('username', idOrName.toLowerCase())).single();
        if (error) throw error;
        return data;
      });
    },

    async searchUsers(text) {
      text = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!text) return [];
      const { data, error } = await this.sb.from('profiles')
        .select('id,username,display_name,avatar,color,xp').ilike('username', text + '%')
        .neq('id', this.user.id).limit(10);
      if (error) throw error;
      return data;
    },

    async getLeaderboard() {
      return this.cached('lb', async () => {
        const { data, error } = await this.sb.rpc('leaderboard');
        if (error) throw error;
        return data;
      });
    },

    /* ============ Amigos ============ */
    async getFriends() {
      return this.cached('friends', async () => {
        const me = this.user.id;
        const { data: rows, error } = await this.sb.from('friendships')
          .select('id,requester,addressee,status').or(`requester.eq.${me},addressee.eq.${me}`);
        if (error) throw error;
        const ids = [...new Set(rows.map((r) => (r.requester === me ? r.addressee : r.requester)))];
        let profs = [];
        if (ids.length) {
          const r = await this.sb.from('profiles').select('id,username,display_name,avatar,color,xp').in('id', ids);
          if (r.error) throw r.error;
          profs = r.data;
        }
        const byId = Object.fromEntries(profs.map((p) => [p.id, p]));
        const out = { friends: [], incoming: [], outgoing: [] };
        rows.forEach((r) => {
          const other = byId[r.requester === me ? r.addressee : r.requester];
          if (!other) return;
          const item = { fid: r.id, profile: other };
          if (r.status === 'accepted') out.friends.push(item);
          else if (r.addressee === me) out.incoming.push(item);
          else out.outgoing.push(item);
        });
        out.friends.sort((a, b) => a.profile.username.localeCompare(b.profile.username));
        return out;
      });
    },

    async getRelation(otherId) {
      if (!this.canNet) return null;
      const me = this.user.id;
      const { data } = await this.sb.from('friendships').select('id,requester,addressee,status')
        .or(`and(requester.eq.${me},addressee.eq.${otherId}),and(requester.eq.${otherId},addressee.eq.${me})`).maybeSingle();
      return data ? { id: data.id, status: data.status, mine: data.requester === me } : null;
    },

    async sendRequest(otherId) {
      const { error } = await this.sb.from('friendships').insert({ requester: this.user.id, addressee: otherId });
      if (error) throw new Error(error.code === '23505' ? 'Já existe um pedido ou amizade com este jogador.' : error.message);
    },
    async acceptRequest(fid) {
      const { error } = await this.sb.from('friendships').update({ status: 'accepted' }).eq('id', fid);
      if (error) throw error;
    },
    async removeFriendship(fid) {
      const { error } = await this.sb.from('friendships').delete().eq('id', fid);
      if (error) throw error;
    },

    /* ============ Estatísticas ============ */
    async getAllH2H() {
      return this.cached('h2h', async () => {
        const { data, error } = await this.sb.rpc('friends_head_to_head');
        if (error) throw error;
        return data;
      });
    },
    async getH2H(other) {
      return this.cached('h2h.' + other, async () => {
        const { data, error } = await this.sb.rpc('head_to_head', { p_user: this.user.id, p_other: other });
        if (error) throw error;
        return data;
      });
    },
    async getUserStats(id) {
      if (!id || (this.user && this.user.id === id && !this.canNet)) {
        const hist = (this.user && this.user.id === id) ? (this.user.history || []) : (this.guest.history || []);
        return { data: this._calcStats(hist), stale: false };
      }
      return this.cached('stats.' + id, async () => {
        const { data, error } = await this.sb.rpc('user_stats', { p_user: id });
        if (error) throw error;
        return data;
      });
    },
    _calcStats(hist) {
      const m = {};
      (hist || []).forEach((h) => {
        const s = (m[h.game_id] = m[h.game_id] || { game_id: h.game_id, played: 0, wins: 0, losses: 0, draws: 0 });
        s.played++; if (h.result === 'win') s.wins++; else if (h.result === 'loss') s.losses++; else s.draws++;
      });
      return Object.values(m);
    },
    _guestStats() {
      return this._calcStats(this.guest.history || []);
    },

    async getHistory(id, limit = 30) {
      if (!id || (this.user && this.user.id === id && !this.canNet)) {
        const hist = (this.user && this.user.id === id) ? (this.user.history || []) : (this.guest.history || []);
        return { data: hist.slice(0, limit), stale: false };
      }
      return this.cached('hist.' + id, async () => {
        const { data, error } = await this.sb.from('match_players')
          .select('result,score,xp_gain,played_at,match:matches(id,game_id,mode,duration_s,players:match_players(user_id,name,seat,result,score))')
          .eq('user_id', id).order('played_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return data.filter((r) => r.match).map((r) => ({
          game_id: r.match.game_id, mode: r.match.mode, duration_s: r.match.duration_s,
          played_at: r.played_at, result: r.result, score: r.score, xp_gain: r.xp_gain,
          players: (r.match.players || []).sort((a, b) => a.seat - b.seat)
        }));
      });
    },

    /* ============ Guardar partidas ============ */
    /** rec = { key, game, mode:'online'|'local', duration, players:[{user_id,name,seat,result,score}] } */
    async submitMatch(rec) {
      const r0 = rec.players[0];
      if (!this.user) { // convidado: tudo local
        const g = this.guest, rw = REWARD[r0.result] || REWARD.loss;
        g.xp += rw.xp; g.coins += rw.coins;
        g.history = [{ game_id: rec.game, mode: rec.mode, duration_s: rec.duration, played_at: new Date().toISOString(),
          result: r0.result, score: r0.score, xp_gain: rw.xp, players: rec.players }, ...(g.history || [])].slice(0, 50);
        LS.set('guest', g); this.emit('profile');
        return;
      }
      const mine = rec.players.find((p) => p.user_id === this.user.id) || rec.players[0];
      if (!mine) return;
      const rw = REWARD[mine.result] || REWARD.loss;
      this.user.xp = (this.user.xp || 0) + rw.xp;
      this.user.coins = (this.user.coins || 0) + rw.coins;
      this.user.history = [{
        game_id: rec.game, mode: rec.mode, duration_s: rec.duration, played_at: new Date().toISOString(),
        result: mine.result, score: mine.score, xp_gain: rw.xp, players: rec.players
      }, ...(this.user.history || [])].slice(0, 50);
      LS.set('profile', this.user);
      const accounts = LS.get('accounts', {});
      if (accounts[this.user.username]) {
        accounts[this.user.username] = this.user;
        LS.set('accounts', accounts);
      }
      this.emit('profile');
      if (this.canNet) await this._send(rec);
    },

    async _send(rec) {
      if (!this.canNet) return this._enqueue(rec);
      const { error } = await this.sb.rpc('submit_match', {
        p_client_key: rec.key, p_game: rec.game, p_mode: rec.mode, p_duration: rec.duration, p_players: rec.players
      });
      if (error) {
        if (!error.code) return this._enqueue(rec); // erro de rede -> tenta mais tarde
        console.warn('submit_match falhou:', error.message);
        return;
      }
      this.refreshProfile().catch(() => {});
    },
    _enqueue(rec) {
      const q = LS.get('queue', []);
      if (!q.find((x) => x.key === rec.key)) q.push(rec);
      LS.set('queue', q);
      this.emit('queue', q.length);
    },
    async flushQueue() {
      if (!this.canNet) return;
      let q = LS.get('queue', []);
      if (!q.length) return;
      const rest = [];
      for (const rec of q) {
        if (!rec.players.some((p) => p.user_id === this.user.id)) continue; // de outra conta
        const { error } = await this.sb.rpc('submit_match', {
          p_client_key: rec.key, p_game: rec.game, p_mode: rec.mode, p_duration: rec.duration, p_players: rec.players
        });
        if (error && !error.code) rest.push(rec);
      }
      LS.set('queue', rest);
      this.emit('queue', rest.length);
      this.refreshProfile().catch(() => {});
    },

    /* ============ Hub realtime: presença + convites ============ */
    joinHub() {
      if (!this.canNet || this.hub) return;
      const ch = this.sb.channel('omni-hub', { config: { presence: { key: this.user.id }, broadcast: { self: false } } });
      ch.on('presence', { event: 'sync' }, () => {
        this.onlineIds = new Set(Object.keys(ch.presenceState()));
        this.emit('presence');
      });
      ch.on('broadcast', { event: 'invite' }, ({ payload }) => {
        if (payload && payload.to === this.user.id) this.emit('invite', payload);
      });
      ch.subscribe(async (st) => { if (st === 'SUBSCRIBED') await ch.track({ at: Date.now() }); });
      this.hub = ch;
    },
    leaveHub() {
      if (this.hub) { try { this.sb.removeChannel(this.hub); } catch { /* ignore */ } }
      this.hub = null; this.onlineIds = new Set(); this.emit('presence');
    },
    sendInvite(toId, room, game) {
      if (!this.hub) return;
      const me = this.user;
      this.hub.send({ type: 'broadcast', event: 'invite',
        payload: { to: toId, room, game, from: { id: me.id, username: me.username, display_name: me.display_name } } });
    },

    newKey() { return uid(16); }
  };

  O.Backend = Backend;
})(window.Omni);
