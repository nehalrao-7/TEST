/* Shared client helpers: socket, server clock, rendering, confetti, sounds. */
(function () {
  const App = {
    offset: 0,
    now() { return Date.now() + this.offset; },

    // Live connection: fetch our view over HTTP, refresh whenever Supabase Realtime says the
    // game changed (or every few seconds as a fallback), and ask the server to tick when a
    // timer runs out. Returns an object with a socket-like emit(kind, action, cb).
    connect(role, token, onState, onAuthError) {
      let version = 0, stopped = false, inflight = false, again = false, debounce = null, deadlineTimer = null, failures = 0;
      const body = (extra) => JSON.stringify({ role, token, ...extra });
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
          if (res.status === 401) return authFail(data.error || 'Please log in again.');
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

      fetch('/api/meta').then((r) => r.json()).then((meta) => {
        const rt = meta.realtime;
        if (rt && window.supabase) {
          const client = window.supabase.createClient(rt.url, rt.key);
          App._channel = client.channel(rt.channel).on('broadcast', { event: 'state' }, ({ payload }) => {
            if (!payload || payload.v > version) soon();
          }).on('broadcast', { event: 'react' }, ({ payload }) => { if (payload && payload.emoji) App._emitReact(payload); }).subscribe();
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
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      return data;
    },

    // Drifting embers + the marigold toran across the top.
    sparkles(n = 40) {
      if (!document.querySelector('.toran') && !document.body.classList.contains('no-toran')) {
        const t = document.createElement('div');
        t.className = 'toran';
        document.body.prepend(t);
      }
      const box = document.createElement('div');
      box.className = 'sparkles';
      for (let i = 0; i < n; i++) {
        const s = document.createElement('i');
        s.style.left = Math.random() * 100 + '%';
        s.style.animationDelay = (Math.random() * 14).toFixed(2) + 's';
        s.style.animationDuration = (9 + Math.random() * 10).toFixed(2) + 's';
        s.style.setProperty('--dx', (Math.random() * 80 - 40).toFixed(0) + 'px');
        if (Math.random() < 0.3) s.style.background = '#ff8a3c';
        box.appendChild(s);
      }
      document.body.prepend(box);
    },

    // Option shapes: diya · lotus · star · moon (colour-blind friendly, matches TV & phone)
    shapes: [
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12.5h19c-1 4.8-4.8 7.5-9.5 7.5s-8.5-2.7-9.5-7.5z"/><path d="M12 2.2c2.8 3.3 3.1 6.4 0 8.6-3.1-2.2-2.8-5.3 0-8.6z"/></svg>',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c2.2 2.6 2.8 6 0 10.5-2.8-4.5-2.2-7.9 0-10.5z"/><path d="M3.5 8.5c3.3.4 5.9 2.6 7.6 6.6-3.9.6-6.9-1.4-7.6-6.6zM20.5 8.5c-.7 5.2-3.7 7.2-7.6 6.6 1.7-4 4.3-6.2 7.6-6.6z"/><path d="M2.5 16.5h19c-1.9 2.8-5.6 4.2-9.5 4.2s-7.6-1.4-9.5-4.2z"/></svg>',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.6 4.3 4.9-1.1-1.1 4.9 4.3 2.6-4.3 2.6 1.1 4.9-4.9-1.1L12 22.5l-2.6-4.4-4.9 1.1 1.1-4.9L1.3 12l4.3-2.6-1.1-4.9 4.9 1.1z"/></svg>',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.2 2.5a9.6 9.6 0 1 0 6.3 16.6A8 8 0 0 1 15.2 2.5z"/></svg>',
    ],
    shapeNames: ['Diya', 'Lotus', 'Star', 'Moon'],

    // A brass diya with a living flame. lit=false shows an unlit lamp.
    diya(lit = true, size = 48) {
      return `<svg class="diya-svg ${lit ? '' : 'unlit'}" width="${size}" height="${size}" ${size !== 48 ? `style="width:${size}px;height:${size}px"` : ''} viewBox="0 0 64 64" aria-hidden="true">
        <ellipse class="glow" cx="32" cy="24" rx="20" ry="20" fill="url(#dg)"/>
        <defs><radialGradient id="dg"><stop offset="0" stop-color="#ffc93c" stop-opacity=".9"/><stop offset="1" stop-color="#f7931e" stop-opacity="0"/></radialGradient>
        <linearGradient id="db" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2d38a"/><stop offset=".55" stop-color="#c9973f"/><stop offset="1" stop-color="#8a6324"/></linearGradient></defs>
        <path d="M6 36 Q32 62 58 36 Q46 42 32 42 Q18 42 6 36Z" fill="url(#db)"/>
        <path d="M6 36 Q32 30 58 36 Q46 42 32 42 Q18 42 6 36Z" fill="#8a6324"/>
        <path d="M50 35 Q60 30 61 25 Q56 31 48 33Z" fill="url(#db)"/>
        <g class="flame"><path d="M32 8 C40 20 39 30 32 33 C25 30 24 20 32 8Z" fill="#f7931e"/><path d="M32 16 C36 23 36 29 32 31 C28 29 28 23 32 16Z" fill="#ffe9a8"/></g>
      </svg>`;
    },

    // Count a number up inside an element (scores, points).
    countUp(el, to, ms = 900, from = 0) {
      if (!el) return;
      const t0 = performance.now();
      const step = (t) => {
        const f = Math.min(1, (t - t0) / ms);
        const e = 1 - Math.pow(1 - f, 3);
        el.textContent = Math.round(from + (to - from) * e).toLocaleString('en-IN');
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

    // ---------- fireworks (anar + rockets) ----------
    confetti(power = 1) { App.fireworks(power); },
    fireworks(power = 1) {
      let c = document.getElementById('confetti');
      if (!c) { c = document.createElement('canvas'); c.id = 'confetti'; document.body.appendChild(c); }
      const ctx = c.getContext('2d');
      const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1;
      if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const palette = [['#ffc93c', '#fff3c4'], ['#f7931e', '#ffd28a'], ['#e8577f', '#ffd1e0'], ['#2ec4b6', '#c8fff8'], ['#fff3dc', '#ffffff'], ['#d7263d', '#ffb3bd']];
      App._fw = App._fw || { parts: [], running: false };
      const P = App._fw.parts;
      const rockets = Math.max(1, Math.round(3 * power));
      for (let r = 0; r < rockets; r++) {
        const x = W * (0.15 + Math.random() * 0.7), ty = H * (0.15 + Math.random() * 0.3);
        P.push({ rocket: true, x, y: H + 10, vx: (Math.random() - 0.5) * 1.5, vy: -(Math.sqrt(2 * 0.12 * (H - ty)) ), delay: r * 14, col: palette[(Math.random() * palette.length) | 0] });
      }
      // ground fountain (anar) for bigger moments
      if (power >= 1) for (let i = 0; i < 90 * power; i++) {
        P.push({ x: W / 2 + (Math.random() - 0.5) * 40, y: H, vx: (Math.random() - 0.5) * 4, vy: -(6 + Math.random() * 7), life: 70 + Math.random() * 40, max: 110, size: 1.8, col: palette[(Math.random() * 2) | 0], delay: (Math.random() * 40) | 0, g: 0.14 });
      }
      if (App._fw.running) return;
      App._fw.running = true;
      const step = () => {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i];
          if (p.delay > 0) { p.delay--; continue; }
          if (p.rocket) {
            p.x += p.vx; p.y += p.vy; p.vy += 0.12;
            ctx.fillStyle = '#ffd28a'; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 6.28); ctx.fill();
            if (p.vy >= -0.5) {
              const n = 70 + ((Math.random() * 40) | 0), ring = Math.random() < 0.5;
              for (let k = 0; k < n; k++) {
                const a = (k / n) * Math.PI * 2, v = ring ? 4.2 : 1 + Math.random() * 4.5;
                P.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 60 + Math.random() * 40, max: 100, size: 2.2, col: p.col, g: 0.06, twinkle: Math.random() < 0.35 });
              }
              P.splice(i, 1);
            }
            continue;
          }
          p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g; p.life--;
          if (p.life <= 0) { P.splice(i, 1); continue; }
          const f = p.life / p.max;
          if (p.twinkle && Math.random() < 0.3) continue;
          ctx.globalAlpha = Math.min(1, f * 1.4);
          ctx.fillStyle = f > 0.6 ? p.col[1] : p.col[0];
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + f * 0.6), 0, 6.28); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (P.length) requestAnimationFrame(step);
        else { ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H); App._fw.running = false; }
      };
      requestAnimationFrame(step);
    },

    // ---------- sounds (WebAudio, no files) — tuned to raag Bhupali (Sa Re Ga Pa Dha) ----------
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

    // ---------- emoji reactions (Supabase Realtime broadcast, or /api/react locally) ----------
    reactHandlers: [],
    onReact(fn) { this.reactHandlers.push(fn); },
    _emitReact(r) { this.reactHandlers.forEach((fn) => fn(r)); },
    react(emoji, from) {
      const r = { emoji, name: from && from.name, avatar: from && from.avatar, id: Math.random().toString(36).slice(2) };
      if (this._channel) this._channel.send({ type: 'broadcast', event: 'react', payload: r });
      else fetch('/api/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) }).catch(() => {});
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

    fmt(n) { return Number(n || 0).toLocaleString('en-IN'); },
    letters: ['A', 'B', 'C', 'D', 'E', 'F'],
  };
  document.addEventListener('pointerdown', () => { App.pointerDown = true; }, true);
  document.addEventListener('pointerup', () => { setTimeout(() => { App.pointerDown = false; }, 50); }, true);
  document.addEventListener('pointercancel', () => { App.pointerDown = false; }, true);
  window.App = App;
  requestAnimationFrame(App.tickTimers);
})();
