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
  const COUNTRIES = [['1', '🇨🇦 🇺🇸 +1'], ['91', '🇮🇳 +91'], ['44', '🇬🇧 +44'], ['61', '🇦🇺 +61'], ['971', '🇦🇪 +971'], ['65', '🇸🇬 +65'], ['64', '🇳🇿 +64'], ['49', '🇩🇪 +49'], ['353', '🇮🇪 +353'], ['27', '🇿🇦 +27']];
  const L = { step: 'phone', name: '', avatar: '🪔', cc: store.get('dgn_cc') || '1', phone: '', via: null, returning: false, avatars: ['🪔', '🎆', '🐘', '🦚', '🐯', '🌺', '🪷', '🍬', '🎇', '🥭', '🌶️', '🦁', '🐒', '👑', '🪁', '🍵', '🌙', '⭐'], eventName: 'Diwali Game Night' };

  async function startLogin() {
    try { const m = await (await fetch('/api/meta')).json(); L.avatars = m.avatars; L.eventName = m.eventName; L.open = Boolean(m.openAccess); } catch { /* defaults */ }
    renderLogin();
  }

  function renderLogin() {
    dock.innerHTML = '';
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
  // =================== CONTROLLER ===================
  // The TV is the source of truth. The phone shows one "moment" at a time: only what you
  // need to act on right now. Moments cross-fade when they change.
  function start(token) {
    app.innerHTML = `<header class="ctl-head" id="hdr"></header><main class="moment-wrap"><div id="moment"></div></main>`;
    sock = App.connect('player', token, (s) => onState(s), (msg) => {
      store.del('dgn_token');
      if (sock) sock.disconnect();
      App.toast(msg, true);
      L.step = 'phone';
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
    if (!S.live && S.questionnaire.open && !answeredCount() && !store.get('dgn_q_prompted_' + S.me.id) && !modal.innerHTML) {
      store.set('dgn_q_prompted_' + S.me.id, '1');
      setTimeout(openQuestionnaire, 1200);
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
    const me = S.me;
    const t = me.teamId && teamOf(me.teamId);
    document.body.style.setProperty('--team', t ? t.color : 'var(--marigold)');
    App.patch(document.getElementById('hdr'), `${av(me)}<div class="who"><b>${esc(me.name)}</b>${t ? `<span class="team-pill">${esc(t.emoji)} ${esc(t.name)}</span>` : ''}</div>
      <div class="score-medal"><span id="scoreNum">${fmt(shownScore == null ? me.score : shownScore)}</span><small>pts</small></div>`);
    if (shownScore !== me.score) {
      const el = document.getElementById('scoreNum');
      if (shownScore != null && el) { App.countUp(el, me.score, 800, shownScore); el.parentElement.classList.remove('bump'); void el.offsetWidth; el.parentElement.classList.add('bump'); }
      shownScore = me.score;
    }
    const [key, html, mode] = moment();
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
    if (/^r-good|^hk-earned|called-yes|jp-won/.test(key)) { App.fireworks(0.6); App.vibrate([40, 40, 90]); }
    else if (/^r-bad|called-no/.test(key)) App.vibrate(140);
    else if (/^q-open|jp-open|ff-open/.test(key)) App.vibrate(30);
  }

  // Dock: reactions while you're watching, the 🎁 drawer between games, nothing while answering.
  function renderDock(mode) {
    const unused = S.me.powerups.filter((p) => !p.used).length;
    let html = '';
    if (mode === 'watch' || mode === 'break') {
      html = `<div class="react-bar">${REACTS.map((e) => `<button data-react="${e}" aria-label="Send ${e} to the TV">${e}</button>`).join('')}</div>`;
      if (mode === 'break') html = `<button class="pu-pill" data-act="powerups">🎁 <span>Power-ups</span>${unused ? `<i>${unused}</i>` : ''}</button>` + html;
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
    return ['idle', `${aboutCard()}<div class="tapper"><span class="eyebrow">${next ? `Up next · ${esc(next.emoji)} ${esc(next.title)}` : 'The host is setting up'}</span>
      <button class="big-diya" data-act="tap-diya" aria-label="Light the diya">${App.diya(true, 168)}</button>
      <p class="hand">Tap the diya to send sparks to the TV</p></div>`, 'break'];
  }

  // Quiz: the question is on the TV; the phone is four big shapes.
  function quizM(G) {
    if (G.phase === 'intro') return ['q-intro', watch('👀', 'Eyes on the TV', `${G.total} questions · match the shape on screen.<br/>The last one is a <b>✨ Double Diya</b>.`), 'watch'];
    if (G.phase === 'final') return ['q-final', watch('🎆', 'Round complete!', 'The standings are on the TV.'), 'watch'];
    const m = G.mine;
    const dd = G.doubleDiya ? '<span class="dd-badge">✨ Double Diya · ×2</span>' : '';
    if (G.phase === 'question') {
      if (App.now() < G.opensAt) { setTimeout(render, G.opensAt - App.now() + 30); return [`q-wait-${G.qIndex}`, `<div class="get-ready"><span class="eyebrow">Question ${G.qIndex + 1} of ${G.total}</span>${dd}<div class="gr-num" data-count="${G.opensAt}"></div><p>Read it on the TV</p></div>`, 'answer']; }
      if (m.answered) return [`q-locked-${G.qIndex}`, `<div class="locked"><div class="lock-tile o${m.choice}">${shape(m.choice)}</div>
        <h2>Locked in${m.order ? ` · #${m.order}` : ''}${m.order === 1 ? ' ⚡' : ''}</h2><p class="hand">${LOCK_LINES[(G.qIndex + (m.order || 0)) % LOCK_LINES.length]}</p>
        ${m.streak >= 2 ? `<span class="streak">🔥 ${m.streak} in a row</span>` : ''}</div>`, 'watch'];
      const hint = S.me.powerups.find((p) => p.type === 'hint' && !p.used);
      return [`q-open-${G.qIndex}`, `<div class="pad-head"><span class="eyebrow">Q${G.qIndex + 1} / ${G.total}</span>${dd}<span class="secs" data-count="${G.deadline}"></span></div>${timer(G.opensAt, G.deadline)}
        <div class="shape-pad">${G.question.options.map((_, i) => `<button class="pad o${i} ${m.hint && m.hint.includes(i) ? 'gone' : ''}" data-act="answer" data-i="${i}" aria-label="${App.shapeNames[i]}">${shape(i)}<span>${App.shapeNames[i]}</span></button>`).join('')}</div>
        ${hint && !m.hint && S.powerupsEnabled ? `<button class="hint-pill" data-act="use-pu" data-id="${hint.id}">✨ Phuljhari Hint — remove 2 wrong</button>` : ''}`, 'answer'];
    }
    const r = G.result;
    const q = G.question;
    const ans = `<div class="ans-chip o${r.answer}">${shape(r.answer)}<span>${esc(q.options[r.answer])}</span></div>`;
    if (m.choice == null) return [`r-none-${G.qIndex}`, `<div class="result meh"><div class="r-em">😴</div><h2>No answer!</h2><p>The answer was</p>${ans}</div>`, 'watch'];
    const right = m.choice === r.answer;
    const earned = (G.mode === 'team' ? (r.perTeam[S.me.teamId] || 0) : m.points) + (m.bonus || 0);
    const [line, emo] = RIGHT[G.qIndex % RIGHT.length];
    return [`r-${right ? 'good' : 'bad'}-${G.qIndex}`, `<div class="result ${right ? 'good' : 'bad'}"><div class="r-em">${right ? emo : '😅'}</div><h2>${right ? line : WRONG[G.qIndex % WRONG.length]}</h2>
      ${right ? `<div class="r-pts">+<span data-countup="${earned}">0</span></div>${r.double ? '<span class="streak">✨ Double Diya ×2</span>' : ''}${G.mode === 'team' ? '<p class="small">Team average · everyone on your team gets it</p>' : ''}` : `<p>The answer was</p>${ans}`}
      ${m.streak >= 2 ? `<span class="streak">🔥 ${m.streak} in a row${m.bonus ? ` · +${m.bonus}` : ''}</span>` : ''}</div>`, 'watch'];
  }

  // Jeopardy: the board is on the TV; your phone is a buzzer in your team's colour.
  function jeoM(G) {
    const m = G.mine;
    const ctl = G.control;
    if (G.phase === 'board') {
      return ['jp-board', watch('🧠', 'Eyes on the board', ctl ? (m.inControl ? `<b>Your ${G.mode === 'team' ? 'team picks' : 'pick'}!</b> Call out a category and value to the host.` : `${esc(ctl.name)} picks next.`) : 'The host is picking a clue.'), 'watch'];
    }
    if (G.phase === 'dd') return ['jp-dd', watch('💎', 'Daily Double!', m.inControl ? '<b>You found it!</b> Tell the host your wager.' : `${esc(ctl ? ctl.name : '')} is wagering…`), 'watch'];
    if (G.phase === 'answer') {
      const won = G.last && G.last.correct && G.last.key === m.key;
      return [won ? 'jp-won' : 'jp-ans', won ? `<div class="result good"><div class="r-em">🎉</div><h2>Correct!</h2><div class="r-pts">+<span data-countup="${G.last.value}">0</span></div><p>${G.mode === 'team' ? 'for your team · you pick next' : 'and you pick next'}</p></div>`
        : watch('✨', 'Answer on the TV', G.last && G.last.correct ? `${esc(G.last.info.name)} got it.` : 'Nobody got that one.'), 'watch'];
    }
    // clue
    if (G.dd) return ['jp-ddclue', watch('💎', m.inControl ? 'Answer out loud!' : 'Daily Double', m.inControl ? `Your wager: <b>${fmt(G.wager)}</b>` : `${esc(ctl ? ctl.name : '')} is answering for ${fmt(G.wager)}`), 'watch'];
    if (m.active) return ['jp-up', `<div class="buzz-wrap"><button class="buzzer up" disabled><span>YOU'RE UP</span></button><p class="buzz-cap"><b>Say your answer out loud!</b></p></div>`, 'answer'];
    if (m.locked) return ['jp-locked', watch('🔒', 'Locked out', 'Wrong answer — wait for the next clue.'), 'watch'];
    if (m.buzzed) return ['jp-queued', `<div class="buzz-wrap"><button class="buzzer queued" disabled><span>#${m.position}</span></button><p class="buzz-cap">You're #${m.position} in line</p></div>`, 'watch'];
    if (!G.buzzOpen) {
      return [`jp-armed-${G.cur.c}-${G.cur.i}`, `<div class="buzz-wrap"><button class="buzzer armed ${m.early ? 'early' : ''}" data-act="buzz"><span>${m.early ? 'TOO EARLY' : 'WAIT…'}</span></button>
        <p class="buzz-cap">${m.early ? '⏳ Jumped the gun — short lockout when buzzers open' : 'Buzzers open when the host has read the clue'}</p></div>`, 'answer'];
    }
    return [`jp-open-${G.cur.c}-${G.cur.i}`, `<div class="buzz-wrap"><button class="buzzer open" data-act="buzz"><span>BUZZ!</span></button><p class="buzz-cap">First to buzz answers</p></div>`, 'answer'];
  }

  // KBC: the hot seat locks answers; everyone else predicts Sahi / Galat.
  function kbcM(G) {
    if (G.phase === 'idle') return ['k-idle', watch('💰', 'Kaun Banega Crorepati', 'Fastest Finger First is coming — get ready!'), 'watch'];
    if (G.phase === 'ff' || G.phase === 'ff-result') {
      const f = G.ff;
      if (G.phase === 'ff') {
        if (App.now() < f.opensAt) { setTimeout(render, f.opensAt - App.now() + 30); return ['ff-wait', `<div class="get-ready"><span class="eyebrow">Fastest Finger First</span><div class="gr-num" data-count="${f.opensAt}"></div><p>Read it on the TV</p></div>`, 'answer']; }
        if (f.mine != null) return ['ff-locked', `<div class="locked"><div class="lock-tile kbc">${App.letters[f.mine]}</div><h2>Locked in!</h2><p class="hand">Fastest correct answer takes the hot seat</p></div>`, 'watch'];
        return ['ff-open', `<div class="pad-head"><span class="eyebrow">Fastest Finger First</span><span class="secs" data-count="${f.deadline}"></span></div>${timer(f.opensAt, f.deadline)}
          <div class="shape-pad kbc">${f.question.options.map((_, i) => `<button class="pad kbc" data-act="ff" data-i="${i}"><span class="kl">${App.letters[i]}</span></button>`).join('')}</div>`, 'answer'];
      }
      const won = f.result.winner === S.me.id;
      return [won ? 'ff-won' : 'ff-res', won ? `<div class="result good"><div class="r-em">🪑</div><h2>You're the fastest!</h2><p>Take the hot seat</p></div>` : watch('⚡', 'Fastest Finger done', 'Watch who takes the hot seat!'), 'watch'];
    }
    const h = G.hot;
    const isMe = h.pid === S.me.id;
    const hp = S.players.find((p) => p.id === h.pid);
    const lvl = G.ladder[h.questionLevel];
    if (isMe) {
      if (h.qPhase === 'over') return [`k-over`, `<div class="result ${h.status === 'wrong' ? 'bad' : 'good'}"><div class="r-em">${h.status === 'won' ? '🏆' : h.status === 'walked' ? '🚶' : '💔'}</div><h2>${fmt(h.winnings)} points</h2><p>${h.status === 'won' ? 'Crorepati! 🎆' : 'Thanks for playing!'}</p></div>`, 'watch'];
      if (h.qPhase === 'reveal') return [`k-right-${h.questionLevel}`, `<div class="result good"><div class="r-em">✅</div><h2>Sahi jawab!</h2><p>${fmt(lvl.points)} points secured</p></div>`, 'watch'];
      if (h.locked != null) return [`k-locked-${h.questionLevel}`, `<div class="locked"><div class="lock-tile kbc">${App.letters[h.locked]}</div><h2>Lock kiya!</h2><p class="hand">Waiting for the host to reveal…</p></div>`, 'watch'];
      return [`k-q-${h.questionLevel}`, `<div class="pad-head"><span class="eyebrow">Q${h.questionLevel + 1} · for ${fmt(lvl.points)}</span><span class="eyebrow">safe ${fmt(h.safe)}</span></div>
        <div class="kbc-list">${h.question.options.map((o, i) => `<button class="kbc-row ${h.removed.includes(i) ? 'gone' : ''}" data-act="lock" data-i="${i}"><b>${App.letters[i]}</b><span>${esc(o)}</span></button>`).join('')}</div>
        <div class="lifelines">${[['fifty', '✂️ 50:50'], ['poll', '📊 Poll'], ['phone', '📞 Friend']].map(([k, l]) => `<button class="ll" data-act="lifeline" data-name="${k}" ${h.lifelines[k] ? '' : 'disabled'}>${l}</button>`).join('')}</div>
        <button class="walk" data-act="walk">🚶 Walk away with ${fmt(h.level > 0 ? G.ladder[h.level - 1].points : 0)}</button>`, 'answer'];
    }
    if (h.poll && h.poll.open) {
      if (h.myVote != null) return ['k-poll-done', watch('📊', 'Vote counted', `You said <b>${App.letters[h.myVote]}</b>.`), 'watch'];
      return ['k-poll', `<div class="pad-head"><span class="eyebrow">📊 Audience poll — help ${esc(hp ? hp.name : '')}!</span></div>
        <div class="shape-pad kbc">${[0, 1, 2, 3].map((i) => `<button class="pad kbc ${h.removed.includes(i) ? 'gone' : ''}" data-act="poll" data-i="${i}"><span class="kl">${App.letters[i]}</span></button>`).join('')}</div>`, 'answer'];
    }
    if (h.qPhase === 'question') {
      if (h.myPrediction) return [`k-pred-${h.questionLevel}-done`, watch('🔮', `You said ${h.myPrediction === 'sahi' ? 'Sahi ✅' : 'Galat ❌'}`, `+25 if you call it right. Watch ${esc(hp ? hp.name : '')} sweat!`), 'watch'];
      return [`k-pred-${h.questionLevel}`, `<div class="predict"><span class="eyebrow">${esc(hp ? hp.name : '')} · Q${h.questionLevel + 1} for ${fmt(lvl.points)}</span><h2>Will they get it right?</h2><p>Call it for +25</p>
        <div class="pred-row"><button class="pred yes" data-act="predict" data-pick="sahi">✅<span>Sahi</span></button><button class="pred no" data-act="predict" data-pick="galat">❌<span>Galat</span></button></div></div>`, 'answer'];
    }
    if (h.qPhase === 'reveal' || h.qPhase === 'over') {
      if (h.myPrediction) return [h.iCalledIt ? `called-yes-${h.questionLevel}` : `called-no-${h.questionLevel}`, h.iCalledIt ? `<div class="result good"><div class="r-em">🔮</div><h2>Called it!</h2><div class="r-pts">+<span data-countup="25">0</span></div></div>` : `<div class="result bad"><div class="r-em">🙈</div><h2>Not this time</h2><p>Next question!</p></div>`, 'watch'];
    }
    return ['k-watch', watch('🪑', `${esc(hp ? hp.name : '')} is in the hot seat`, 'Eyes on the TV!'), 'watch'];
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
    else if (act === 'logout') confirmSheet('<h3>Log out?</h3><p class="muted">Your points are safe.</p>', 'Log out', () => { store.del('dgn_token'); location.reload(); });
  }
  app.addEventListener('click', handle);
  dock.addEventListener('click', handle);
  modal.addEventListener('click', handle);

  const tok = store.get('dgn_token');
  if (tok) start(tok); else startLogin();
})();
