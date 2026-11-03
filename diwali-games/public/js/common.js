/* Shared client helpers: socket, server clock, rendering, confetti, sounds. */
(function () {
  const App = {
    offset: 0,
    now() { return Date.now() + this.offset; },

    connect(role, token, onState, onAuthError) {
      const sock = io({ auth: { role, token }, transports: ['websocket', 'polling'] });
      sock.on('state', (s) => {
        this.offset = s.serverNow - Date.now();
        onState(s);
      });
      sock.on('auth_error', (m) => onAuthError && onAuthError(m));
      sock.on('kicked', () => onAuthError && onAuthError('You were removed by the host.'));
      sock.on('disconnect', () => document.body.classList.add('offline'));
      sock.on('connect', () => document.body.classList.remove('offline'));
      return sock;
    },

    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    // Replace innerHTML only when it changed, and never while the user is typing inside.
    patch(el, html) {
      if (!el) return;
      if (el._html === html) return;
      const a = document.activeElement;
      if (a && el.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && el._html !== undefined) {
        el._dirty = html;
        if (!a._patchHook) {
          a._patchHook = true;
          a.addEventListener('blur', () => { setTimeout(() => { if (el._dirty) { const h = el._dirty; el._dirty = null; App.patch(el, h); } }, 150); }, { once: true });
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

    sparkles(n = 40) {
      const box = document.createElement('div');
      box.className = 'sparkles';
      for (let i = 0; i < n; i++) {
        const s = document.createElement('i');
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
        s.style.animationDuration = (2 + Math.random() * 3).toFixed(2) + 's';
        if (Math.random() < 0.3) s.style.background = '#ff4f9a';
        box.appendChild(s);
      }
      document.body.prepend(box);
    },

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

    // ---------- confetti ----------
    confetti(power = 1) {
      let c = document.getElementById('confetti');
      if (!c) { c = document.createElement('canvas'); c.id = 'confetti'; document.body.appendChild(c); }
      const ctx = c.getContext('2d');
      c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      const colors = ['#ff7a00', '#ffb300', '#ffd54a', '#e6007e', '#ff4f9a', '#00b3a4', '#7c3aed', '#ffffff'];
      const parts = [];
      const bursts = Math.round(3 * power);
      for (let b = 0; b < bursts; b++) {
        const x = innerWidth * (0.2 + Math.random() * 0.6), y = innerHeight * (0.25 + Math.random() * 0.3);
        for (let i = 0; i < 70; i++) {
          const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 8;
          parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: 90 + Math.random() * 60, c: colors[(Math.random() * colors.length) | 0], s: 3 + Math.random() * 5, r: Math.random() * 6, delay: b * 12 });
        }
      }
      const step = () => {
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        let alive = 0;
        for (const p of parts) {
          if (p.delay > 0) { p.delay--; alive++; continue; }
          if (p.life <= 0) continue;
          alive++;
          p.life--; p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.985; p.r += 0.2;
          ctx.globalAlpha = Math.min(1, p.life / 40);
          ctx.fillStyle = p.c;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
          ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
          ctx.restore();
        }
        if (alive) requestAnimationFrame(step); else ctx.clearRect(0, 0, innerWidth, innerHeight);
      };
      step();
    },

    // ---------- sounds (WebAudio, no files) ----------
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
      const tone = (freq, start, dur, type = 'sine', vol = 0.2) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(0, t0 + start);
        g.gain.linearRampToValueAtTime(vol, t0 + start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
        o.connect(g); g.connect(ac.destination);
        o.start(t0 + start); o.stop(t0 + start + dur + 0.05);
      };
      const seqs = {
        tick: () => tone(880, 0, 0.08, 'square', 0.06),
        buzz: () => { tone(220, 0, 0.35, 'sawtooth', 0.15); tone(330, 0, 0.35, 'square', 0.08); },
        reveal: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.18)),
        fanfare: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.35, 'triangle', 0.2)),
        whoosh: () => tone(300, 0, 0.4, 'sawtooth', 0.05),
        power: () => [392, 523, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.25, 'square', 0.1)),
        wrong: () => { tone(200, 0, 0.3, 'sawtooth', 0.12); tone(150, 0.25, 0.4, 'sawtooth', 0.12); },
        join: () => [660, 990].forEach((f, i) => tone(f, i * 0.08, 0.2, 'sine', 0.15)),
      };
      (seqs[name] || seqs.tick)();
    },

    fmt(n) { return Number(n || 0).toLocaleString('en-IN'); },
    letters: ['A', 'B', 'C', 'D', 'E', 'F'],
  };
  window.App = App;
  requestAnimationFrame(App.tickTimers);
})();
