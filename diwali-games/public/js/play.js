/* Player phone app */
(function () {
  const { esc, fmt, letters } = App;
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  const modal = document.getElementById('modal');
  App.sparkles(25);

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  let S = null;
  let sock = null;
  let tab = 'play';
  let seenLedger = null;
  let lastScore = null;
  const revealed = new Set(JSON.parse(store.get('dgn_revealed') || '[]'));

  // =================== LOGIN ===================
  const COUNTRIES = [['1', '🇨🇦 🇺🇸 +1'], ['91', '🇮🇳 +91'], ['44', '🇬🇧 +44'], ['61', '🇦🇺 +61'], ['971', '🇦🇪 +971'], ['65', '🇸🇬 +65'], ['64', '🇳🇿 +64'], ['49', '🇩🇪 +49'], ['353', '🇮🇪 +353'], ['27', '🇿🇦 +27']];
  const L = { step: 'phone', name: '', avatar: '🪔', cc: store.get('dgn_cc') || '1', phone: '', via: null, returning: false, avatars: ['🪔', '🎆', '🐘', '🦚', '🐯', '🌺', '🪷', '🍬', '🎇', '🥭', '🌶️', '🦁', '🐒', '👑', '🪁', '🍵', '🌙', '⭐'], eventName: 'Diwali Game Night' };

  async function startLogin() {
    try { const m = await (await fetch('/api/meta')).json(); L.avatars = m.avatars; L.eventName = m.eventName; L.open = Boolean(m.openAccess); } catch { /* defaults */ }
    renderLogin();
  }

  function renderLogin() {
    nav.classList.add('hidden');
    const title = esc(L.eventName).replace(/(\S+\s+\S+)$/, '<span>$1</span>');
    if (L.step === 'phone') {
      app.innerHTML = `<div class="login">
        <div class="hero"><div class="em">${App.diya(true, 92)}</div><h1>${title}</h1><p>Join the party · win the night ✨</p></div>
        <form class="card stack" id="f1">
          <div><label class="field">Your name</label><input type="text" id="name" maxlength="20" placeholder="e.g. Priya" value="${esc(L.name)}" autocomplete="given-name" /></div>
          <div><label class="field">Pick your avatar</label><div class="avatars">${L.avatars.map((a) => `<button type="button" data-av="${a}" class="${a === L.avatar ? 'on' : ''}">${a}</button>`).join('')}</div></div>
          ${L.open ? '' : `<div><label class="field">Phone number</label><div class="phone-row">
            <select id="cc">${COUNTRIES.map(([c, l]) => `<option value="${c}" ${c === L.cc ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <input type="tel" id="phone" inputmode="tel" placeholder="Phone number" value="${esc(L.phone)}" autocomplete="tel-national" /></div>
            <div class="small muted" style="margin-top:6px">Returning on a new device? Just use the same number.</div></div>`}
          <button class="btn big block" type="submit">${L.open ? "Let's play 🎉" : 'Send my code ✨'}</button>
        </form>
        <div class="center small" style="color:#fff;opacity:.6">Host? <a href="/host" style="color:var(--gold)">Open the host console</a></div>
      </div>`;
      app.querySelectorAll('[data-av]').forEach((b) => b.onclick = () => { L.avatar = b.dataset.av; app.querySelectorAll('[data-av]').forEach((x) => x.classList.toggle('on', x === b)); });
      app.querySelector('#f1').onsubmit = async (e) => {
        e.preventDefault();
        L.name = app.querySelector('#name').value.trim();
        const ccEl = app.querySelector('#cc'), phEl = app.querySelector('#phone');
        L.cc = ccEl ? ccEl.value : L.cc;
        L.phone = phEl ? phEl.value.trim() : '';
        store.set('dgn_cc', L.cc);
        const btn = e.submitter || app.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
          let deviceId = store.get('dgn_device');
          if (!deviceId) { deviceId = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('dgn_device', deviceId); }
          const r = await App.post('/api/otp/request', { name: L.name, cc: L.cc, phone: L.phone, avatar: L.avatar, deviceId });
          if (r.token) { store.set('dgn_token', r.token); App.confetti(1); start(r.token); return; }
          L.via = r.via; L.returning = r.returning; L.name = r.name; L.step = 'code';
          renderLogin();
        } catch (err) { App.toast(err.message, true); btn.disabled = false; }
      };
    } else {
      app.innerHTML = `<div class="login">
        <div class="hero"><div class="em">${L.returning ? '👋' : '🔐'}</div><h1>${L.returning ? `Welcome back, ${esc(L.name)}!` : `Namaste, ${esc(L.name)}!`}</h1><p>Enter your verification code</p></div>
        <form class="card stack" id="f2">
          ${L.via === 'sms' ? `<p class="muted" style="margin:0">We texted a 6-digit code to <b>+${esc(L.cc)} ${esc(L.phone)}</b>.</p>` : `<div class="relay">🪔 Your code is waiting with the <b>host</b> — ask them for your 4-digit code!</div>`}
          <input type="text" id="code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="${L.via === 'sms' ? '••••••' : '••••'}" />
          <button class="btn big block" type="submit">Let's play 🎉</button>
          <button class="btn ghost block" type="button" id="back">← Change number</button>
        </form></div>`;
      const code = app.querySelector('#code');
      code.focus();
      app.querySelector('#back').onclick = () => { L.step = 'phone'; renderLogin(); };
      app.querySelector('#f2').onsubmit = async (e) => {
        e.preventDefault();
        try {
          const r = await App.post('/api/otp/verify', { cc: L.cc, phone: L.phone, code: code.value });
          store.set('dgn_token', r.token);
          App.confetti(1);
          start(r.token);
        } catch (err) { App.toast(err.message, true); code.classList.add('shake'); setTimeout(() => code.classList.remove('shake'), 500); }
      };
    }
  }

  // =================== MAIN ===================
  function start(token) {
    app.innerHTML = `<div id="hdr"></div><div id="dbl"></div><div id="body"></div>`;
    nav.classList.remove('hidden');
    if (!document.querySelector('.react-bar')) {
      const bar = document.createElement('div');
      bar.className = 'react-bar';
      bar.innerHTML = REACTS.map((e) => `<button data-react="${e}" aria-label="Send ${e} to the TV">${e}</button>`).join('');
      document.body.appendChild(bar);
      bar.addEventListener('click', (e) => { const b = e.target.closest('[data-react]'); if (b) sendReaction(b.dataset.react, b); });
    }
    sock = App.connect('player', token, (s) => { onState(s); }, (msg) => {
      store.del('dgn_token');
      if (sock) sock.disconnect();
      App.toast(msg, true);
      L.step = 'phone';
      startLogin();
    });
  }

  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    nav.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    render();
  });

  // ---------- reactions: tap an emoji, it floats up on the TV ----------
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
    f.style.left = (btn ? btn.getBoundingClientRect().left + 8 : innerWidth / 2) + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1200);
  }

  function onState(s) {
    const prevLive = S && S.live;
    S = s;
    // Points notifications
    const hist = S.me.history;
    if (seenLedger === null) seenLedger = new Set(hist.map((h) => h.id));
    else {
      const fresh = hist.filter((h) => !seenLedger.has(h.id)).reverse();
      fresh.forEach((h) => seenLedger.add(h.id));
      const total = fresh.reduce((a, h) => a + h.amount, 0);
      // During a quiz reveal the result screen already celebrates the points.
      const quiet = S.live && S.live.type === 'quiz' && S.live.phase === 'reveal';
      if (fresh.length && quiet) { /* shown on the result screen */ } else if (fresh.length) {
        floatPoints(total);
        const robbed = fresh.find((h) => h.amount < 0);
        if (robbed) App.toast(`${robbed.reason}: ${robbed.amount}`, true);
        else App.toast(`+${total} · ${fresh[fresh.length - 1].reason}`);
        if (total > 0) { App.confetti(0.5); if (navigator.vibrate) navigator.vibrate(60); }
      }
    }
    lastScore = S.me.score;
    if (!S.live && S.questionnaire.open && !answeredCount() && !store.get('dgn_q_prompted_' + S.me.id) && !modal.innerHTML) {
      store.set('dgn_q_prompted_' + S.me.id, '1');
      setTimeout(openQuestionnaire, 1200);
    }
    // Jump to the play tab when a new game starts
    if (S.live && (!prevLive || prevLive.gameId !== S.live.gameId)) { tab = 'play'; nav.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x.dataset.tab === 'play')); }
    render();
  }

  function floatPoints(n) {
    const d = document.createElement('div');
    d.className = 'float-pts' + (n < 0 ? ' neg' : '');
    d.textContent = (n > 0 ? '+' : '') + n;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1700);
  }

  const teamOf = (tid) => S.teams.find((t) => t.id === tid);
  const av = (p) => `<span class="avatar" style="--c:${p.color}">${esc(p.avatar)}</span>`;

  function render() {
    if (!S) return;
    const me = S.me;
    const t = me.teamId && teamOf(me.teamId);
    App.patch(document.getElementById('hdr'), `<div class="me-bar">${av(me)}<div class="who"><div class="nm">${esc(me.name)}</div>${t ? `<span class="team-chip" style="background:${t.color}">${esc(t.emoji)} ${esc(t.name)}</span>` : `<span class="rank-chip">#${me.rank} of ${S.players.length}</span>`}</div>
      <div class="score"><b>${fmt(me.score)}</b><span>${t ? `#${me.rank} · ` : ''}points</span></div></div>`);
    App.patch(document.getElementById('dbl'), me.doubleActive ? `<div class="double-badge">💥 Double Dhamaka active — all points ×2 this game!</div>` : me.doublePending ? `<div class="double-badge">💥 Double Dhamaka armed for the next game</div>` : '');
    const unused = me.powerups.filter((p) => !p.used && !revealed.has(p.id)).length;
    const dot = document.getElementById('puDot');
    dot.textContent = unused; dot.classList.toggle('hidden', !unused);
    const body = document.getElementById('body');
    if (tab === 'play') App.patch(body, playTab());
    else if (tab === 'power') App.patch(body, powerTab());
    else App.patch(body, ranksTab());
    body.querySelectorAll('[data-countup]:not([data-done])').forEach((el) => {
      el.dataset.done = '1';
      App.countUp(el, Number(el.dataset.countup), 900);
      const flash = el.closest('.result-flash');
      if (flash && flash.classList.contains('good')) { App.fireworks(0.6); App.vibrate([40, 40, 80]); }
    });
    const bad = body.querySelector('.result-flash.bad:not([data-done])');
    if (bad) { bad.dataset.done = '1'; App.vibrate([120]); }
  }

  // ---------- Play tab ----------
  function playTab() {
    const G = S.live;
    if (!G) {
      const next = S.games.find((g) => g.status === 'pending');
      if (['awards', 'podium'].includes(S.tv.view)) return myNightCard() + feedCard();
      return `${aboutCard()}<div class="card panel tapper"><div class="up-next">${next ? `Up next · ${esc(next.emoji)} ${esc(next.title)}` : 'Hang tight · the host is setting up'}</div>
        <button class="big-diya" data-act="tap-diya" aria-label="Light the diya">${App.diya(true, 150)}</button>
        <p class="hand tap-hint">Tap the diya to send sparks to the TV ✨</p>
        <button class="btn gold" data-goto="power">🎁 Peek at my secret power-ups</button></div>${feedCard()}`;
    }
    const fn = { quiz: quizP, jeopardy: jeoP, kbc: kbcP, hookstep: hookP, custom: customP }[G.type];
    return `<div class="card panel slide-up"><div class="title"><span style="font-size:26px">${esc(G.emoji)}</span><h3>${esc(G.title)}</h3>${G.practice ? '<span class="chip" style="margin-left:auto">🧪 Practice</span>' : ''}<span class="chip ${G.mode === 'team' ? 'gold' : ''}" style="${G.practice ? '' : 'margin-left:auto'}">${G.mode === 'team' ? 'Team' : 'Solo'}</span></div>${fn(G)}</div>`;
  }

  const rankBefore = { q: null, rank: null };
  const LOCK_LINES = ['Diya lit! Waiting for the slowpokes…', 'Bas, ab dekhte hain… 👀', 'Confidence level: Shah Rukh arms wide 🙌', 'Locked. No take-backs!', 'Ab bhagwan bharose 🙏', 'Fingers crossed, toes too…'];
  const RIGHT_LINES = ['Sahi jawab!', 'Ekdum first class!', 'Shabash!', 'Kya baat hai!', 'Waah! Bilkul sahi!', 'Too good!'];
  const RIGHT_EMO = ['🎉', '🪔', '🎆', '✨', '🥳', '💯'];
  const WRONG_LINES = ['Arre yaar!', 'Oops, galat ho gaya!', 'So close… not really 😅', 'Koi baat nahi!', 'Next one is yours!'];
  const waitTv = (em, h, p) => `<div class="waiting"><div class="em">${em}</div><h2>${h}</h2>${p ? `<p class="muted">${p}</p>` : ''}</div>`;
  const timer = (s, e) => `<div class="timer" data-start="${s}" data-end="${e}" style="margin-bottom:12px"><i></i></div>`;

  function quizP(G) {
    if (G.phase === 'intro') return waitTv('👀', 'Get ready!', `${G.total} questions coming up. ${G.mode === 'team' ? 'Your team scores the average of everyone’s points — so everybody answer!' : 'Faster correct answers score more.'}`);
    if (G.phase === 'final') return waitTv('🎉', 'Round complete!', 'Watch the TV for the leaderboard.');
    const q = G.question;
    const m = G.mine;
    if (G.phase === 'question') {
      if (App.now() < G.opensAt) { setTimeout(render, G.opensAt - App.now() + 30); return waitTv('⏳', `Question ${G.qIndex + 1}`, 'Read it on the TV…'); }
      if (rankBefore.q !== G.qIndex) { rankBefore.q = G.qIndex; rankBefore.rank = S.me.rank; }
      if (m.answered) return `${timer(G.opensAt, G.deadline)}<div class="locked-in"><div class="pick-tile opt o${m.choice}"><span class="k">${App.shapes[m.choice]}</span>${esc(q.options[m.choice])}</div>
        <div class="lock-msg">${App.diya(true, 64)}<div><b>Locked in${m.order ? ` · #${m.order}` : ''}${m.order === 1 ? ' ⚡' : ''}</b><span class="hand">${LOCK_LINES[(G.qIndex + (m.order || 0)) % LOCK_LINES.length]}</span></div></div>
        ${m.streak >= 2 ? `<div class="streak-chip">🔥 ${m.streak} in a row — keep it going!</div>` : ''}</div>`;
      const hint = S.me.powerups.find((p) => p.type === 'hint' && !p.used);
      return `${timer(G.opensAt, G.deadline)}${q.clue ? `<div class="clue-sm">${esc(q.clue)}</div>` : ''}<div class="qtext">${esc(q.q)}</div>
        <div class="opts">${q.options.map((o, i) => `<button class="opt o${i} ${m.hint && m.hint.includes(i) ? 'gone' : ''}" data-act="answer" data-i="${i}"><span class="k">${App.shapes[i]}</span>${esc(o)}</button>`).join('')}</div>
        ${hint && !m.hint && S.powerupsEnabled ? `<button class="btn ghost block" style="margin-top:12px" data-act="use-pu" data-id="${hint.id}">✨ Use Phuljhari Hint (remove 2 wrong)</button>` : ''}`;
    }
    const r = G.result;
    const right = m.choice === r.answer;
    const ansTile = `<div class="pick-tile opt o${r.answer} small-tile"><span class="k">${App.shapes[r.answer]}</span>${esc(q.options[r.answer])}</div>`;
    const moved = rankBefore.q === G.qIndex && rankBefore.rank ? rankBefore.rank - S.me.rank : 0;
    const rankLine = `<div class="rank-line">You're <b>#${S.me.rank}</b>${moved > 0 ? ` <span class="up">▲${moved}</span>` : moved < 0 ? ` <span class="down">▼${-moved}</span>` : ''} of ${S.players.length}</div>`;
    if (m.choice == null) return `<div class="result-flash meh"><div class="em">😴</div><h2>Arre, no answer!</h2><p>The answer was</p>${ansTile}${rankLine}</div>`;
    const earned = G.mode === 'team' ? r.perTeam[S.me.teamId] || 0 : m.points;
    return `<div class="result-flash ${right ? 'good' : 'bad'}"><div class="em">${right ? RIGHT_EMO[G.qIndex % RIGHT_EMO.length] : '😅'}</div>
      <h2>${right ? RIGHT_LINES[G.qIndex % RIGHT_LINES.length] : WRONG_LINES[G.qIndex % WRONG_LINES.length]}</h2>
      ${right ? `<div class="pts-big">+<span data-countup="${earned + (m.bonus || 0)}">0</span></div>${G.mode === 'team' ? `<p class="small">You scored ${m.points} · team average awarded to everyone</p>` : ''}` : `<p>The answer was</p>${ansTile}`}
      ${m.streak >= 2 ? `<div class="streak-chip">🔥 ${m.streak} in a row${m.bonus ? ` · +${m.bonus} bonus` : ''}</div>` : ''}${rankLine}</div>`;
  }

  function jeoP(G) {
    if (G.phase === 'board') return waitTv('🧠', 'Watch the board', 'The host is picking the next clue. Get your thumb ready!');
    const m = G.mine;
    const c = G.clue;
    const head = `<p class="muted center" style="margin:0 0 4px">${esc(c.category)} · ${c.value}</p><div class="qtext center">${esc(c.q)}</div>`;
    if (G.phase === 'answer') {
      const won = G.last && G.last.correct && G.last.key === m.key;
      return `${head}<div class="big-state ${won ? 'good' : ''}"><div class="em">${won ? '🎉' : '✨'}</div><h2>${esc(c.a)}</h2>${won ? `<p><b>+${c.value}</b> for you${G.mode === 'team' ? 'r team' : ''}!</p>` : ''}</div>`;
    }
    if (m.active) return `${head}<button class="buzzer active" disabled style="opacity:1">YOU'RE<br/>UP!</button><p class="center"><b>Say your answer out loud!</b></p>`;
    if (m.locked) return `${head}<button class="buzzer" disabled>❌</button><p class="center muted">Locked out for this clue.</p>`;
    if (m.buzzed) return `${head}<button class="buzzer" disabled>#${m.position}</button><p class="center muted">You're in the queue at #${m.position}.</p>`;
    return `${head}<button class="buzzer" data-act="buzz" ${G.buzzOpen ? '' : 'disabled'}>BUZZ!</button>`;
  }

  function kbcP(G) {
    if (G.phase === 'idle') return waitTv('💰', 'Kaun Banega Crorepati', 'Get ready for Fastest Finger First!');
    if (G.phase === 'ff' || G.phase === 'ff-result') {
      const f = G.ff;
      if (G.phase === 'ff') {
        if (App.now() < f.opensAt) { setTimeout(render, f.opensAt - App.now() + 30); return waitTv('⚡', 'Fastest Finger First', 'Read the question on the TV…'); }
        if (f.mine != null) return `${timer(f.opensAt, f.deadline)}${waitTv('🔒', 'Locked in!', `You picked <b>${letters[f.mine]}</b>.`)}`;
        return `${timer(f.opensAt, f.deadline)}<div class="qtext">${esc(f.question.q)}</div><div class="opts kbc-p">${f.question.options.map((o, i) => `<button class="opt" data-act="ff" data-i="${i}"><span class="k">${letters[i]}</span>${esc(o)}</button>`).join('')}</div>`;
      }
      const won = f.result.winner === S.me.id;
      return won ? `<div class="big-state good"><div class="em">🪑</div><h2>You're fastest!</h2><p>Head to the hot seat!</p></div>` : waitTv('⚡', 'Fastest Finger done', f.result.winner ? `Answer: <b>${letters[f.result.answer]}</b>` : 'Nobody got it right!');
    }
    const h = G.hot;
    const isMe = h.pid === S.me.id;
    const q = h.question;
    const lvl = G.ladder[h.questionLevel];
    if (!isMe) {
      if (h.poll && h.poll.open) {
        if (h.myVote != null) return waitTv('📊', 'Vote counted!', `You voted <b>${letters[h.myVote]}</b>.`);
        return `<div class="qtext">📊 Audience poll — help them out!</div><div class="qtext">${esc(q.q)}</div><div class="opts kbc-p">${q.options.map((o, i) => `<button class="opt ${h.removed.includes(i) ? 'gone' : ''}" data-act="poll" data-i="${i}"><span class="k">${letters[i]}</span>${esc(o)}</button>`).join('')}</div>`;
      }
      const hp = S.players.find((p) => p.id === h.pid);
      return waitTv('🪑', `${esc(hp ? hp.name : '')} is in the hot seat`, `Question ${h.questionLevel + 1} for ${fmt(lvl.points)} points. Shhh… no hints (unless it's Phone-a-Friend 📞)!`);
    }
    if (h.qPhase === 'over') return `<div class="big-state ${h.status === 'wrong' ? 'bad' : 'good'}"><div class="em">${h.status === 'won' ? '🏆' : h.status === 'walked' ? '🚶' : '💔'}</div><h2>${fmt(h.winnings)} points</h2><p>${h.status === 'won' ? 'You conquered the ladder!' : 'Thanks for playing KBC!'}</p></div>`;
    if (h.qPhase === 'reveal') return `<div class="big-state good"><div class="em">✅</div><h2>Sahi jawab!</h2><p>${fmt(lvl.points)} points secured. Next question coming up…</p></div>`;
    const locked = h.locked != null;
    return `<div class="muted small">Question ${h.questionLevel + 1} · for <b>${fmt(lvl.points)}</b> points · safe: ${fmt(h.safe)}</div><div class="qtext">${esc(q.q)}</div>
      <div class="opts kbc-p">${q.options.map((o, i) => `<button class="opt ${h.removed.includes(i) ? 'gone' : ''} ${h.locked === i ? 'locked' : ''}" data-act="lock" data-i="${i}" ${locked ? 'disabled' : ''}><span class="k">${letters[i]}</span>${esc(o)}</button>`).join('')}</div>
      ${locked ? `<p class="center"><b>🔒 Locked! Waiting for the host to reveal…</b></p>` : `
      <div class="lifeline-row">
        <button class="btn small ${h.lifelines.fifty ? 'teal' : 'ghost'}" data-act="lifeline" data-name="fifty" ${h.lifelines.fifty ? '' : 'disabled'}>✂️ 50:50</button>
        <button class="btn small ${h.lifelines.poll ? 'teal' : 'ghost'}" data-act="lifeline" data-name="poll" ${h.lifelines.poll ? '' : 'disabled'}>📊 Poll</button>
        <button class="btn small ${h.lifelines.phone ? 'teal' : 'ghost'}" data-act="lifeline" data-name="phone" ${h.lifelines.phone ? '' : 'disabled'}>📞 Friend</button>
      </div>
      ${h.poll && !h.poll.open ? `<p class="small center">Poll: ${h.poll.counts.map((c, i) => `${letters[i]} ${c}`).join(' · ')}</p>` : ''}
      <button class="btn ghost block" style="margin-top:10px" data-act="walk">🚶 Walk away with ${fmt(h.level > 0 ? G.ladder[h.level - 1].points : 0)}</button>`}`;
  }

  function hookP(G) {
    const perf = G.perf;
    const amPerformer = perf && perf.performer && (perf.performer.key === 'p:' + S.me.id || perf.performer.key === 't:' + S.me.teamId);
    if (G.phase === 'idle' || !perf) return waitTv('💃', 'Hook Step Challenge', 'The host is choosing the next performer…');
    if (G.phase === 'spin') return waitTv('🎰', 'Spinning the song…', amPerformer ? 'Get ready — it’s YOU!' : `Up next: ${esc(perf.performer.name)}`);
    if (G.phase === 'ready' || G.phase === 'perform') {
      const s = perf.song;
      if (amPerformer) return `<div class="big-state good"><div class="em">🕺</div><h2>You're on!</h2>${s ? `<p><b>${esc(s.title)}</b><br/>Hook step: ${esc(s.step)}</p>` : ''}</div>`;
      return waitTv('👀', `${esc(perf.performer.name)} is ${G.phase === 'perform' ? 'performing' : 'up next'}!`, 'Cheer loud — you’ll rate them in a moment.');
    }
    if (G.phase === 'voting') {
      if (!G.mine || !G.mine.canVote) return waitTv('🙏', 'The crowd is voting…', 'Strike a pose while you wait!');
      const v = G.mine.vote;
      return `<div class="center"><h2 style="font-size:22px">Rate ${esc(perf.performer.name)}!</h2><p class="muted">Tap the diyas — 1 to 5</p>
        <div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-act="vote" data-stars="${n}" class="${v && n <= v ? 'on' : ''}">🪔</button>`).join('')}</div>
        <p>${v ? `You gave <b>${v}</b> diya${v > 1 ? 's' : ''} — tap to change` : ''}</p>${timer(G.startedAt, G.until)}</div>`;
    }
    if (G.phase === 'tally') return waitTv('🧮', 'Counting votes…');
    const last = G.last;
    return last ? waitTv('🌟', `${esc(last.performer.name)}: +${last.points}`, `${last.avg} ★ average from ${last.votes} votes`) : '';
  }

  function customP(G) { return waitTv(G.emoji, esc(G.title), esc(G.description) || 'The host is keeping score — watch the TV!'); }

  // ---------- "About me" questionnaire ----------
  const answeredCount = () => Object.values(S.questionnaire.answers || {}).filter(Boolean).length;
  function aboutCard() {
    const Q = S.questionnaire;
    if (!Q.open) return '';
    const n = answeredCount(), total = Q.prompts.length;
    return `<div class="card about-card" style="margin-bottom:12px"><div class="row"><div style="font-size:40px">📝</div><div class="grow">
      <h3 style="margin:0">${n ? 'Thanks for sharing!' : 'Tell us about you & the gang'}</h3>
      <p class="small muted" style="margin:4px 0 0">${n ? `${n} of ${total} answered. Some of tonight's questions will be about you 👀` : 'Quick questions about you, your garba crew and secret group votes. They turn into game questions tonight ✨'}</p></div></div>
      <button class="btn ${n ? 'ghost' : ''} block" style="margin-top:12px" data-act="about">${n ? 'Edit my answers' : 'Start (3 minutes) →'}</button></div>`;
  }
  const SECTIONS = [['you', '🙋 About you'], ['garba', '🪔 Garba time'], ['group', '👯 About the group'], ['vote', '🗳️ Secret group votes']];
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
    modal.innerHTML = `<div class="modal"><div class="sheet about-sheet"><h3>📝 About you & the gang</h3>
      <p class="muted small" style="margin-top:4px">Answer as many as you like (skip any). Answers become some of tonight's game questions, so the whole party gets to guess! Votes stay secret. Only the winner is revealed 🤫</p>
      <form id="qf" class="stack">${groups.map(([title, list]) => `<div class="q-sec"><h4>${title}</h4>${list.map(field).join('')}${title.includes('group') || title.includes('votes') ? '<p class="small muted" style="margin:6px 0 0">Someone missing? They may not have joined yet. Come back and update your answers later.</p>' : ''}</div>`).join('')}
        <div class="row q-actions"><button type="button" class="btn ghost grow" data-m="no">Later</button><button class="btn grow" type="submit">Save my answers ✨</button></div></form></div></div>`;
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

  function feedCard() {
    if (!S.feed.length) return '';
    return `<div class="card" style="margin-top:12px"><h3>📣 Latest</h3>${S.feed.slice(0, 6).map((f) => `<div class="hist-row"><span>${esc(f.emoji || '✨')} ${esc(f.text)}</span></div>`).join('')}</div>`;
  }

  // ---------- Power-ups tab ----------
  function powerTab() {
    const pus = S.me.powerups;
    return `<div class="card" style="margin-bottom:12px"><h3>🎁 Your secret power-ups</h3><p class="muted small" style="margin:0">Only you can see these. Tap a card to reveal it, then use it at the perfect moment.${S.powerupsEnabled ? '' : ' <b>Power-ups are paused by the host right now.</b>'}</p></div>
      <div class="pu-grid">${pus.map((p) => {
        const flipped = revealed.has(p.id) || p.used;
        let action = '';
        if (p.used) action = '';
        else if (p.passive) action = `<span class="chip done">🛡️ Active — protecting you</span>`;
        else action = `<button class="btn small" data-act="use-pu" data-id="${p.id}" ${S.powerupsEnabled ? '' : 'disabled'}>Use it!</button>`;
        return `<div class="pu ${flipped ? 'flipped' : ''} ${p.used ? 'used' : ''}" data-act="flip" data-id="${p.id}"><div class="pu-inner">
          <div class="pu-face pu-back"><div class="em">🎁</div><b>Tap to reveal</b><span class="small" style="opacity:.8">Shhh… it's a secret</span></div>
          <div class="pu-face pu-front"><div class="em">${p.emoji}</div><div><h4>${esc(p.name)}</h4><p>${esc(p.desc)}</p>${action}</div></div>
          </div>${p.used ? '<span class="stamp">USED</span>' : ''}</div>`;
      }).join('')}</div>`;
  }

  // ---------- Ranks tab ----------
  function ranksTab() {
    const me = S.me;
    const night = myNightCard();
    const teams = S.teams.length ? `<div class="card" style="margin-bottom:12px"><h3>Teams</h3>${[...S.teams].sort((a, b) => b.total - a.total).map((t) => `<div class="rank-row ${t.id === me.teamId ? 'me' : ''}"><span class="avatar" style="--c:${t.color}">${esc(t.emoji)}</span>${esc(t.name)}<span class="sc">${fmt(t.total)}</span></div>`).join('')}</div>` : '';
    return `${night}${teams}<div class="card" style="margin-bottom:12px"><h3>🏆 Leaderboard</h3>${S.players.map((p) => `<div class="rank-row ${p.id === me.id ? 'me' : ''}"><span class="rk">${p.rank}</span>${av(p)}<span>${esc(p.name)}</span><span class="sc">${fmt(p.score)}</span></div>`).join('')}</div>
      <div class="card"><h3>📜 My points</h3>${me.history.length ? me.history.map((h) => `<div class="hist-row"><span>${esc(h.reason)}</span><b class="${h.amount > 0 ? 'pos' : 'neg'}">${h.amount > 0 ? '+' : ''}${h.amount}</b></div>`).join('') : '<p class="muted">No points yet — the night is young!</p>'}
      ${S.questionnaire.open ? '<button class="btn ghost small" style="margin-top:12px" data-act="about">📝 Edit my "About me" answers</button>' : ''}
      <button class="btn ghost small" style="margin-top:12px" data-act="logout">Log out of this device</button></div>`;
  }

  // ---------- actions ----------
  // ---------- "My Diwali Night" keepsake card ----------
  function myNightCard() {
    const me = S.me, st = me.stats || {};
    const acc = st.answered ? Math.round((100 * st.correct) / st.answered) : null;
    const used = me.powerups.filter((p) => p.used).length;
    const medal = me.rank === 1 ? '🥇' : me.rank === 2 ? '🥈' : me.rank === 3 ? '🥉' : '🪔';
    const year = new Date().getFullYear();
    return `<div class="night-card">
      <div class="nc-top"><span class="hand">${esc(S.eventName)} · ${year}</span></div>
      <div class="nc-avatar">${av(me)}</div>
      <h2>${esc(me.name)}'s Diwali Night</h2>
      <div class="nc-rank">${medal} Finished <b>#${me.rank}</b> of ${S.players.length} · <b>${fmt(me.score)}</b> pts</div>
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

  function send(action, cb) {
    sock.emit('player', action, (r) => { if (r && r.error) App.toast(r.error, true); else if (cb) cb(); });
  }
  const game = (action) => send({ type: 'game', action });

  function confirmSheet(html, yesLabel, onYes) {
    modal.innerHTML = `<div class="modal"><div class="sheet">${html}<div class="row" style="margin-top:14px"><button class="btn ghost grow" data-m="no">Cancel</button><button class="btn grow" data-m="yes">${yesLabel}</button></div></div></div>`;
    modal.querySelector('[data-m=no]').onclick = () => { modal.innerHTML = ''; };
    modal.querySelector('[data-m=yes]').onclick = () => { modal.innerHTML = ''; onYes(); };
    modal.querySelector('.modal').onclick = (e) => { if (e.target.classList.contains('modal')) modal.innerHTML = ''; };
  }

  function usePowerup(pu) {
    if (pu.type === 'steal') {
      const others = S.players.filter((p) => p.id !== S.me.id);
      modal.innerHTML = `<div class="modal"><div class="sheet"><h3>🦹 Who do you want to rob?</h3><p class="muted small">Steals up to the host's limit. Watch out for shields!</p>
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

  app.addEventListener('click', (e) => {
    const goto = e.target.closest('[data-goto]');
    if (goto) { nav.querySelector(`[data-tab=${goto.dataset.goto}]`).click(); return; }
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
        App.confetti(0.3);
        render();
      }
    } else if (act === 'tap-diya') {
      el.classList.remove('flare'); void el.offsetWidth; el.classList.add('flare');
      App.vibrate(20);
      sendReaction('🪔');
    } else if (act === 'answer') { game({ type: 'answer', choice: i }); if (navigator.vibrate) navigator.vibrate(30); }
    else if (act === 'ff') game({ type: 'ffAnswer', choice: i });
    else if (act === 'buzz') { game({ type: 'buzz' }); if (navigator.vibrate) navigator.vibrate(80); }
    else if (act === 'poll') game({ type: 'pollVote', choice: i });
    else if (act === 'vote') game({ type: 'vote', stars: Number(el.dataset.stars) });
    else if (act === 'lifeline') confirmSheet(`<h3>Use this lifeline?</h3><p class="muted">You only get one of each.</p>`, 'Yes!', () => game({ type: 'lifeline', name: el.dataset.name }));
    else if (act === 'lock') {
      const q = S.live.hot.question;
      confirmSheet(`<div class="center"><h3>Lock kiya jaaye?</h3><p style="font-size:20px"><b>${letters[i]}. ${esc(q.options[i])}</b></p></div>`, '🔒 Lock it', () => game({ type: 'lock', choice: i }));
    } else if (act === 'walk') confirmSheet(`<h3>Walk away?</h3><p class="muted">You'll keep the points you've secured so far.</p>`, '🚶 Walk away', () => game({ type: 'walk' }));
    else if (act === 'about') openQuestionnaire();
    else if (act === 'logout') confirmSheet(`<h3>Log out?</h3><p class="muted">Your points are safe — log in again with the same number.</p>`, 'Log out', () => { store.del('dgn_token'); location.reload(); });
  });

  const tok = store.get('dgn_token');
  if (tok) start(tok); else startLogin();
})();
