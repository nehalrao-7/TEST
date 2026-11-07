/* Player phone — a clean controller. The TV is the source of truth. */
(function () {
  const { esc, fmt, letters } = App;
  const app = document.getElementById('app');
  const dock = document.getElementById('dock');
  const modal = document.getElementById('modal');
  App.sparkles(25);

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  let S = null;
  let sock = null;
  let seenLedger = null;
  let lastScore = null;
  const revealed = new Set(JSON.parse(store.get('dgn_revealed') || '[]'));

  // =================== LOGIN ===================
  const L = { step: 'room', room: '', name: '', avatar: '🪔', cc: '1', phone: '', otp: '', via: 'host', avatars: ['🪔', '🎆', '🐘', '🦚', '🐯', '🌺', '🪷', '🍬', '🎇', '🥭', '🌶️', '🦁', '🐒', '👑', '🪁', '🍵', '🌙', '⭐'], eventName: '2026 Diwali Party', note: '' };
  const COUNTRY_CODES = [['1', '+1'], ['91', '+91'], ['44', '+44'], ['971', '+971'], ['61', '+61'], ['65', '+65']];

  function remember(room, token) {
    App.room = room;
    store.set('dgn_room', room);
    store.set('dgn_token', token);
    store.set('dgn_token_room', room);
    const url = '/play?room=' + room;
    if (location.pathname + location.search !== url) history.replaceState(null, '', url);
  }

  async function startLogin() {
    dock.innerHTML = '';
    const fromUrl = App.roomFromQuery();
    const saved = App.canonRoom(store.get('dgn_room'));
    const token = store.get('dgn_token');
    const tokenRoom = App.canonRoom(store.get('dgn_token_room'));
    const room = fromUrl || saved;
    if (room && token && tokenRoom === room) {
      remember(room, token);
      start(token);
      return;
    }
    L.room = room;
    L.step = room ? 'name' : 'room';
    if (room) {
      App.room = room;
      try {
        const m = await (await fetch('/api/meta')).json();
        if (m.avatars) L.avatars = m.avatars;
        if (m.eventName) L.eventName = m.eventName;
      } catch { /* the form still works */ }
    }
    renderLogin();
  }

  function renderLogin() {
    dock.innerHTML = '';
    if (L.step === 'room') {
      app.innerHTML = `<div class="login">
        <div class="shell-card">
          <div class="breakout">${App.mascot()}</div>
          <h1>Join a room</h1>
          <p class="muted">Ask the host for the 4-character code.</p>
        </div>
        <form class="card stack" id="fRoom">
          <div><input type="text" id="room" class="code-input" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="ABCD" aria-label="Room code" value="${esc(L.room)}" /></div>
          ${L.note ? `<p class="muted" style="margin:0">${esc(L.note)}</p>` : ''}
          <button class="btn diya-btn big block" type="submit">${App.diya(true, 28)} Continue</button>
        </form>
        <p class="fine">Hosting? <a href="/host">Start a room</a></p>
      </div>`;
      const input = app.querySelector('#room');
      input.focus();
      app.querySelector('#fRoom').onsubmit = async (e) => {
        e.preventDefault();
        const code = App.canonRoom(input.value);
        if (!code) { App.toast('Enter the 4-character room code.', true); return; }
        L.room = code; L.note = ''; App.room = code; L.step = 'name'; renderLogin();
      };
      return;
    }
    if (L.step === 'name') {
      app.innerHTML = `<div class="login">
        <div class="shell-card">
          <div class="breakout">${App.mascot()}</div>
          <h1>Who’s playing?</h1>
        </div>
        <form class="card stack" id="f1">
          <div class="room-known"><span class="field">Room</span><b class="room-chip">${esc(L.room)}</b><button type="button" class="btn ghost small" id="changeRoom">Change</button></div>
          <div><input type="text" id="name" maxlength="20" aria-label="Your name" placeholder="Your name" value="${esc(L.name)}" autocomplete="given-name" /></div>
          <div><label class="field">Pick your avatar</label><div class="avatars">${L.avatars.map((a) => `<button type="button" data-av="${a}" class="${a === L.avatar ? 'on' : ''}" aria-label="Avatar ${a}">${a}</button>`).join('')}</div></div>
          <button class="btn diya-btn big block" type="submit">${App.diya(true, 28)} Continue</button>
        </form>
      </div>`;
      app.querySelector('#changeRoom').onclick = () => { L.step = 'room'; L.note = ''; renderLogin(); };
      app.querySelectorAll('[data-av]').forEach((b) => b.onclick = () => { L.avatar = b.dataset.av; app.querySelectorAll('[data-av]').forEach((x) => x.classList.toggle('on', x === b)); });
      app.querySelector('#f1').onsubmit = (e) => {
        e.preventDefault();
        L.name = app.querySelector('#name').value.trim();
        if (!L.name) { App.toast('Please tell us your name.', true); return; }
        L.step = 'phone';
        renderLogin();
      };
      return;
    }
    if (L.step === 'phone') {
      app.innerHTML = `<div class="login">
        <div class="shell-card slim">
          <h1>Hi ${esc(L.name.trim())}</h1>
          <p class="muted">We’ll text a code so this phone keeps your score.</p>
        </div>
        <form class="card stack" id="fPhone">
          <div class="phone-row">
            <select id="cc" aria-label="Country code">${COUNTRY_CODES.map(([v, label]) => `<option value="${v}" ${v === L.cc ? 'selected' : ''}>${label}</option>`).join('')}</select>
            <input type="tel" id="phone" inputmode="tel" autocomplete="tel" placeholder="Phone number" value="${esc(L.phone)}" aria-label="Phone number" />
          </div>
          <button class="btn diya-btn big block" type="submit">${App.diya(true, 28)} Text me a code</button>
        </form>
        <button class="btn ghost small" type="button" id="backName">Back</button>
      </div>`;
      app.querySelector('#backName').onclick = () => { L.step = 'name'; renderLogin(); };
      app.querySelector('#fPhone').onsubmit = async (e) => {
        e.preventDefault();
        L.cc = app.querySelector('#cc').value;
        L.phone = app.querySelector('#phone').value.trim();
        const btn = e.submitter || app.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
          App.room = L.room;
          const r = await App.post('/api/otp/request', { room: L.room, name: L.name, avatar: L.avatar, cc: L.cc, phone: L.phone });
          L.via = r.via || 'host';
          L.step = 'code';
          renderLogin();
        } catch (err) { App.toast(err.message, true); btn.disabled = false; }
      };
      return;
    }
    app.innerHTML = `<div class="login">
      <div class="shell-card slim">
        <h1>Enter your code</h1>
        <p class="muted">${L.via === 'sms' ? 'Check the text on this phone.' : 'Ask the host to read the code from their console.'}</p>
      </div>
      <form class="card stack" id="fCode">
        <input type="text" id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Code" aria-label="Verification code" value="${esc(L.otp)}" />
        <button class="btn diya-btn big block" type="submit">${App.diya(true, 28)} Join the night</button>
      </form>
      <button class="btn ghost small" type="button" id="resend">Send a new code</button>
    </div>`;
    app.querySelector('#resend').onclick = () => { L.step = 'phone'; renderLogin(); };
    app.querySelector('#fCode').onsubmit = async (e) => {
      e.preventDefault();
      L.otp = app.querySelector('#otp').value.trim();
      const btn = e.submitter || app.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        App.room = L.room;
        const r = await App.post('/api/otp/verify', { room: L.room, cc: L.cc, phone: L.phone, code: L.otp });
        remember(L.room, r.token);
        App.confetti(1);
        start(r.token);
      } catch (err) { App.toast(err.message, true); btn.disabled = false; }
    };
  }

  // =================== MAIN ===================
  // =================== CONTROLLER ===================
  // The TV is the source of truth. The phone shows one "moment" at a time: only what you
  // need to act on right now. Moments cross-fade when they change.
  function start(token) {
    app.innerHTML = `<header class="ctl-head" id="hdr"></header><main class="moment-wrap"><div id="moment"><p class="greet">Lighting the diyas…</p></div></main>`;
    sock = App.connect('player', token, (s) => onState(s), (msg) => {
      store.del('dgn_token');
      store.del('dgn_token_room');
      if (sock) sock.disconnect();
      App.toast(msg, true);
      L.step = App.room ? 'name' : 'room';
      startLogin();
    });
  }

  // ---------- reactions ----------
  const REACTS = ['🔥', '😂', '👏', '😱', '💃', '🪔'];
  let lastReact = 0;
  function sendReaction(emoji, btn) {
    if (!S || Date.now() - lastReact < 600) return;
    lastReact = Date.now();
    App.react(emoji, { name: S.me.name, avatar: S.me.avatar });
    App.vibrate(15);
    if (btn) { btn.classList.remove('sent'); void btn.offsetWidth; btn.classList.add('sent'); }
    const f = document.createElement('div');
    f.className = 'react-local';
    f.textContent = emoji;
    f.style.left = (btn ? btn.getBoundingClientRect().left + 6 : innerWidth / 2 - 18) + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1200);
  }

  function onState(s) {
    S = s;
    // Celebrate points that arrive outside a result screen (power-ups, steals, bonuses).
    const hist = S.me.history;
    if (seenLedger === null) seenLedger = new Set(hist.map((h) => h.id));
    else {
      const fresh = hist.filter((h) => !seenLedger.has(h.id)).reverse();
      fresh.forEach((h) => seenLedger.add(h.id));
      const total = fresh.reduce((a, h) => a + h.amount, 0);
      // Result screens already celebrate their own points — no extra toast on top.
      const onResult = S.live && ((S.live.type === 'quiz' && S.live.phase === 'reveal') || (S.live.type === 'hookstep' && S.live.phase === 'scored')
        || (S.live.type === 'kbc' && S.live.hot && S.live.hot.qPhase !== 'question') || (S.live.type === 'jeopardy' && S.live.phase === 'answer'));
      if (fresh.length && !onResult) {
        const robbed = fresh.find((h) => h.amount < 0);
        if (robbed) App.toast(`${robbed.reason}: ${robbed.amount}`, true);
        else if (total > 0) { App.toast(`+${total} · ${fresh[fresh.length - 1].reason}`); App.fireworks(0.4); App.vibrate(60); }
      }
    }
    if (S.live && modal.querySelector('.about-sheet')) modal.innerHTML = '';
    if (!S.live && S.questionnaire.open && !answeredCount() && !store.get('dgn_q_prompted_' + S.me.id) && !modal.innerHTML) {
      store.set('dgn_q_prompted_' + S.me.id, '1');
      setTimeout(() => { if (S && !S.live && !modal.innerHTML) openQuestionnaire(); }, 1200);
    } else if (!S.live && S.powerupsEnabled && !store.get('dgn_pu_shown_' + S.me.id) && !modal.innerHTML && S.me.powerups.length) {
      // Everyone should know they hold secret power-ups: unwrap them once, right after joining.
      store.set('dgn_pu_shown_' + S.me.id, '1');
      setTimeout(() => { if (S && !S.live && !modal.innerHTML) openPowerups(); }, 900);
    }
    render();
  }

  const teamOf = (tid) => S.teams.find((t) => t.id === tid);
  const av = (p) => `<span class="avatar" style="--c:${p.color}">${esc(p.avatar)}</span>`;
  const shape = (i) => `<span class="shape-ic">${App.shapes[i]}</span>`;
  const timer = (s, e) => `<div class="timer" data-start="${s}" data-end="${e}"><i></i></div>`;
  const watch = (em, title, sub, extra = '') => `<div class="watch"><div class="watch-em">${em}</div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}${extra}</div>`;

  let shownScore = null;
  let momentKey = null;
  function render() {
    if (!S) return;
    App.applyTheme(S);
    const me = S.me;
    const t = me.teamId && teamOf(me.teamId);
    document.body.style.setProperty('--team', t ? t.color : 'var(--marigold)');
    const [key, html, mode] = moment();
    const lead = S.players[0];
    const pct = lead && lead.score > 0 ? Math.max(4, Math.round((100 * me.score) / lead.score)) : 0;
    const score = `<div class="ring ring-sm" style="--p:${me.score ? pct : 0}" role="img" aria-label="${fmt(me.score)} points"><div><b id="scoreNum">${fmt(shownScore == null ? me.score : shownScore)}</b><small>pts</small></div></div>`;
    const here = S.players.filter((p) => p.online).length;
    // The end-of-night card is self-contained (score, name, rank), so the header steps aside for it.
    document.getElementById('hdr').style.display = key === 'night' ? 'none' : '';
    App.patch(document.getElementById('hdr'), `<div class="head-row">${score}<div class="who"><div class="who-line"><b>${esc(me.name)}</b><span class="room-chip">${esc(S.code || '')}</span></div>${t ? `<span class="team-pill">${esc(t.emoji)} ${esc(t.name)}</span>` : `<span class="muted">${here} here</span>`}</div></div>`);
    if (shownScore !== me.score) {
      const el = document.getElementById('scoreNum');
      if (shownScore != null && el) { App.countUp(el, me.score, 800, shownScore); const ring = el.closest('.ring'); if (ring) { ring.classList.remove('bump'); void ring.offsetWidth; ring.classList.add('bump'); } }
      shownScore = me.score;
    }
    const box = document.getElementById('moment');
    if (key !== momentKey) {
      momentKey = key;
      box.classList.remove('m-enter'); void box.offsetWidth;
      box.innerHTML = html; box._html = html; box.classList.add('m-enter');
      onMoment(key);
    } else App.patch(box, html);
    renderDock(mode);
    box.querySelectorAll('[data-countup]:not([data-done])').forEach((el) => { el.dataset.done = '1'; App.countUp(el, Number(el.dataset.countup), 900); });
  }

  function onMoment(key) {
    if (key === 'night') { App.fireworks(1); App.vibrate([40, 40, 90]); }
    else if (/^r-good|^hk-earned|called-yes|jp-won/.test(key)) { App.fireworks(0.6); App.vibrate([40, 40, 90]); }
    else if (/^r-bad|called-no/.test(key)) App.vibrate(140);
    else if (/^q-open|jp-open|ff-open/.test(key)) App.vibrate(30);
  }

  // Dock: reactions while you're watching, the 🎁 drawer between games, nothing while answering.
  function renderDock(mode) {
    const unused = S.me.powerups.filter((p) => !p.used).length;
    let html = '';
    if (mode === 'watch' || mode === 'break') {
      html = `<div class="react-bar">${REACTS.map((e) => `<button data-react="${e}" aria-label="Send ${e} to the TV">${e}</button>`).join('')}</div>`;
      if (mode === 'break') html = `<button class="pu-pill" data-act="powerups">🎁 <span>Power-ups</span>${unused ? `<i>${S.me.powerups.filter((p) => !p.used).map((p) => p.emoji).join(' ')}</i>` : ''}</button>` + html;
    }
    App.patch(dock, html);
  }

  // ---------- moments ----------
  const LOCK_LINES = ['Diya lit! Waiting for the rest…', 'Bas, ab dekhte hain 👀', 'Confidence: Shah Rukh arms wide 🙌', 'Locked. No take-backs!', 'Ab bhagwan bharose 🙏', 'Fingers crossed, toes too…'];
  const RIGHT = [['Sahi jawab!', '🎉'], ['Ekdum first class!', '🪔'], ['Shabash!', '🎆'], ['Kya baat hai!', '✨'], ['Waah!', '🥳'], ['Too good!', '💯']];
  const WRONG = ['Arre yaar!', 'Oops, galat!', 'So close…', 'Koi baat nahi!', 'Next one is yours!'];

  function moment() {
    const G = S.live;
    if (['awards', 'podium'].includes(S.tv.view)) return ['night', myNightCard(), 'watch'];
    if (!G) return idleMoment();
    const fn = { quiz: quizM, jeopardy: jeoM, kbc: kbcM, hookstep: hookM, custom: () => ['custom', watch(esc(G.emoji), esc(G.title), 'Eyes on the TV — the host is keeping score.'), 'watch'] }[G.type];
    return fn(G);
  }

  function idleMoment() {
    // Just finished a game: a quick "how you did" card. Standings live on the TV.
    if (S.tv.view === 'leaderboard' && S.tv.compareGameId) {
      const g = S.games.find((x) => x.id === S.tv.compareGameId);
      const earned = S.me.history.filter((h) => h.gameId === S.tv.compareGameId).reduce((a, h) => a + h.amount, 0);
      return ['post-' + S.tv.compareGameId, `<div class="round-card"><div class="rc-em">${g ? esc(g.emoji) : '🏁'}</div><span class="eyebrow">${g ? esc(g.title) : 'Round'} complete</span>
        <div class="rc-pts">${earned >= 0 ? '+' : ''}<span data-countup="${earned}">0</span></div><p>points this round</p><div class="rc-tv">👀 The standings are on the TV</div></div>`, 'break'];
    }
    const next = S.games.find((g) => g.status === 'pending');
    return ['idle', `<div class="shell-card lobby-hero"><div class="breakout">${App.mascot()}</div>
      <p class="eyebrow">${next ? 'Up next' : 'Waiting for the host'}</p>
      <h2>${next ? `${esc(next.emoji)} ${esc(next.title)}` : 'The night is warming up'}</h2>
      <button class="btn diya-btn big block" data-act="tap-diya">${App.diya(true, 28)} Send a spark</button>
    </div>`, 'break'];
  }

  // Quiz: the question is on the TV; the phone is four big shapes.
  function quizM(G) {
    if (G.phase === 'intro') return ['q-intro', watch('👀', 'Eyes on the TV', `${G.total} questions · match the shape on screen.<br/>The last one is a <b>✨ Double Diya</b>.`), 'watch'];
    if (G.phase === 'final') return ['q-final', watch('🎆', 'Round complete!', 'The standings are on the TV.'), 'watch'];
    const m = G.mine;
    const dd = G.doubleDiya ? '<span class="dd-badge">✨ Double Diya · ×2</span>' : '';
    if (G.phase === 'question') {
      if (App.now() < G.opensAt) { setTimeout(render, G.opensAt - App.now() + 30); return [`q-wait-${G.qIndex}`, `<div class="get-ready"><span class="eyebrow">Question ${G.qIndex + 1} of ${G.total}</span>${dd}<div class="gr-num" data-count="${G.opensAt}"></div><p>Eyes on the TV</p></div>`, 'answer']; }
      if (m.answered) return [`q-locked-${G.qIndex}`, `<div class="locked"><div class="lock-tile o${m.choice}">${shape(m.choice)}</div>
        <h2>Locked in${m.order ? ` · #${m.order}` : ''}${m.order === 1 ? ' ⚡' : ''}</h2><p class="hand">${LOCK_LINES[(G.qIndex + (m.order || 0)) % LOCK_LINES.length]}</p>
        ${m.streak >= 2 ? `<span class="streak">🔥 ${m.streak} in a row</span>` : ''}</div>`, 'watch'];
      const hint = S.me.powerups.find((p) => p.type === 'hint' && !p.used);
      return [`q-open-${G.qIndex}`, `<div class="pad-head"><span class="eyebrow">Q${G.qIndex + 1} / ${G.total}</span>${dd}<span class="secs" data-count="${G.deadline}"></span></div>${timer(G.opensAt, G.deadline)}
        <div class="shape-pad">${G.question.options.map((_, i) => `<button class="pad o${i} ${m.hint && m.hint.includes(i) ? 'gone' : ''}" data-act="answer" data-i="${i}" aria-label="${App.shapeNames[i]}">${shape(i)}</button>`).join('')}</div>
        ${hint && !m.hint && S.powerupsEnabled ? `<button class="hint-pill" data-act="use-pu" data-id="${hint.id}">✨ Phuljhari Hint — remove 2 wrong</button>` : ''}`, 'answer'];
    }
    const r = G.result;
    const q = G.question;
    const ans = `<div class="ans-chip o${r.answer}">${shape(r.answer)}<span>${esc(q.options[r.answer])}</span></div>`;
    if (m.choice == null) return [`r-none-${G.qIndex}`, `<div class="result meh"><div class="r-em">😴</div><h2>No answer!</h2><p>The answer was</p>${ans}</div>`, 'watch'];
    const right = m.choice === r.answer;
    const teamShare = G.mode === 'team' ? (r.perTeam[S.me.teamId] || 0) : 0;
    const earned = r.paid && Object.prototype.hasOwnProperty.call(r.paid, S.me.id)
      ? r.paid[S.me.id]
      : (G.mode === 'team' ? teamShare : (m.points || 0)) + (m.bonus || 0);
    const doubled = r.doubled && r.doubled[S.me.id];
    const [line, emo] = RIGHT[G.qIndex % RIGHT.length];
    const pts = earned > 0 ? `<div class="r-pts">+<span data-countup="${earned}">0</span></div>${r.double ? '<span class="streak">✨ Double Diya ×2</span>' : ''}${doubled ? '<span class="streak">💥 Double Dhamaka</span>' : ''}${G.mode === 'team' ? `<p class="small">${right ? 'Your share of the team' : 'Missed it — your team still scored'}</p>` : ''}` : '';
    return [`r-${right ? 'good' : 'bad'}-${G.qIndex}`, `<div class="result ${right ? 'good' : 'bad'}"><div class="r-em">${right ? emo : '😅'}</div><h2>${right ? line : WRONG[G.qIndex % WRONG.length]}</h2>
      ${right ? pts : `<p>The answer was</p>${ans}${pts}`}
      ${m.streak >= 2 ? `<span class="streak">🔥 ${m.streak} in a row</span>` : ''}</div>`, 'watch'];
  }

  // Jeopardy: teams go one by one. Phones stay quiet; the team that is up answers out loud.
  function jeoM(G) {
    const m = G.mine || {};
    const who = G.turn;
    if (G.phase === 'answer') {
      const won = m.earned > 0;
      return [won ? 'jp-won' : 'jp-ans', won ? `<div class="result good"><div class="r-em">🎉</div><h2>Correct!</h2><div class="r-pts">+<span data-countup="${m.earned}">0</span></div><p>for everyone on your team</p></div>`
        : watch('✨', 'Answer on the TV', G.last && G.last.correct ? `${esc(G.last.info.name)} got it. Everyone on that team scores.` : 'No points that time.'), 'watch'];
    }
    if (G.phase === 'clue' && m.up) return ['jp-up', watch('🧠', 'Your team is up', `<b>Answer out loud.</b> A right answer pays <b>${fmt(G.clue.value)} to each of you</b>.`), 'watch'];
    if (G.phase === 'board' && m.up) return ['jp-board-up', watch('🧠', 'Your team is up', '<b>Call a category and value.</b> Then answer out loud.'), 'watch'];
    return ['jp-wait', watch('🧠', 'Eyes on the board', who ? `${esc(who.name)} is up.` : 'Waiting for the next team.'), 'watch'];
  }

  // KBC: solo. Everyone answers. Fastest correct gets full points; each later place gets less.
  function kbcM(G) {
    if (G.phase === 'idle') return ['k-idle', watch('💰', 'Kaun Banega Crorepati', 'Every question is open to everyone. Be fast!'), 'watch'];
    if (G.phase === 'done') return ['k-done', watch('💰', 'Round complete', 'Eyes on the TV for the scores.'), 'watch'];
    const m = G.mine || {};
    if (G.phase === 'question') {
      if (App.now() < G.opensAt) { setTimeout(render, G.opensAt - App.now() + 30); return ['k-wait', `<div class="get-ready"><span class="eyebrow">For ${fmt(G.points)}</span><div class="gr-num" data-count="${G.opensAt}"></div><p>Eyes on the TV</p></div>`, 'answer']; }
      if (m.choice != null) return ['k-locked', `<div class="locked"><div class="lock-tile kbc">${App.letters[m.choice]}</div><h2>Locked in!</h2><p class="hand">Fastest correct answer takes ${fmt(G.points)}</p></div>`, 'watch'];
      return [`k-open-${G.qIndex}`, `<div class="pad-head"><span class="eyebrow">Q${G.qIndex + 1} · ${fmt(G.points)} for first</span><span class="secs" data-count="${G.deadline}"></span></div>${timer(G.opensAt, G.deadline)}
        <div class="shape-pad kbc">${G.question.options.map((_, i) => `<button class="pad kbc" data-act="answer" data-i="${i}"><span class="kl">${App.letters[i]}</span></button>`).join('')}</div>`, 'answer'];
    }
    if (m.points > 0) return [`k-place-${G.qIndex}`, `<div class="result good"><div class="r-em">${m.rank === 1 ? '👑' : '✅'}</div><h2>${m.rank === 1 ? 'Fastest!' : 'Place #' + m.rank}</h2><div class="r-pts">+<span data-countup="${m.points}">0</span></div></div>`, 'watch'];
    return [`k-miss-${G.qIndex}`, watch('😅', 'Not this time', `The answer was <b>${App.letters[G.result.answer]}</b>.`), 'watch'];
  }

  // Hook Step: no phones needed — just watch the TV and come dance.
  function hookM(G) {
    const m = G.mine || {};
    const perf = G.perf;
    if (G.phase === 'scored' && m.earned) return ['hk-earned', `<div class="result good"><div class="r-em">💃</div><h2>Himmat bonus!</h2><div class="r-pts">+<span data-countup="${m.earned}">0</span></div><p>for getting up and dancing</p></div>`, 'watch'];
    if (m.dancing) return ['hk-dancing', watch('🕺', "You're dancing!", `Give it everything — +${G.bonus} Himmat bonus is yours 🙌`), 'watch'];
    if (perf && m.myTeamUp && ['ready', 'spin', 'perform'].includes(G.phase)) return ['hk-up', watch('💃', 'Your team is up!', `Get up and dance! <b>Every dancer earns +${G.bonus}</b> on top of the team points.`), 'watch'];
    return ['hk-watch', watch('📺', 'Hook Step time', `No phones needed — eyes on the TV and cheer loud. When your team is called, come dance for <b>+${G.bonus}</b>!`), 'watch'];
  }

  // ---------- "About me" questionnaire ----------
  const answeredCount = () => Object.values(S.questionnaire.answers || {}).filter(Boolean).length;
  const SECTIONS = [['you', 'About you'], ['group', 'The group'], ['vote', 'Secret votes']];
  function openQuestionnaire() {
    const Q = S.questionnaire;
    const draft = { ...(Q.answers || {}) };
    const others = S.players.filter((p) => p.id !== S.me.id).sort((a, b) => a.name.localeCompare(b.name));
    let n = 0;
    const field = (q) => {
      n++;
      const v = draft[q.id] || '';
      const label = `<label class="field">${n}. ${esc(q.text)}</label>`;
      if (q.type === 'pick' || q.type === 'vote') {
        return `<div>${label}<select data-qid="${q.id}"><option value="">${q.type === 'vote' ? '— pick a guest (or skip) —' : '— pick a guest (or skip) —'}</option>
          ${others.map((p) => `<option value="${p.id}" ${v === p.id ? 'selected' : ''}>${esc(p.avatar)} ${esc(p.name)}</option>`).join('')}</select></div>`;
      }
      if (q.type === 'choice') {
        return `<div>${label}<div class="choice-row">${(q.options || []).map((o) => `<label class="choice ${v === o ? 'on' : ''}"><input type="radio" name="c-${q.id}" data-qid="${q.id}" value="${esc(o)}" ${v === o ? 'checked' : ''}/>${esc(o)}</label>`).join('')}</div></div>`;
      }
      return `<div>${label}<input type="text" maxlength="70" data-qid="${q.id}" value="${esc(v)}" placeholder="${esc(q.ph || '')}"/></div>`;
    };
    const known = SECTIONS.map(([k]) => k);
    const groups = SECTIONS.map(([k, title]) => [title, Q.prompts.filter((q) => (q.section || 'you') === k)])
      .concat([['✨ More', Q.prompts.filter((q) => !known.includes(q.section || 'you'))]])
      .filter(([, list]) => list.length);
    modal.innerHTML = `<div class="modal"><div class="sheet about-sheet"><h3>Quick questions</h3>
      <p class="muted small sheet-lead">Skip any. Votes stay secret.</p>
      <form id="qf"><div class="q-scroll">${groups.map(([title, list]) => `<div class="q-sec"><h4>${title}</h4>${list.map(field).join('')}</div>`).join('')}</div>
        <div class="row q-actions"><button type="button" class="btn ghost grow" data-m="no">Later</button><button class="btn grow" type="submit">Save</button></div></form></div></div>`;
    const f = modal.querySelector('#qf');
    f.querySelectorAll('.choice input').forEach((r) => r.addEventListener('change', () => {
      f.querySelectorAll(`[name="${r.name}"]`).forEach((x) => x.parentElement.classList.toggle('on', x.checked));
    }));
    modal.querySelector('[data-m=no]').onclick = () => { modal.innerHTML = ''; };
    f.onsubmit = (e) => {
      e.preventDefault();
      const answers = {};
      f.querySelectorAll('[data-qid]').forEach((inp) => {
        if (inp.type === 'radio') { if (inp.checked) answers[inp.dataset.qid] = inp.value; else if (!(inp.dataset.qid in answers)) answers[inp.dataset.qid] = ''; }
        else answers[inp.dataset.qid] = inp.value;
      });
      send({ type: 'answers', answers }, () => { modal.innerHTML = ''; App.confetti(0.6); App.toast('Saved! Watch out for questions about you 👀'); });
    };
  }

  // ---------- "My Diwali Night" keepsake card ----------
  function myNightCard() {
    const me = S.me, st = me.stats || {};
    const acc = st.answered ? Math.round((100 * st.correct) / st.answered) : null;
    const used = me.powerups.filter((p) => p.used).length;
    const year = new Date().getFullYear();
    const top = S.players[0];
    const pct = top && top.score > 0 ? Math.max(4, Math.round((100 * me.score) / top.score)) : 0;
    const board = S.players.slice(0, 5).map((p) => `<div class="lb-mini ${p.id === me.id ? 'me' : ''}"><b class="rk">#${p.rank}</b>${av(p)}<span>${esc(p.name)}</span><em>${fmt(p.score)}</em></div>`).join('');
    return `<div class="night-card">
      <div class="nc-top"><span class="hand">${esc(S.eventName)}${String(S.eventName).includes(String(year)) ? '' : ' · ' + year}</span></div>
      <div class="ring" style="--p:${pct}"><div><b>${fmt(me.score)}</b><small>pts</small></div></div>
      <h2>${esc(me.name)}</h2>
      <div class="nc-rank">Rank <b>#${me.rank}</b> of ${S.players.length}</div>
      <div class="lb-mini-list">${board}</div>
      <div class="nc-stats">
        <div><b>${st.correct || 0}</b><span>right answers</span></div>
        <div><b>${acc != null ? acc + '%' : '—'}</b><span>accuracy</span></div>
        <div><b>${st.bestStreak || 0}🔥</b><span>best streak</span></div>
        <div><b>${st.fastest || 0}⚡</b><span>fastest finger</span></div>
        <div><b>${used}🎁</b><span>power-ups used</span></div>
        <div><b>${st.steals || 0}🦹</b><span>heists</span></div>
      </div>
      ${me.awards && me.awards.length ? `<div class="nc-awards">${me.awards.map((a) => `<span>${esc(a.emoji)} ${esc(a.title)}</span>`).join('')}</div>` : ''}
      <div class="nc-foot">Shubh Deepavali ✨ <span class="small">screenshot & share!</span></div>
    </div>`;
  }

  function usePowerup(pu) {
    if (pu.type === 'steal' || pu.type === 'shagun') {
      const others = S.players.filter((p) => p.id !== S.me.id);
      const head = pu.type === 'steal'
        ? `<h3>🦹 Who do you want to rob?</h3><p class="muted small">Steals up to the host's limit. Watch out for shields!</p>`
        : `<h3>💌 Who gets your shagun?</h3><p class="muted small">They get +101 and you get +51.</p>`;
      modal.innerHTML = `<div class="modal"><div class="sheet">${head}
        ${others.map((p) => `<button class="pick-row" data-target="${p.id}">${av(p)} ${esc(p.name)}<span class="sc">${fmt(p.score)}</span></button>`).join('')}
        <button class="btn ghost block" data-m="no">Cancel</button></div></div>`;
      modal.querySelector('[data-m=no]').onclick = () => { modal.innerHTML = ''; };
      modal.querySelectorAll('[data-target]').forEach((b) => b.onclick = () => {
        modal.innerHTML = '';
        send({ type: 'powerup', powerupId: pu.id, targetId: b.dataset.target }, () => { App.sfx('power'); App.confetti(0.6); });
      });
      return;
    }
    confirmSheet(`<div class="center"><div style="font-size:56px">${pu.emoji}</div><h3>Use ${esc(pu.name)}?</h3><p class="muted">${esc(pu.desc)}</p></div>`, 'Use it! ⚡', () => {
      send({ type: 'powerup', powerupId: pu.id }, () => { App.confetti(0.6); App.toast(`${pu.emoji} ${pu.name} activated!`); });
    });
  }

  // ---------- 🎁 power-ups drawer (between games only) ----------
  function powerSheet() {
    const pus = S.me.powerups;
    return `<div class="modal"><div class="sheet pu-sheet"><div class="sheet-grab"></div><h3>🎁 Your secret power-ups</h3>
      <p class="muted small">Only you can see these. Tap a gift to unwrap it.${S.powerupsEnabled ? '' : ' <b>Paused by the host right now.</b>'}</p>
      <div class="pu-grid">${pus.map((p) => {
        const flipped = revealed.has(p.id) || p.used;
        const action = p.used ? '' : p.passive ? '<span class="chip done">🛡️ Always on — protecting you</span>' : `<button class="btn small" data-act="use-pu" data-id="${p.id}" ${S.powerupsEnabled ? '' : 'disabled'}>Use it</button>`;
        return `<div class="pu ${flipped ? 'flipped' : ''} ${p.used ? 'used' : ''}" data-act="flip" data-id="${p.id}"><div class="pu-inner">
          <div class="pu-face pu-back"><div class="em">🎁</div><b>Tap to unwrap</b></div>
          <div class="pu-face pu-front"><div class="em">${p.emoji}</div><div><h4>${esc(p.name)}</h4><p>${esc(p.desc)}</p>${action}</div></div>
          </div>${p.used ? '<span class="stamp">USED</span>' : ''}</div>`;
      }).join('')}</div>
      <div class="sheet-foot"><button class="btn ghost small" data-act="about">📝 My "About me" answers</button><button class="btn ghost small" data-act="logout">Log out</button><button class="btn small" data-m="no">Done</button></div></div></div>`;
  }
  function openPowerups() {
    modal.innerHTML = powerSheet();
    modal.querySelector('.modal').addEventListener('click', (e) => { if (e.target.classList.contains('modal')) modal.innerHTML = ''; });
  }

  function send(action, cb) {
    sock.emit('player', action, (r) => { if (r && r.error) { App.toast(r.error, true); App.vibrate(120); } else if (cb) cb(); });
  }
  const game = (action) => send({ type: 'game', action });

  function confirmSheet(html, yesLabel, onYes) {
    modal.innerHTML = `<div class="modal"><div class="sheet"><div class="sheet-grab"></div>${html}<div class="row" style="margin-top:14px"><button class="btn ghost grow" data-m="no">Cancel</button><button class="btn grow" data-m="yes">${yesLabel}</button></div></div></div>`;
    modal.querySelector('[data-m=yes]').onclick = () => { modal.innerHTML = ''; onYes(); };
    modal.querySelector('.modal').onclick = (e) => { if (e.target.classList.contains('modal')) modal.innerHTML = ''; };
  }

  function handle(e) {
    const r = e.target.closest('[data-react]');
    if (r) { sendReaction(r.dataset.react, r); return; }
    if (e.target.closest('[data-m=no]')) { modal.innerHTML = ''; return; }
    const el = e.target.closest('[data-act]');
    if (!el || !S) return;
    const act = el.dataset.act;
    const i = Number(el.dataset.i);
    if (act === 'use-pu') {
      e.stopPropagation();
      const pu = S.me.powerups.find((p) => p.id === el.dataset.id);
      if (pu) usePowerup(pu);
    } else if (act === 'flip') {
      if (!revealed.has(el.dataset.id)) {
        revealed.add(el.dataset.id);
        store.set('dgn_revealed', JSON.stringify([...revealed]));
        el.classList.add('flipped');
        App.fireworks(0.3); App.vibrate(25);
      }
    } else if (act === 'powerups') openPowerups();
    else if (act === 'tap-diya') { el.classList.remove('flare'); void el.offsetWidth; el.classList.add('flare'); App.vibrate(20); sendReaction('🪔'); }
    else if (act === 'answer') { el.classList.add('chosen'); game({ type: 'answer', choice: i }); App.vibrate(30); }
    else if (act === 'ff') { el.classList.add('chosen'); game({ type: 'ffAnswer', choice: i }); App.vibrate(30); }
    else if (act === 'buzz') { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); game({ type: 'buzz' }); App.vibrate(80); }
    else if (act === 'poll') game({ type: 'pollVote', choice: i });
    else if (act === 'predict') { App.vibrate(30); game({ type: 'predict', pick: el.dataset.pick }); }
    else if (act === 'lifeline') confirmSheet('<h3>Use this lifeline?</h3><p class="muted">You only get one of each.</p>', 'Yes!', () => game({ type: 'lifeline', name: el.dataset.name }));
    else if (act === 'lock') {
      const q = S.live.hot.question;
      confirmSheet(`<div class="center"><h3>Lock kiya jaaye?</h3><p style="font-size:20px"><b>${App.letters[i]}. ${esc(q.options[i])}</b></p></div>`, '🔒 Lock it', () => game({ type: 'lock', choice: i }));
    } else if (act === 'walk') confirmSheet('<h3>Walk away?</h3><p class="muted">You keep the points you have secured.</p>', '🚶 Walk away', () => game({ type: 'walk' }));
    else if (act === 'about') { modal.innerHTML = ''; openQuestionnaire(); }
    else if (act === 'logout') confirmSheet('<h3>Leave this phone?</h3><p class="muted">Your score stays in the room. Join again with the same phone number.</p>', 'Leave', () => { store.del('dgn_token'); store.del('dgn_token_room'); location.reload(); });
  }
  app.addEventListener('click', handle);
  dock.addEventListener('click', handle);
  modal.addEventListener('click', handle);

  startLogin();
})();
