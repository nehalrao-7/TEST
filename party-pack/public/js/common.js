/* Shared client helpers: socket, server clock, rendering, confetti, sounds. */
(function () {
  const App = {
    offset: 0,
    room: '',
    now() { return Date.now() + this.offset; },
    canonRoom(raw) {
      const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      return /^[A-Z0-9]{4}$/.test(s) ? s : '';
    },
    roomFromQuery() {
      return this.canonRoom(new URLSearchParams(location.search).get('room'));
    },

    // Live connection: fetch our view over HTTP, refresh whenever Supabase Realtime says the
    // game changed (or every few seconds as a fallback), and ask the server to tick when a
    // timer runs out. Returns an object with a socket-like emit(kind, action, cb).
    connect(role, token, onState, onAuthError) {
      let version = 0, stopped = false, inflight = false, again = false, debounce = null, deadlineTimer = null, failures = 0;
      const body = (extra) => JSON.stringify({ role, token, room: App.room, tvSecret: App.tvSecret || '', ...extra });
      App._token = token;
      const apply = (v) => {
        if (stopped || !v) return;
        App.offset = v.serverNow - Date.now();
        version = Math.max(version, v.version || 0);
        clearTimeout(deadlineTimer);
        if (v.nextDeadline) {
          const wait = v.nextDeadline - App.now() + (role === 'player' ? 600 + Math.random() * 900 : 0);
          deadlineTimer = setTimeout(() => refresh('tick'), Math.max(50, Math.min(wait, 120000)));
        }
        // Local mode (no realtime): reactions arrive with the TV view.
        if (Array.isArray(v.reactions)) {
          App._seenReacts = App._seenReacts || new Set();
          App._since = App._since || App.now() - 3000;
          v.reactions.forEach((r) => { if (!App._seenReacts.has(r.id) && r.at > App._since) { App._seenReacts.add(r.id); App._emitReact(r); } });
        }
        onState(v);
      };
      const authFail = (msg) => { stopped = true; onAuthError && onAuthError(msg); };
      async function refresh(kind = 'view') {
        if (stopped) return;
        if (inflight) { again = true; return; }
        inflight = true;
        try {
          const res = await fetch('/api/' + kind, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body() });
          const data = await res.json().catch(() => ({}));
          if (res.status === 401 || res.status === 404) return authFail(data.error || 'That room is not available.');
          if (!res.ok) throw new Error(data.error);
          failures = 0;
          document.body.classList.remove('offline');
          apply(data);
        } catch {
          if (++failures >= 2) document.body.classList.add('offline');
        } finally {
          inflight = false;
          if (again) { again = false; setTimeout(refresh, 100); }
        }
      }
      const soon = () => { clearTimeout(debounce); debounce = setTimeout(refresh, 60 + Math.random() * 140); };

      App.meta.then((meta) => {
        const rt = meta.realtime;
        if (rt && window.supabase) {
          const client = window.supabase.createClient(rt.url, rt.key);
          // The channel only carries "something changed" nudges for this room. Nothing on it is
          // trusted: each nudge just makes us fetch our own view (rate-limited by soon()).
          client.channel(rt.channel + ':' + App.room).on('broadcast', { event: 'state' }, ({ payload }) => {
            if (!payload || Number(payload.v) > version) soon();
          }).subscribe();
          setInterval(refresh, role === 'player' ? 8000 : 5000);
        } else {
          setInterval(refresh, 1200);
        }
      }).catch(() => setInterval(refresh, 1500));
      document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
      refresh();

      return {
        emit(_kind, action, cb) {
          fetch('/api/act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body({ action }) })
            .then(async (res) => {
              const data = await res.json().catch(() => ({}));
              if (res.status === 401) { authFail(data.error); return; }
              if (data.view) apply(data.view);
              if (cb) cb(data.error ? { error: data.error } : { ok: true });
            })
            .catch(() => cb && cb({ error: 'Connection problem — try again.' }));
        },
        disconnect() { stopped = true; clearTimeout(deadlineTimer); },
      };
    },

    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    // Replace innerHTML only when it changed, and never while the user is typing inside.
    patch(el, html, force) {
      if (!el) return;
      if (el._html === html) return;
      const a = document.activeElement;
      if (!force && a && el.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && el._html !== undefined) {
        el._dirty = html;
        if (!a._patchHook) {
          a._patchHook = true;
          // Apply the queued update after focus leaves, but never mid-click: replacing the DOM
          // between pointerdown and click would swallow the click.
          const flush = () => {
            if (App.pointerDown) { setTimeout(flush, 80); return; }
            if (el._dirty) { const h = el._dirty; el._dirty = null; App.patch(el, h); }
          };
          a.addEventListener('blur', () => { a._patchHook = false; setTimeout(flush, 250); }, { once: true });
        }
        return;
      }
      el._html = html;
      el._dirty = null;
      el.innerHTML = html;
    },

    toast(msg, err) {
      let t = document.querySelector('.toast');
      if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
      t.textContent = msg;
      t.classList.toggle('err', Boolean(err));
      t.classList.add('show');
      clearTimeout(t._h);
      t._h = setTimeout(() => t.classList.remove('show'), 2600);
    },

    async post(url, body) {
      const payload = { ...(body || {}) };
      if (this.room && payload.room == null) payload.room = this.room;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      return data;
    },

    // The mark: the four answer shapes.
    mark(size = 84) {
      return `<span class="mark" style="width:${size}px" aria-hidden="true">${App.shapes.map((s) => `<i>${s}</i>`).join('')}</span>`;
    },

    // ---------- theme packs ----------
    // The room's pack comes with every view. Before joining, we use the season where this
    // device is (the server knows the date; the time zone tells us the hemisphere).
    south() {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        return /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia|Port_Moresby|Noumea)|^Africa\/(Johannesburg|Maputo|Harare|Windhoek|Gaborone|Lusaka|Maseru|Mbabane|Blantyre)|^America\/(Sao_Paulo|Argentina|Buenos_Aires|Santiago|Montevideo|Asuncion|La_Paz|Lima|Punta_Arenas)|^Indian\/(Mauritius|Reunion|Antananarivo)|^Atlantic\/Stanley/.test(tz);
      } catch { return false; }
    },
    pack: '',
    setPack(id) {
      if (!id || id === App.pack) return;
      App.pack = id;
      document.documentElement.dataset.pack = id;
      try { localStorage.setItem('pp_pack', id); } catch { /* private mode */ }
      requestAnimationFrame(() => {
        const meta = document.querySelector('meta[name=theme-color]');
        if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      });
      App.ambient(id);
    },
    // Colours of the current pack, for the canvas effects.
    palette() {
      const cs = getComputedStyle(document.documentElement);
      const v = (n) => cs.getPropertyValue(n).trim();
      return [v('--accent'), v('--accent-2'), v('--score'), v('--optB'), v('--optC'), v('--optD')].filter(Boolean);
    },
    // Each pack has its own weather drifting behind the screens.
    AMBIENT: {
      classic: ['star', 22], spring: ['petal', 16], summer: ['bubble', 12], autumn: ['glyph', 12, ['🍂', '🍁']], winter: ['snow', 30],
      newyear: ['spark', 22], lunar: ['glyph', 8, ['🏮']], spooky: ['bat', 6, ['🦇']], lights: ['ember', 24], festive: ['snow', 26],
    },
    ambient(id) {
      document.querySelectorAll('.ambient').forEach((el) => el.remove());
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const [kind, count, glyphs] = App.AMBIENT[id] || App.AMBIENT.classic;
      const n = Math.round(count * (innerWidth < 700 ? 0.6 : 1));
      const rise = ['bubble', 'ember', 'spark'].includes(kind) || (kind === 'glyph' && id === 'lunar');
      const box = document.createElement('div');
      box.className = 'ambient';
      const r = (a, b) => a + Math.random() * (b - a);
      for (let i = 0; i < n; i++) {
        const el = document.createElement('i');
        el.className = `amb-${kind === 'bat' ? 'glyph amb-bat' : kind} ${kind === 'star' || kind === 'bat' ? '' : rise ? 'rise' : 'fall'}`;
        if (glyphs) el.textContent = glyphs[i % glyphs.length];
        el.style.left = r(0, 100).toFixed(1) + '%';
        if (kind === 'star' || kind === 'bat') el.style.top = r(4, kind === 'bat' ? 60 : 96).toFixed(1) + '%';
        el.style.setProperty('--s', r(5, 11).toFixed(1) + 'px');
        el.style.setProperty('--t', (kind === 'star' ? r(2.5, 6) : kind === 'bat' ? r(14, 26) : r(11, 24)).toFixed(1) + 's');
        el.style.setProperty('--d', (-r(0, 24)).toFixed(1) + 's');
        el.style.setProperty('--sway', r(-70, 70).toFixed(0) + 'px');
        el.style.setProperty('--spin', r(-360, 360).toFixed(0) + 'deg');
        el.style.setProperty('--o', r(0.25, glyphs ? 0.6 : 0.75).toFixed(2));
        box.appendChild(el);
      }
      document.body.prepend(box);
    },

    // Option shapes: triangle · diamond · circle · square (colour-blind friendly, matches TV & phone)
    shapes: [
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2z"/></svg>',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12z"/></svg>',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/></svg>',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/></svg>',
    ],
    shapeNames: ['Triangle', 'Diamond', 'Circle', 'Square'],

    // Count a number up inside an element (scores, points).
    countUp(el, to, ms = 900, from = 0) {
      if (!el) return;
      const t0 = performance.now();
      const step = (t) => {
        const f = Math.min(1, (t - t0) / ms);
        const e = 1 - Math.pow(1 - f, 3);
        el.textContent = Math.round(from + (to - from) * e).toLocaleString('en-US');
        if (f < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },

    vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* ignore */ } },

    // Timer elements: <div class="timer" data-start=ms data-end=ms><i></i></div>, <span data-count=ms>
    tickTimers() {
      const t = App.now();
      document.querySelectorAll('[data-end]').forEach((el) => {
        const s = Number(el.dataset.start), e = Number(el.dataset.end);
        const f = Math.max(0, Math.min(1, (e - t) / (e - s)));
        const bar = el.firstElementChild;
        if (bar) bar.style.transform = `scaleX(${f})`;
      });
      document.querySelectorAll('[data-count]').forEach((el) => {
        const left = Math.max(0, Math.ceil((Number(el.dataset.count) - t) / 1000));
        if (el.textContent !== String(left)) {
          el.textContent = left;
          if (el.dataset.tick && left <= 5 && left > 0) App.sfx('tick');
        }
      });
      requestAnimationFrame(App.tickTimers);
    },

    // ---------- confetti and fireworks, in the colours of the current pack ----------
    _canvas() {
      let c = document.getElementById('confetti');
      if (!c) { c = document.createElement('canvas'); c.id = 'confetti'; document.body.appendChild(c); }
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (c.width !== Math.round(innerWidth * dpr) || c.height !== Math.round(innerHeight * dpr)) { c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr); }
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    },
    _fx: { parts: [], running: false },
    _run() {
      const fx = App._fx;
      if (fx.running) return;
      fx.running = true;
      const ctx = App._canvas();
      let last = performance.now();
      const step = (t) => {
        const k = Math.min(2.5, (t - last) / 16.7); last = t;
        const W = innerWidth, H = innerHeight;
        ctx.clearRect(0, 0, W, H);
        const P = fx.parts;
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i];
          if (p.delay > 0) { p.delay -= k; continue; }
          if (p.rocket) {
            p.x += p.vx * k; p.y += p.vy * k; p.vy += 0.12 * k;
            ctx.globalAlpha = 0.9; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 6.28); ctx.fill();
            if (p.vy >= -0.6) {
              const n = 56 + ((Math.random() * 30) | 0);
              for (let j = 0; j < n; j++) {
                const a = (j / n) * 6.28, v = 1.4 + Math.random() * 4;
                P.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 55 + Math.random() * 35, max: 90, size: 2.4, col: p.col, g: 0.05, dot: true });
              }
              P.splice(i, 1);
            }
            continue;
          }
          p.x += p.vx * k; p.y += p.vy * k; p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g * k; p.life -= k; p.rot += (p.vr || 0) * k;
          if (p.life <= 0 || p.y > H + 30) { P.splice(i, 1); continue; }
          const f = Math.min(1, p.life / (p.max * 0.35));
          ctx.globalAlpha = f; ctx.fillStyle = p.col;
          if (p.dot) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + f * 0.5), 0, 6.28); ctx.fill(); }
          else {
            // A paper piece that flutters as it falls.
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.rot * 1.7));
            ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size); ctx.restore();
          }
        }
        ctx.globalAlpha = 1;
        if (P.length) requestAnimationFrame(step);
        else { ctx.clearRect(0, 0, W, H); fx.running = false; }
      };
      requestAnimationFrame(step);
    },
    confetti(power = 1, origin) {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const cols = App.palette();
      const W = innerWidth, H = innerHeight;
      const from = origin || [{ x: W * 0.1, y: H * 0.72, dir: -1.05 }, { x: W * 0.9, y: H * 0.72, dir: -2.09 }];
      const n = Math.round(46 * power);
      from.forEach((o) => {
        for (let i = 0; i < n; i++) {
          const a = o.dir + (Math.random() - 0.5) * 0.9, v = (7 + Math.random() * 9) * Math.min(1.3, Math.max(0.75, H / 800));
          App._fx.parts.push({ x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.24, life: 110 + Math.random() * 60, max: 170, size: 3.5 + Math.random() * 3.5, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, col: cols[(Math.random() * cols.length) | 0], delay: Math.random() * 8 });
        }
      });
      App._run();
    },
    fireworks(power = 1, zone) {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const cols = App.palette();
      const W = innerWidth, H = innerHeight;
      const rockets = Math.max(1, Math.round((zone ? 2 : 4) * power));
      for (let r = 0; r < rockets; r++) {
        const side = Math.random() < 0.5;
        const x = zone === 'sides' ? W * (side ? 0.06 + Math.random() * 0.14 : 0.8 + Math.random() * 0.14) : W * (0.18 + Math.random() * 0.64);
        const ty = H * (0.1 + Math.random() * 0.28);
        App._fx.parts.push({ rocket: true, x, y: H + 10, vx: (Math.random() - 0.5) * 1.4, vy: -Math.sqrt(2 * 0.12 * (H - ty)), delay: r * 16, col: cols[(Math.random() * cols.length) | 0] });
      }
      App._run();
    },

    // ---------- sounds (WebAudio, no files), on a pentatonic scale so everything sounds friendly ----------
    audio: null,
    soundOn: false,
    enableSound() {
      try {
        this.audio = this.audio || new (window.AudioContext || window.webkitAudioContext)();
        this.audio.resume();
        this.soundOn = true;
      } catch { this.soundOn = false; }
    },
    sfx(name) {
      if (!this.soundOn || !this.audio) return;
      const ac = this.audio, t0 = ac.currentTime;
      const tone = (freq, start, dur, type = 'sine', vol = 0.2, bend = 0) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t0 + start);
        if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, t0 + start + dur);
        g.gain.setValueAtTime(0, t0 + start);
        g.gain.linearRampToValueAtTime(vol, t0 + start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
        o.connect(g); g.connect(ac.destination);
        o.start(t0 + start); o.stop(t0 + start + dur + 0.05);
      };
      const pluck = (f, s, v = 0.18) => { tone(f, s, 0.5, 'triangle', v); tone(f * 2, s, 0.25, 'sine', v * 0.35); };
      const S = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880];
      const seqs = {
        tick: () => tone(1046, 0, 0.06, 'square', 0.05),
        buzz: () => { tone(196, 0, 0.35, 'sawtooth', 0.14); tone(293, 0, 0.35, 'square', 0.06); },
        reveal: () => [0, 2, 4, 7].forEach((n, i) => pluck(S[n], i * 0.08)),
        fanfare: () => [0, 2, 3, 4, 5, 7, 9].forEach((n, i) => pluck(S[n], i * 0.1, 0.2)),
        whoosh: () => tone(220, 0, 0.45, 'sawtooth', 0.04, 3),
        power: () => [4, 7, 9, 7, 9].forEach((n, i) => tone(S[n], i * 0.07, 0.2, 'square', 0.08)),
        wrong: () => { tone(220, 0, 0.28, 'sawtooth', 0.12, 0.7); tone(165, 0.22, 0.45, 'sawtooth', 0.12, 0.7); },
        join: () => [5, 7].forEach((n, i) => pluck(S[n], i * 0.09)),
        arrive: () => [0, 1, 2, 4, 5].forEach((n, i) => pluck(S[n] * 2, i * 0.06, 0.12)),
        drumroll: () => { for (let i = 0; i < 18; i++) tone(90 + Math.random() * 30, i * 0.055, 0.08, 'triangle', 0.12 + i * 0.006); },
        whoo: () => tone(500, 0, 0.6, 'sine', 0.08, 2.4),
        pop: () => tone(880, 0, 0.08, 'sine', 0.1, 1.6),
        ding: () => { pluck(S[7], 0, 0.2); pluck(S[9], 0.12, 0.2); },
      };
      (seqs[name] || seqs.tick)();
    },

    // ---------- emoji reactions (sent with the player's token; the TV reads them from its view) ----------
    reactHandlers: [],
    onReact(fn) { this.reactHandlers.push(fn); },
    _emitReact(r) { this.reactHandlers.forEach((fn) => fn(r)); },
    react(emoji, from) {
      const r = { emoji, name: from && from.name, avatar: from && from.avatar, room: this.room, id: Math.random().toString(36).slice(2) };
      fetch('/api/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji, room: this.room, token: this._token }) }).catch(() => {});
      this._emitReact(r);
    },
    showReaction(r) {
      let layer = document.querySelector('.react-layer');
      if (!layer) { layer = document.createElement('div'); layer.className = 'react-layer'; document.body.appendChild(layer); }
      const el = document.createElement('div');
      el.className = 'react';
      el.style.left = (8 + Math.random() * 84) + '%';
      el.style.setProperty('--dx', (Math.random() * 120 - 60).toFixed(0) + 'px');
      el.innerHTML = `<span class="e">${App.esc(r.emoji)}</span>${r.name ? `<span class="n">${App.esc(r.name)}</span>` : ''}`;
      layer.appendChild(el);
      setTimeout(() => el.remove(), 3800);
    },

    // The pack for the room, plus a tint for the game on screen so each one feels a little different.
    GAME_TINTS: ['#F59F0A', '#E5487F', '#1AA6B7', '#6C5CE7', '#35C27C', '#FF7A45'],
    applyTheme(S) {
      if (S && S.theme) App.setPack(S.theme.pack);
      const order = S && S.flow && Array.isArray(S.flow.order) ? S.flow.order : [];
      const i = S && S.live ? order.indexOf(S.live.gameId) : -1;
      const tint = i < 0 ? '' : App.GAME_TINTS[i % App.GAME_TINTS.length];
      if (document.body.dataset.tint !== tint) {
        document.body.dataset.tint = tint;
        if (tint) document.body.style.setProperty('--game', tint); else document.body.style.removeProperty('--game');
      }
    },
    fmt(n) { return Number(n || 0).toLocaleString('en-US'); },
    letters: ['A', 'B', 'C', 'D', 'E', 'F'],
  };
  document.addEventListener('pointerdown', () => { App.pointerDown = true; }, true);
  document.addEventListener('pointerup', () => { setTimeout(() => { App.pointerDown = false; }, 50); }, true);
  document.addEventListener('pointercancel', () => { App.pointerDown = false; }, true);
  window.App = App;
  requestAnimationFrame(App.tickTimers);
  // Start in the last pack this device saw, then (outside a room) the season where it is.
  let stored = '';
  try { stored = localStorage.getItem('pp_pack') || ''; } catch { /* private mode */ }
  const boot = () => App.setPack(App.AMBIENT[stored] ? stored : 'classic');
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
  App.meta = fetch('/api/meta').then((r) => r.json()).catch(() => ({}));
  App.meta.then((m) => { App.season = m.themes ? (App.south() ? m.themes.south : m.themes.north) : ''; if (!App.room && App.season) App.setPack(App.season); });
})();
