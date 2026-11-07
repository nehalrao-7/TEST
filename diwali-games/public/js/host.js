/* Host console */
(function () {
  const { esc, fmt, letters } = App;
  const app = document.getElementById('app');
  const modal = document.getElementById('modal');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  let S = null;
  let sock = null;
  let tab = store.get('dgn_host_tab') || 'live';
  const ui = { awardTarget: '', awardReason: '', awardAmount: '100', performer: '', song: '', judge: '100', seat: '', teamCount: '3', newType: 'quiz', newTitle: '', newMode: 'individual', annTitle: '', annText: '' };

  // ---------- login ----------
  function session() {
    try { return JSON.parse(store.get('dgn_host_session') || 'null'); } catch { return null; }
  }
  function saveSession(code, token, pin) {
    const prev = session();
    store.set('dgn_host_session', JSON.stringify({ code, token, pin: pin || (prev && prev.code === code ? prev.pin : '') || '' }));
    store.set('dgn_host', token);
  }
  async function loginView() {
    const preset = App.roomFromQuery() || (session() && session().code) || '';
    app.innerHTML = `<div class="login-card card stack">
      <div class="center"><div style="font-size:52px">🪔</div><h2 style="font-size:28px">Host a room</h2><p class="muted">Each room is its own game. Scores stay in the room.</p></div>
      <label class="field" for="createKey">Host key</label>
      <input type="password" id="createKey" autocomplete="current-password" aria-label="Host key" />
      <button class="btn diya-btn big block" id="newRoom" type="button">${App.diya(true, 28)} Start a new room</button>
      <form id="lf" class="stack">
        <label class="field" for="room">Open an existing room</label>
        <input type="text" id="room" class="code-input" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="ABCD" aria-label="Room code" value="${esc(preset)}" />
        <input type="password" id="pin" inputmode="numeric" placeholder="Host PIN" autocomplete="current-password" aria-label="Host PIN" />
        <button class="btn block" type="submit">Open room</button>
      </form>
      <p class="fine">Starting a room needs the host key. Guests confirm a phone code. Texts use Twilio when it is set up. Fonts load from Google.</p>
      <p class="fine"><a href="/">Join as a player</a> · <a href="/tv">TV</a></p>
    </div>`;
    const pin = () => (app.querySelector('#pin') ? app.querySelector('#pin').value : '');
    app.querySelector('#newRoom').onclick = async () => {
      const btn = app.querySelector('#newRoom');
      btn.disabled = true;
      try {
        const key = (app.querySelector('#createKey') || {}).value || '';
        if (!key) { App.toast('Enter the host key.', true); btn.disabled = false; return; }
        const r = await App.post('/api/room/create', { key });
        saveSession(r.code, r.token, r.pin);
        App.room = r.code;
        history.replaceState(null, '', '/host?room=' + r.code);
        start(r.token);
      } catch (err) { App.toast(err.message, true); btn.disabled = false; }
    };
    app.querySelector('#lf').onsubmit = async (e) => {
      e.preventDefault();
      const code = App.canonRoom(app.querySelector('#room').value);
      if (!code) { App.toast('Enter the 4-character room code.', true); return; }
      try {
        App.room = code;
        const r = await App.post('/api/host/login', { room: code, pin: pin() });
        saveSession(r.code || code, r.token, pin());
        history.replaceState(null, '', '/host?room=' + (r.code || code));
        start(r.token);
      } catch (err) { App.toast(err.message, true); }
    };
  }

  function start(token) {
    App.sparkles(14);
    app.innerHTML = `<div class="htop"><div class="hbrand"><div class="logo"><span class="diya">🪔</span><b>Host <span>Console</span></b></div><button class="room-pill" id="roomPill" type="button" data-a="copyCode" title="Copy room code"></button></div><div id="pinSlot"></div><div id="diffSlot"></div><div class="htabs" id="tabs"></div></div><div id="main"></div>`;
    sock = App.connect('host', token, (s) => { S = s; const pill = document.getElementById('roomPill'); if (pill && s.code) pill.textContent = s.code; render(); }, () => { store.del('dgn_host'); store.del('dgn_host_session'); if (sock) sock.disconnect(); loginView(); });
  }

  const editor = window.createEditor({ send: (a, cb) => sock.emit('host', a, cb), toast: App.toast, rerender: (force) => render(force) });
  window.addEventListener('beforeunload', (e) => { if (editor.isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  const act = (a, ok) => sock.emit('host', a, (r) => { if (r && r.error) App.toast(r.error, true); else if (ok) App.toast(ok); });
  const gameAct = (action, ok) => act({ type: 'game', action }, ok);

  // ---------- render ----------
  function render(force) {
    if (!S) return;
    const pend = S.pending.length;
    App.patch(document.getElementById('tabs'), [['live', '🎮 Live'], ['games', '🗂 Games'], ['questions', '✏️ Questions'], ['players', `👥 Players${pend ? `<span class="dot">${pend}</span>` : ''}`], ['scores', '📊 Scores & Settings']]
      .map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join(''));
    const pinSlot = document.getElementById('pinSlot');
    if (pinSlot) App.patch(pinSlot, pinBanner());
    const diffSlot = document.getElementById('diffSlot');
    if (diffSlot) {
      const liveName = S.live && (S.live.difficultyName || 'Party');
      App.patch(diffSlot, tab === 'live' ? (S.live ? `<p class="diff-live">This round is <b>${esc(liveName)}</b></p>` : diffControl()) : '');
    }
    const main = document.getElementById('main');
    const html = { live: liveTab, games: gamesTab, questions: () => editor.html(S), players: playersTab, scores: scoresTab }[tab]();
    App.patch(main, html, force);
  }

  const player = (id) => S.players.find((p) => p.id === id);
  const pname = (id) => { const p = player(id); return p ? `${esc(p.avatar)} ${esc(p.name)}` : '—'; };
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${String(sel) === String(v) ? 'selected' : ''}>${label}</option>`;
  const entityOptions = (sel, includeTeams = true) =>
    (includeTeams && S.teams.length ? `<optgroup label="Teams">${S.teams.map((t) => opt('t:' + t.id, `${esc(t.emoji)} ${esc(t.name)}`, sel)).join('')}</optgroup>` : '') +
    `<optgroup label="Players">${S.players.map((p) => opt('p:' + p.id, `${esc(p.avatar)} ${esc(p.name)} (${fmt(p.score)})`, sel)).join('')}</optgroup>`;

  // ================= LIVE TAB =================
  function liveTab() {
    const L = S.live;
    let left;
    if (!L) {
      const next = S.games.find((g) => g.status === 'pending');
      left = `<div class="card"><h3>🎬 No game running</h3><p class="muted">${S.players.length} players joined · ${S.players.filter((p) => p.online).length} online</p>
        ${next ? `<button class="btn big" data-a="start" data-id="${next.id}">▶ Start ${esc(next.emoji)} ${esc(next.title)}</button>` : '<p>All games done! Show the podium 🏆</p>'}
        <div class="sec-title">All games</div>${S.games.map((g) => `<div class="kv"><span>${esc(g.emoji)} ${esc(g.title)} <span class="chip">${g.mode}</span></span><span>${g.status === 'done' ? '<span class="chip done">done</span>' : `<button class="btn small" data-a="start" data-id="${g.id}">Start</button>`}</span></div>`).join('')}
      </div>`;
    } else {
      const fn = { quiz: quizCtl, jeopardy: jeoCtl, kbc: kbcCtl, hookstep: hookCtl, custom: () => '<p class="muted">Award points with the panel on the right. End the game when you are done.</p>' }[L.type];
      left = `<div class="card"><h3>${esc(L.emoji)} ${esc(L.title)} <span class="chip live">LIVE</span><span class="chip">${L.mode}</span>${L.difficultyName ? `<span class="chip">${esc(L.difficultyName)}</span>` : ''}${L.practice ? '<span class="chip">🧪 practice questions</span>' : ''}${S.personalCount ? `<span class="chip gold">✨ ${S.personalCount} personalised</span>` : ''}
        <button class="btn red small" style="margin-left:auto" data-a="end">🏁 End game → leaderboard</button></h3>${fn(L)}</div>`;
    }
    return `${cueBar()}<div class="hgrid"><div>${demoCard()}${left}${tvCard()}</div><div>${pendingCard()}${awardCard()}${feedCard()}</div></div>`;
  }

  // ---------- Run of show + the single "next cue" (a stage manager's cue list) ----------
  function nextCue() {
    const L = S.live;
    const g = (action, label, hint) => ({ label, hint, run: () => gameAct(action) });
    const a = (action, label, hint) => ({ label, hint, run: () => act(action) });
    const wait = (label, hint) => ({ label, hint, disabled: true });
    if (!L) {
      const next = S.games.find((x) => x.status === 'pending');
      if (S.tv.view === 'awards') {
        const n = S.awardsCount || 0, i = S.tv.awardIndex || 0;
        return i <= n ? a({ type: 'award-step', dir: 1 }, i === 0 ? '🎖️ Reveal the first award' : i === n ? '🪔 Reveal the champion' : '▶ Next award', `Each award adds +200 points`) : a({ type: 'tv', view: 'podium' }, '🥇 Show the podium', 'The grand finale');
      }
      if (next) return a({ type: 'startGame', gameId: next.id }, `▶ Start ${next.emoji} ${next.title}`, next.mode === 'team' && !S.teams.length ? 'Make teams first (Players tab)' : `${S.players.length} players ready`);
      return a({ type: 'tv', view: 'awards' }, '🎖️ Start the Diwali Awards', 'All games played — time for the ceremony');
    }
    const end = a({ type: 'endGame' }, '🏁 End game → standings', 'Shows the standings on the TV');
    if (L.type === 'quiz') {
      if (L.phase === 'intro') return g({ type: 'next' }, '▶ First question', `${L.total} questions`);
      if (L.phase === 'question') return g({ type: 'reveal' }, '⏩ Reveal the answer', `${L.answered} answered`);
      if (L.phase === 'reveal') return L.qIndex + 1 >= L.total ? g({ type: 'next' }, '🏁 Finish the round', 'That was the Double Diya') : g({ type: 'next' }, '▶ Next question', L.qIndex + 2 === L.total ? 'Next one is the ✨ Double Diya' : `Q${L.qIndex + 2} of ${L.total}`);
      return end;
    }
    if (L.type === 'jeopardy') {
      const who = L.turn ? L.turn.name : 'The next team';
      if (L.phase === 'board') return L.categories.every((c) => c.clues.every((x) => x.used)) ? end : wait('👇 Tap the clue they call', `${who} is up`);
      if (L.phase === 'clue') return wait('Mark it below', `${who} answers out loud. A right answer pays everyone on the team.`);
      return g({ type: 'board' }, '↩ Next team', who ? `${who} is up` : '');
    }
    if (L.type === 'kbc') {
      if (L.phase === 'question') return g({ type: 'reveal' }, '⏩ Reveal now', `${L.answered} answered · fastest gets full points`);
      if (L.phase === 'done' || (L.phase === 'reveal' && L.qIndex + 1 >= L.total)) return end;
      return g({ type: 'next' }, L.phase === 'idle' ? '▶ First question' : '▶ Next question', 'Open to everyone. Later places get less.');
    }
    if (L.type === 'hookstep') {
      const p = L.perf;
      const nextTeam = () => { const used = L.results.map((r) => r.team && r.team.key); const t = S.teams.find((x) => !used.includes('t:' + x.id)) || S.teams[0]; return t ? 't:' + t.id : null; };
      if (!p || L.phase === 'idle' || L.phase === 'scored') {
        if (L.phase === 'scored' && S.teams.length && L.results.length >= S.teams.length) return end;
        return { label: L.mode === 'team' ? '📣 Call the next team up' : '📣 Open the floor', hint: 'A song spins next', run: () => gameAct({ type: 'setup', team: L.mode === 'team' ? (ui.hookTeam || nextTeam()) : null, songIndex: ui.song }) };
      }
      if (L.phase === 'spin') return wait('🎰 Spinning…', '');
      if (L.phase === 'ready') return p.song ? g({ type: 'perform' }, '▶ Start the dance', `🎵 ${p.song.title}`) : g({ type: 'spin' }, '🎰 Spin a song on the TV', 'Builds suspense');
      if (L.phase === 'perform') return g({ type: 'stop' }, '▶ Next — judge the dance', 'The video keeps playing');
      return p.stars ? g({ type: 'score' }, '🏅 Award the points', `${p.stars} diyas · ${p.dancers.length} dancers`) : wait('🪔 Rate the dance below', 'Tap 1–5 diyas, then measure the crowd');
    }
    return end;
  }
  function cueBar() {
    const cue = nextCue();
    window._cue = cue;
    const steps = [['lobby', '🏠 Lobby', S.tv.view === 'lobby' && !S.live]].concat(S.games.map((x) => [x.id, `${x.emoji} ${x.title}`, x.status === 'live', x.status === 'done'])).concat([['awards', '🎖️ Awards', S.tv.view === 'awards'], ['podium', '🥇 Podium', S.tv.view === 'podium']]);
    return `<div class="cue-bar"><div class="ros">${steps.map(([k, l, on, done]) => `<span class="ros-step ${on ? 'on' : ''} ${done ? 'done' : ''}">${esc(l)}</span>`).join('<i></i>')}</div>
      <div class="cue-main"><div class="cue-hint"><span class="eyebrow">Next cue</span><b>${esc(cue.hint || '')}</b></div>
      <button class="btn big cue-btn" data-a="cue" ${cue.disabled ? 'disabled' : ''}>${esc(cue.label)}<kbd>Space</kbd></button></div></div>`;
  }

  function pinBanner() {
    const sess = session();
    if (!sess || !sess.pin || !S || sess.code !== S.code) return '';
    const shown = String(sess.pin).replace(/(.{4})(?=.)/g, '$1 ');
    return `<div class="pin-banner"><span>Host PIN</span><b>${esc(shown)}</b><span>Write this down to open the room again</span></div>`;
  }

  function demoCard() {
    if (S.demo && S.live) return `<div class="demo-slim">🤖 Demo: ${S.demo.bots} bots playing along${S.settings.practice ? ' · 🧪 practice questions' : ''}<span class="grow"></span><button class="btn small red" data-a="demoEnd">End demo & reset</button></div>`;
    if (S.demo) {
      return `<div class="card demo-on"><div class="row"><span style="font-size:30px">🤖</span><div class="grow"><b>Demo mode: ${S.demo.bots} bots are playing along</b>
        <div class="small muted">They answer, dance, use power-ups and send reactions. Run any game from the list below.</div></div>
        <button class="btn red small" data-a="demoEnd">End demo & reset for the party</button></div>${practiceRow()}</div>`;
    }
    if (S.games.some((g) => g.status === 'live')) return '';
    return `<div class="card demo-off"><div class="row"><span style="font-size:30px">🤖</span><div class="grow"><b>Try a practice run with bots</b>
      <div class="small muted">Adds bot guests with questionnaire answers (couples, best friends, group votes) and teams. Join as a player in another tab or on your phone, then run the games from here. One click removes them afterwards.</div></div>
      <select data-ui="demoCount" style="width:auto">${[6, 8, 10, 12].map((n) => opt(n, `${n} bots`, ui.demoCount || 8)).join('')}</select>
      <button class="btn rani" data-a="demoStart">🤖 Start demo</button></div>${practiceRow()}</div>`;
  }

  const DIFF_NAMES = ['', 'Warm', 'Gentle', 'Party', 'Tricky', 'Spicy'];
  const DIFF_BLURB = ['', 'Easy stand-in questions, more time.', 'Your questions, a little more time.', 'Your questions, the usual clock.', 'Your questions, a shorter clock.', 'Your questions, the shortest clock.'];
  function diffControl() {
    const n = Math.max(1, Math.min(5, Number(S.settings && S.settings.difficulty) || 3));
    return `<div class="diff"><div class="diff-top"><span class="field">Question difficulty</span><b>${DIFF_NAMES[n]}</b></div>
      <input type="range" min="1" max="5" step="1" value="${n}" data-a="difficulty" aria-valuemin="1" aria-valuemax="5" aria-valuenow="${n}" aria-label="Question difficulty" />
      <div class="diff-scale"><span>Warm</span><span>Gentle</span><span>Party</span><span>Tricky</span><span>Spicy</span></div>
      <p class="small muted">${DIFF_BLURB[n]} Set it before you start. The room remembers it.</p></div>`;
  }

  function practiceRow() {
    const on = S.settings.practice;
    return `<div class="practice-row ${on ? 'on' : ''}"><span>🧪 <b>Practice questions ${on ? 'ON' : 'off'}</b> · <span class="small">${on ? 'Games use a super-easy stand-in set. Your real questions stay hidden, so practising with guests spoils nothing.' : 'Turns on automatically with the demo, or switch it on to practise with guests without bots.'}</span></span>
      <button class="btn small ${on ? 'ghost' : 'teal'}" data-a="practice" data-v="${on ? '0' : '1'}">${on ? 'Use real questions' : 'Turn on'}</button></div>`;
  }

  function tvCard() {
    const v = S.tv.view;
    const views = [['lobby', '🏠 Lobby / QR'], ['game', '🎮 Game'], ['leaderboard', '🏆 Standings'], ['teams', '🎲 Teams'], ['awards', '🎖️ Awards'], ['podium', '🥇 Podium']];
    return `<div class="card"><h3>📺 TV display</h3><div class="btn-row">${views.map(([k, l]) => `<button class="btn small ${v === k ? '' : 'ghost'}" data-a="tv" data-v="${k}">${l}</button>`).join('')}</div>
      ${v === 'awards' ? `<div class="sec-title">Diwali Awards ceremony</div><div class="awards-ctl"><button class="btn small ghost" data-a="award-step" data-d="-1">◀ Back</button>
        <span class="chip gold">${(S.tv.awardIndex || 0) === 0 ? 'Intro' : (S.tv.awardIndex || 0) > (S.awardsCount || 0) ? 'Champion 🪔' : `Award ${S.tv.awardIndex} of ${S.awardsCount}`}</span>
        <button class="btn small" data-a="award-step" data-d="1">Next award ▶</button><span class="small muted">Each award plays a drumroll, then reveals the winner. End on the champion, then Podium.</span></div>` : ''}
      <div class="sec-title">Big announcement</div>
      <div class="row"><input type="text" data-ui="annTitle" placeholder="Title (e.g. Dinner break!)" value="${esc(ui.annTitle)}" class="grow" style="flex:1 1 160px"/><input type="text" data-ui="annText" placeholder="Message" value="${esc(ui.annText)}" style="flex:2 1 200px"/><button class="btn small gold" data-a="announce">📣 Show</button></div>
      ${mediaHtml()}
      <div class="sec-title">Links</div>${linksHtml()}</div>`;
  }

  function mediaHtml() {
    const m = S.media;
    const now = m && !m.stopped
      ? `<div class="kv"><span>🎵 <b>${esc(m.label || 'Clip')}</b> <span class="small muted">from ${window.fmtTime(m.start || 0)}${m.end ? ' to ' + window.fmtTime(m.end) : ''} · ${m.show ? (S.live && S.live.type === 'hookstep' ? (S.live.phase === 'perform' && S.live.until > Date.now() ? 'blurred until the timer ends, then it keeps playing' : 'playing until you move on') : 'video showing') : 'audio only'}</span></span></div>
        <div class="btn-row" style="margin-top:8px"><button class="btn small" data-a="media" data-op="replay">↺ Replay from start</button><button class="btn small ghost" data-a="media" data-op="${m.show ? 'hide' : 'show'}">${m.show ? '🙈 Hide video' : '👁 Show video'}</button><button class="btn small red" data-a="media" data-op="stop">⏹ Stop</button></div>`
      : m && m.stopped ? `<div class="kv"><span>⏹ Stopped: ${esc(m.label || '')}</span><button class="btn small" data-a="media" data-op="replay">↺ Play again</button></div>`
      : '<p class="small muted" style="margin:4px 0">Nothing playing. Clips on questions, clues and songs start automatically.</p>';
    return `<div class="sec-title">🎵 Music & video on TV</div>${now}
      <div class="row" style="margin-top:8px"><input type="text" data-ui="djUrl" placeholder="Paste any YouTube link to play on the TV now" value="${esc(ui.djUrl || '')}" style="flex:1 1 220px"/><button class="btn small gold" data-a="media" data-op="dj">▶ Play</button></div>`;
  }

  function linksHtml() {
    const o = location.origin;
    const q = S.code ? '?room=' + encodeURIComponent(S.code) : '';
    // The TV key goes after "#", so it is never sent to a server, logged, or passed on as a referrer.
    const tv = q + (S.tvSecret ? '#tv=' + encodeURIComponent(S.tvSecret) : '');
    return `<div class="links stack">${[['Players join', o + '/play' + q], ['TV display', o + '/tv' + tv], ['Host', o + '/host' + q]].map(([l, u]) => `<div class="row"><span style="width:100px" class="small muted">${l}</span><input type="text" readonly value="${esc(u)}" class="grow" style="flex:1"/><button class="btn small ghost" data-a="copy" data-u="${esc(u)}">Copy</button></div>`).join('')}</div>`;
  }

  function pendingCard() {
    if (!S.pending.length) return '';
    return `<div class="card pending"><h3>🔐 Verification codes</h3><p class="muted small" style="margin-top:0">${S.smsEnabled ? 'SMS is on. Codes for failed texts show here.' : 'No SMS provider configured — read these codes to your guests.'}</p>
      ${S.pending.map((p) => `<div class="kv" style="align-items:center"><span><b>${esc(p.name)}</b><br/><span class="small muted">${esc(p.phone)}</span></span>${p.code ? `<span class="code-pill">${p.code}</span>` : '<span class="chip">sent by SMS</span>'}</div>`).join('')}</div>`;
  }

  function awardCard() {
    return `<div class="card"><h3>🎁 Award points</h3>
      <select data-ui="awardTarget"><option value="">— pick player or team —</option>${entityOptions(ui.awardTarget)}</select>
      <div class="btn-row" style="margin:10px 0">${[50, 100, 200, 500, -50, -100].map((n) => `<button class="btn small ${n < 0 ? 'red' : 'green'}" data-a="award" data-n="${n}">${n > 0 ? '+' : ''}${n}</button>`).join('')}</div>
      <div class="row"><input type="number" data-ui="awardAmount" value="${esc(ui.awardAmount)}" style="width:100px"/><input type="text" data-ui="awardReason" placeholder="Reason (optional)" value="${esc(ui.awardReason)}" style="flex:1"/><button class="btn small" data-a="award">Give</button></div></div>`;
  }

  function feedCard() {
    return `<div class="card"><h3>📣 Activity</h3>${S.feed.slice(0, 10).map((f) => `<div class="feed-row">${esc(f.emoji || '✨')} ${esc(f.text)}</div>`).join('') || '<p class="muted">Quiet so far…</p>'}</div>`;
  }

  // ---------- quiz ----------
  function quizCtl(L) {
    const online = S.players.filter((p) => p.online).length;
    let body = `<p class="muted">Phase: <b>${L.phase}</b> · Question ${Math.max(0, L.qIndex + 1)} / ${L.total}</p>`;
    if (L.question) {
      body += `<div class="qbox">${L.question.personal ? '<span class="chip gold">✨ From guests\' answers</span>' : ''}${L.question.clue ? `<div style="font-size:28px">${esc(L.question.clue)}</div>` : ''}<div class="q">${esc(L.question.q)}</div><ol type="A">${L.question.options.map((o, i) => `<li class="${i === L.answerKey ? 'ok' : ''}">${esc(o)}${i === L.answerKey ? ' ✓' : ''}</li>`).join('')}</ol></div>`;
    }
    if (L.phase === 'question') {
      const ans = Object.keys(L.answersBy || {});
      body += `<p><b>${L.answered}</b> / ${online} online answered · <span data-count="${L.deadline}"></span>s left</p>
        <p class="small muted">Waiting on: ${S.players.filter((p) => p.online && !ans.includes(p.id)).map((p) => esc(p.name)).join(', ') || 'nobody'}</p>
        <button class="btn" data-g="reveal">⏩ Reveal now</button>`;
    } else if (L.phase === 'final') {
      body += `<p>🎉 All questions done.</p><button class="btn big red" data-a="end">🏁 End game & show leaderboard</button>`;
    } else {
      const last = L.qIndex + 1 >= L.total;
      body += `<button class="btn big" data-g="next">${L.phase === 'intro' ? '▶ First question' : last ? '🏁 Finish round' : '▶ Next question'}</button>`;
    }
    return body;
  }

  // ---------- jeopardy ----------
  function jeoCtl(L) {
    const who = L.turn ? `${esc(L.turn.emoji)} ${esc(L.turn.name)}` : 'Nobody yet';
    const turnSel = `<div class="row"><span class="small muted">Up now:</span><select data-a="setTurn" style="width:auto" ${L.phase === 'board' ? '' : 'disabled'}>${(L.mode === 'team' ? S.teams.map((t) => ['t:' + t.id, `${t.emoji} ${t.name}`]) : S.players.map((p) => ['p:' + p.id, `${p.avatar} ${p.name}`])).map(([k, l]) => opt(k, esc(l), L.turn ? L.turn.key : '')).join('')}</select></div>`;
    if (L.phase === 'board') {
      const cats = L.categories;
      const rows = Math.max(...cats.map((c) => c.clues.length));
      let cells = cats.map((c) => `<div class="jc">${esc(c.name)}</div>`).join('');
      for (let i = 0; i < rows; i++) cells += cats.map((c, ci) => c.clues[i] ? `<button data-g="pick" data-c="${ci}" data-i="${i}" ${c.clues[i].used ? 'disabled' : ''}>${c.clues[i].value}</button>` : '<span></span>').join('');
      return `<p class="muted"><b>${who}</b> is up. Tap the clue they call. A right answer pays <b>every person on that team</b>.</p>${turnSel}<div class="jgrid" style="grid-template-columns:repeat(${cats.length},1fr);margin-top:10px">${cells}</div>`;
    }
    const c = L.clue;
    return `<div class="qbox"><div class="small muted">${esc(c.category)} · ${fmt(c.value)} · ${who}</div><div class="q">${esc(c.q)}</div></div>
      <div class="answer-key">Answer: ${esc(c.a)}</div>
      <p class="small muted">They answer out loud. Correct gives ${fmt(c.value)} to each teammate.</p>
      ${L.phase === 'clue' ? `<div class="btn-row" style="margin-top:12px">
        <button class="btn green" data-g="correct">✓ Correct — pay the team</button>
        <button class="btn red" data-g="wrong">✗ Wrong</button>
        <button class="btn ghost" data-g="reveal">Reveal (no points)</button></div>`
      : `<p>${L.last && L.last.correct ? `<b>+${fmt(L.last.value)} each</b> for ${esc(L.last.info.name)}.` : `${esc(L.last && L.last.info ? L.last.info.name : 'They')} missed it.`}</p>
        <div class="btn-row" style="margin-top:12px"><button class="btn big" data-g="board">↩ Next team</button></div>`}`;
  }

  // ---------- KBC ----------
  function kbcCtl(L) {
    if (L.phase === 'idle') return `<p class="muted">Solo round. Every question is open to the whole room. Fastest correct answer gets the full points, and each place after gets less.</p><button class="btn big" data-g="next">▶ First question</button>`;
    if (L.phase === 'done') return `<p>That was the last question.</p><button class="btn big red" data-a="end">🏁 End game & show leaderboard</button>`;
    const q = L.question;
    const n = `${L.qIndex + 1} / ${L.total}`;
    if (L.phase === 'question') {
      return `<p>Q${n} · full value <b>${fmt(L.points)}</b> · <b>${L.answered}</b> answered · <span data-count="${L.deadline}"></span>s</p>
        <div class="qbox">${q.personal ? '<span class="chip gold">✨ From guests\' answers</span>' : ''}<div class="q">${esc(q.q)}</div><ol type="A">${q.options.map((o, i) => `<li class="${i === L.answerKey ? 'ok' : ''}">${esc(o)}${i === L.answerKey ? ' ✓' : ''}</li>`).join('')}</ol></div>
        <button class="btn" data-g="reveal">⏩ Reveal now</button>`;
    }
    const rows = (L.result && L.result.ranking || []).map((r) => `<div class="kv"><span>${r.rank}. ${pname(r.id)}</span><b>+${fmt(r.points)}</b></div>`).join('') || '<p class="muted">Nobody got it right.</p>';
    const last = L.qIndex + 1 >= L.total;
    return `<p>Q${n} · answer <b>${letters[L.result.answer]}</b></p>${rows}
      <button class="btn big" data-g="next" style="margin-top:12px">${last ? '🏁 Finish round' : '▶ Next question'}</button>`;
  }

  // ---------- hook step ----------
  function hookCtl(L) {
    const perf = L.perf;
    const teamSel = L.mode === 'team'
      ? `<select data-ui="hookTeam" style="width:auto">${S.teams.map((t) => opt('t:' + t.id, `${esc(t.emoji)} ${esc(t.name)}`, ui.hookTeam || (perf && perf.team ? perf.team.key : ''))).join('')}</select>` : '<span class="chip">Open floor (solo mode)</span>';
    const songSel = `<select data-ui="song" style="flex:1"><option value="">🎰 Random — spin on the TV</option>${L.songs.map((x, i) => opt(i, esc(x), ui.song)).join('')}</select>`;
    const hintBtn = `<button class="btn small ${L.showStep ? 'gold' : 'ghost'}" data-g="showStep">${L.showStep ? 'Dance hint is on the TV' : 'Show dance hint on the TV'}</button>`;
    let body = `<div class="steps"><div class="step-row"><span class="step-n">1</span><b>Call a team up</b></div>
      <div class="row">${teamSel}${songSel}<button class="btn" data-a="hookSetup">📣 Call them up</button>${hintBtn}</div>`;
    if (!perf) return body + resultsHtml(L) + '</div>';
    const phase = L.phase;
    const team = perf.team;
    body += `<div class="step-row"><span class="step-n">2</span><b>Song</b><span class="muted small">${perf.song ? `🎵 ${esc(perf.song.title)} — ${esc(perf.song.step)}` : phase === 'spin' ? 'spinning…' : 'none yet'}</span></div>
      <div class="btn-row">${!perf.song ? '<button class="btn gold" data-g="spin">🎰 Spin a song on the TV</button>' : '<button class="btn small ghost" data-g="spin">🎰 Re-spin</button>'}
        <button class="btn" data-g="perform" ${perf.song && phase === 'ready' ? '' : 'disabled'}>▶ Start the dance (music plays)</button>
        ${phase === 'perform' ? '<button class="btn ghost" data-g="stop">▶ Next — judge the dance</button>' : ''}</div>
      <div class="step-row"><span class="step-n">3</span><b>Tap everyone who's dancing</b><span class="muted small">+${L.bonus} Himmat bonus each</span></div>
      <div class="dancer-grid">${S.players.map((p) => { const on = perf.dancers.some((d) => d.id === p.id); const mine = team && p.teamId && 't:' + p.teamId === team.key; return `<button class="dz ${on ? 'on' : ''} ${mine ? 'team' : ''}" data-g="dancer" data-pid="${p.id}"><span class="avatar" style="--c:${p.color}">${esc(p.avatar)}</span>${esc(p.name)}</button>`; }).join('')}</div>
      <div class="step-row"><span class="step-n">4</span><b>Rate it</b><span class="muted small">${team ? 'team gets 100 per diya + crowd bonus' : 'each dancer gets 100 per diya + crowd'}</span></div>
      <div class="row"><div class="rate">${[1, 2, 3, 4, 5].map((n) => `<button class="${perf.stars >= n ? 'on' : ''}" data-g="rate" data-stars="${n}">🪔</button>`).join('')}</div>
        <button class="btn small teal" data-g="measure">🎤 Applause-o-meter (TV mic)</button>
        <span class="small">Crowd: <b>${perf.applause != null ? perf.applause : '—'}</b>/100</span>
        <input type="number" data-ui="applause" placeholder="or type 0–100" value="${esc(ui.applause || '')}" style="width:130px"/><button class="btn small ghost" data-a="applauseSet">Set</button></div>
      <div class="btn-row" style="margin-top:12px"><button class="btn big green" data-g="score" ${perf.stars && ['perform', 'judge'].includes(phase) ? '' : 'disabled'}>🏅 Award ${perf.stars ? `+${perf.stars * 100 + Math.round((perf.applause || 0) * 2)}` : ''} ${team ? `to ${esc(team.name)}` : ''} + ${L.bonus} × ${perf.dancers.length} dancers</button></div>`;
    return body + resultsHtml(L) + '</div>';
  }
  function resultsHtml(L) {
    return L.results.length ? `<div class="sec-title">Results</div>${L.results.map((r) => `<div class="kv"><span>${r.team ? `${esc(r.team.emoji)} ${esc(r.team.name)}` : 'Open floor'} · <span class="muted small">${esc(r.song)} · ${r.dancers.length} dancers</span></span><b>+${r.teamPoints}</b></div>`).join('')}` : '';
  }

  // ================= GAMES TAB =================
  function gamesTab() {
    const typeNames = { quiz: 'Quiz (Kahoot / Guess the Movie)', jeopardy: 'Jeopardy', kbc: 'KBC', hookstep: 'Hook Step', custom: 'Custom (host-scored)' };
    return `<div class="hgrid"><div><div class="card"><h3>🗂 Game lineup</h3>
      ${S.games.map((g, i) => `<div class="game-row ${g.status === 'live' ? 'live' : ''}"><span class="em">${esc(g.emoji)}</span><div class="grow"><div class="nm">${esc(g.title)}</div><div class="small muted">${typeNames[g.type]}</div></div>
        ${g.type === 'kbc' ? '<span class="chip">👤 Solo</span>' : `<select data-a="mode" data-id="${g.id}" style="width:auto" ${g.status === 'live' ? 'disabled' : ''}>${opt('individual', '👤 Solo', g.mode)}${opt('team', '👥 Teams', g.mode)}</select>`}
        <span class="chip ${g.status === 'live' ? 'live' : g.status === 'done' ? 'done' : ''}">${g.status}</span>
        <div class="btn-row">
          ${g.status === 'live' ? '<button class="btn small red" data-a="end">End</button>' : `<button class="btn small" data-a="start" data-id="${g.id}">${g.status === 'done' ? 'Replay' : 'Start'}</button>`}
          <button class="btn small ghost" data-a="edit" data-id="${g.id}">✏️ Edit questions</button>
          <button class="btn small ghost" data-a="json" data-id="${g.id}" title="Edit as JSON">{ }</button>
          <button class="btn small ghost" data-a="move" data-id="${g.id}" data-d="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn small ghost" data-a="move" data-id="${g.id}" data-d="1" ${i === S.games.length - 1 ? 'disabled' : ''}>↓</button>
          ${g.status === 'done' ? `<button class="btn small ghost" data-a="resetGame" data-id="${g.id}">↺</button>` : ''}
        </div></div>`).join('')}
      </div></div>
      <div><div class="card"><h3>➕ Add a game</h3><div class="stack">
        <input type="text" data-ui="newTitle" placeholder="Title, e.g. Antakshari" value="${esc(ui.newTitle)}"/>
        <select data-ui="newType">${Object.entries(typeNames).map(([k, l]) => opt(k, l, ui.newType)).join('')}</select>
        <select data-ui="newMode">${opt('individual', '👤 Solo', ui.newMode)}${opt('team', '👥 Teams', ui.newMode)}</select>
        <button class="btn" data-a="addGame">Add game</button>
        <p class="small muted">New games start with sample content — edit it with ✏️. "Custom" games are for anything you score by hand (Antakshari, Tambola, Dumb Charades…).</p></div></div></div></div>`;
  }

  function editModal(gid) {
    const g = S.gamesFull.find((x) => x.id === gid);
    if (!g) return;
    const help = {
      quiz: 'questions: [{ q, options: [4 strings], answer: index 0–3, time: seconds, clue?: "emoji clue", image?: "https://…" }]',
      jeopardy: 'categories: [{ name, clues: [{ value, q, a }] }]',
      kbc: 'ladder: [{ points, questions: [{ q, options, answer, time? }] }]',
      hookstep: 'songs: [{ title, step }], performSeconds, votingSeconds',
      custom: 'description: "Shown on the TV"',
    }[g.type];
    modal.innerHTML = `<div class="modal"><div class="sheet stack"><h3>✏️ ${esc(g.emoji)} ${esc(g.title)}</h3>
      <div class="row"><div style="width:90px"><label class="field">Emoji</label><input type="text" id="eEmoji" value="${esc(g.emoji)}"/></div><div class="grow"><label class="field">Title</label><input type="text" id="eTitle" value="${esc(g.title)}"/></div></div>
      <div><label class="field">Content (JSON) — ${esc(help)}</label><textarea id="eContent" spellcheck="false">${esc(JSON.stringify(g.content, null, 2))}</textarea></div>
      <div class="row"><button class="btn ghost" id="eDelete">🗑 Delete game</button><span class="grow"></span><button class="btn ghost" id="eCancel">Cancel</button><button class="btn" id="eSave">Save</button></div></div></div>`;
    const close = () => { modal.innerHTML = ''; };
    modal.querySelector('#eCancel').onclick = close;
    modal.querySelector('#eDelete').onclick = () => { if (confirm(`Delete "${g.title}"?`)) { act({ type: 'deleteGame', gameId: g.id }, 'Deleted'); close(); } };
    modal.querySelector('#eSave').onclick = () => {
      let content;
      try { content = JSON.parse(modal.querySelector('#eContent').value); } catch (e) { App.toast('JSON error: ' + e.message, true); return; }
      sock.emit('host', { type: 'editGame', gameId: g.id, title: modal.querySelector('#eTitle').value, emoji: modal.querySelector('#eEmoji').value, content }, (r) => {
        if (r && r.error) App.toast(r.error, true); else { App.toast('Saved ✓'); close(); }
      });
    };
  }

  // ================= PLAYERS TAB =================
  function playersTab() {
    const detail = Object.fromEntries(S.playersDetail.map((d) => [d.id, d]));
    const teamOpts = (sel) => `<option value="">—</option>${S.teams.map((t) => opt(t.id, `${esc(t.emoji)} ${esc(t.name)}`, sel)).join('')}`;
    const rows = S.players.map((p) => {
      const d = detail[p.id] || { powerups: [] };
      return `<tr><td>${p.rank}</td><td><span class="avatar" style="--c:${p.color};width:30px;height:30px;font-size:17px">${esc(p.avatar)}</span> <b>${esc(p.name)}</b> ${d.bot ? '<span class="chip gold">🤖 bot</span>' : p.online ? '<span class="chip done">online</span>' : '<span class="chip">offline</span>'}</td>
        <td class="small muted">${esc(d.phone)}</td>
        <td>${S.teams.length ? `<select data-a="setTeam" data-id="${p.id}">${teamOpts(p.teamId)}</select>` : '—'}</td>
        <td><b>${fmt(p.score)}</b></td>
        <td>${d.powerups.map((u) => `<span class="pu-mini ${u.used ? 'used' : ''}" title="${esc(S.powerupDefs[u.type].name)}${u.used ? ' (used)' : ''}">${S.powerupDefs[u.type].emoji}</span>`).join(' ')}${d.doublePending || d.doubleArmed ? ' <span class="chip gold">×2 next</span>' : ''}</td>
        <td><div class="btn-row"><button class="btn small ghost" data-a="rename" data-id="${p.id}">✏️</button><button class="btn small ghost" data-a="redeal" data-id="${p.id}" title="Re-deal power-ups">🎁</button><button class="btn small ghost" data-a="remove" data-id="${p.id}">🗑</button></div></td></tr>`;
    }).join('');
    return `<div class="hgrid"><div>${pendingCard()}<div class="card"><h3>👥 Players (${S.players.length})</h3><div class="scroll-x"><table class="tbl"><thead><tr><th>#</th><th>Player</th><th>Phone</th><th>Team</th><th>Score</th><th>Power-ups</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="muted">No one yet — put the TV on the lobby so guests can scan the QR.</td></tr>'}</tbody></table></div></div></div>
      <div><div class="card"><h3>🎲 Teams</h3>
        <div class="row"><select data-ui="teamCount" style="width:auto">${[2, 3, 4, 5, 6].map((n) => opt(n, `${n} teams`, ui.teamCount)).join('')}</select><button class="btn" data-a="makeTeams">${S.teams.length ? 'Reshuffle' : 'Make teams'}</button>${S.teams.length ? '<button class="btn ghost small" data-a="clearTeams">Clear</button>' : ''}</div>
        <p class="small muted">Teams are balanced by current score. Late joiners go to the smallest team. Change anyone's team in the table.</p>
        ${S.teams.map((t) => `<div class="kv"><span>${esc(t.emoji)} <b>${esc(t.name)}</b> <span class="small muted">${t.members.length} players</span></span><span><b>${fmt(t.total)}</b> <span class="small muted">avg</span> <button class="btn small ghost" data-a="renameTeam" data-id="${t.id}">✏️</button></span></div>`).join('')}
        ${S.teams.length ? '<button class="btn small gold" style="margin-top:10px" data-a="tv" data-v="teams">📺 Show teams on TV</button>' : ''}
      </div>
      <div class="card"><h3>🎁 Power-ups</h3><p class="small muted">${Object.values(S.powerupDefs).map((d) => `${d.emoji} <b>${esc(d.name)}</b>: ${esc(d.desc)}`).join('<br/>')}</p>
        <button class="btn small" data-a="redealAll">Re-deal everyone's power-ups</button></div></div></div>${answersCard()}`;
  }

  function answersCard() {
    const prompts = S.questionnaire;
    const rows = S.players.map((p) => {
      const a = (S.answers.find((x) => x.id === p.id) || { answers: {} }).answers;
      const n = prompts.filter((q) => a[q.id]).length;
      return `<details class="ans-row"><summary><span>${esc(p.avatar)} <b>${esc(p.name)}</b></span><span class="chip ${n ? 'done' : ''}">${n}/${prompts.length} answered</span></summary>
        ${n ? prompts.filter((q) => a[q.id]).map((q) => `<div class="kv"><span><span class="small muted">${esc(q.text)}</span><br/>${esc(q.type === 'pick' || q.type === 'vote' ? `${q.type === 'vote' ? '🗳️ ' : '👉 '}${(player(a[q.id]) || { name: '(guest left)' }).name}` : a[q.id])}</span><button class="btn small ghost" data-a="clearAnswer" data-id="${p.id}" data-q="${q.id}" title="Delete this answer">🗑</button></div>`).join('') : '<p class="small muted">No answers yet.</p>'}</details>`;
    }).join('');
    return `<div class="card" style="margin-top:14px"><h3>📝 "About me" answers <span class="chip ${S.settings.questionnaireOpen ? 'done' : ''}">${S.settings.questionnaireOpen ? 'open' : 'closed'}</span></h3>
      <p class="small muted" style="margin-top:0">These become personalised game questions (see ✏️ Questions → ✨ Personalised questions). Delete anything you don't want shown on the TV.</p>${rows || '<p class="muted">No guests yet.</p>'}</div>`;
  }

  // ================= SCORES TAB =================
  function scoresTab() {
    const st = S.settings;
    return `<div class="hgrid"><div><div class="card"><h3>📊 Points log</h3><div class="scroll-x"><table class="tbl"><thead><tr><th>Time</th><th>Player</th><th>Points</th><th>Reason</th><th></th></tr></thead><tbody>
      ${S.ledger.map((e) => `<tr><td class="small muted">${new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td>${pname(e.playerId)}</td><td><b style="color:${e.amount > 0 ? '#16a34a' : '#dc2626'}">${e.amount > 0 ? '+' : ''}${e.amount}</b></td><td class="small">${esc(e.reason)}</td><td><button class="btn small ghost" data-a="undo" data-id="${e.id}" title="Undo">↶</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No points yet.</td></tr>'}
      </tbody></table></div></div></div>
      <div><div class="card stack"><h3>⚙️ Settings</h3>
        <div><label class="field">Event name</label><input type="text" id="sName" value="${esc(st.eventName)}"/></div>
        <label class="toggle"><input type="checkbox" id="sPU" ${st.powerupsEnabled ? 'checked' : ''}/> Power-ups enabled</label>
        <div class="row"><div class="grow"><label class="field">Steal amount</label><input type="number" id="sSteal" value="${st.stealAmount}"/></div><div class="grow"><label class="field">Swap cap</label><input type="number" id="sSwap" value="${st.swapCap}"/></div></div>
        <button class="btn" data-a="saveSettings">Save settings</button>
        <p class="small muted">Phone codes: ${S.smsEnabled ? '✅ sent by SMS (Twilio)' : '🪔 shown to you (host relay). Add Twilio env vars to text them.'}</p></div>
        <div class="card stack"><h3>🧨 Danger zone</h3>
          <button class="btn ghost" data-a="resetScores">Reset scores & games (keep players)</button>
          <button class="btn red" data-a="resetAll">Wipe everything</button>
          <button class="btn ghost small" data-a="logout">Log out of host</button></div></div></div>`;
  }

  // ---------- events ----------
  app.addEventListener('input', (e) => {
    if (e.target.dataset && e.target.dataset.a === 'difficulty') {
      const n = Number(e.target.value);
      const box = e.target.closest('.diff');
      if (box) { const b = box.querySelector('b'); if (b) b.textContent = DIFF_NAMES[n] || ''; const p = box.querySelector('p'); if (p) p.textContent = (DIFF_BLURB[n] || '') + ' Set it before you start. The room remembers it.'; }
      e.target.setAttribute('aria-valuenow', String(n));
      return;
    }
    if (e.target.dataset && e.target.dataset.eg && !/radio|checkbox/.test(e.target.type) && e.target.tagName !== 'SELECT') { editor.onInput(e); return; }
    const k = e.target.dataset && e.target.dataset.ui; if (k) ui[k] = e.target.value;
  });
  app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.eg) { if (/radio|checkbox/.test(t.type) || t.tagName === 'SELECT') editor.onInput(e); return; }
    if (t.dataset.a === 'difficulty') { act({ type: 'settings', difficulty: Number(t.value) }); return; }
    if (t.dataset.ui) { ui[t.dataset.ui] = t.value; render(); return; }
    if (t.dataset.a === 'mode') act({ type: 'editGame', gameId: t.dataset.id, mode: t.value });
    if (t.dataset.a === 'setTurn') gameAct({ type: 'setTurn', key: t.value });
    if (t.dataset.a === 'setTeam') act({ type: 'setTeam', playerId: t.dataset.id, teamId: t.value });
  });

  app.addEventListener('click', (e) => {
    const tb = e.target.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; store.set('dgn_host_tab', tab); render(true); return; }
    if (editor.onClick(e)) return;
    const g = e.target.closest('[data-g]');
    if (g) {
      const a = { type: g.dataset.g };
      if (g.dataset.c != null) { a.c = Number(g.dataset.c); }
      if (g.dataset.i != null) { a.i = Number(g.dataset.i); a.choice = Number(g.dataset.i); }
      if (g.dataset.name) a.name = g.dataset.name;
      if (g.dataset.pid) a.pid = g.dataset.pid;
      if (g.dataset.stars) a.stars = Number(g.dataset.stars);
      return gameAct(a);
    }
    const b = e.target.closest('[data-a]');
    if (!b || b.tagName === 'SELECT') return;
    const id = b.dataset.id;
    switch (b.dataset.a) {
      case 'start': act({ type: 'startGame', gameId: id }); break;
      case 'end': if (confirm('End this game and show the leaderboard?')) act({ type: 'endGame' }); break;
      case 'practice': act({ type: 'settings', practice: b.dataset.v === '1' }, b.dataset.v === '1' ? 'Practice questions on 🧪' : 'Real questions are back'); break;
      case 'cue': if (window._cue && window._cue.run) window._cue.run(); break;
      case 'demoStart': act({ type: 'demoStart', count: Number(ui.demoCount || 8) }, 'Bots joined! 🤖'); break;
      case 'demoEnd': if (confirm('Remove all bots and reset every score, game and power-up? Real guests stay logged in.')) act({ type: 'demoEnd' }, 'Demo over: everything reset ✨'); break;
      case 'tv': act({ type: 'tv', view: b.dataset.v }); break;
      case 'award-step': act({ type: 'award-step', dir: Number(b.dataset.d) }); break;
      case 'announce': if (!ui.annTitle && !ui.annText) return App.toast('Write a title or message', true);
        act({ type: 'announce', title: ui.annTitle || '📣', text: ui.annText }, 'On the TV!'); ui.annTitle = ''; ui.annText = ''; app.querySelectorAll('[data-ui=annTitle],[data-ui=annText]').forEach((x) => { x.value = ''; }); break;
      case 'media': {
        const op = b.dataset.op;
        if (op === 'dj' && !ui.djUrl) return App.toast('Paste a YouTube link first', true);
        act({ type: 'media', op, url: ui.djUrl }, op === 'dj' ? 'Playing on the TV 🎵' : null);
        if (op === 'dj') { ui.djUrl = ''; const inp = app.querySelector('[data-ui=djUrl]'); if (inp) inp.value = ''; }
        break;
      }
      case 'clearAnswer': act({ type: 'clearAnswer', playerId: id, promptId: b.dataset.q }); break;
      case 'copy': navigator.clipboard && navigator.clipboard.writeText(b.dataset.u).then(() => App.toast('Copied!')); break;
      case 'copyCode': if (S && S.code && navigator.clipboard) navigator.clipboard.writeText(S.code).then(() => App.toast('Room code copied')); break;
      case 'award': {
        if (!ui.awardTarget) return App.toast('Pick a player or team first', true);
        const n = b.dataset.n ? Number(b.dataset.n) : Number(ui.awardAmount);
        act({ type: 'award', target: ui.awardTarget, amount: n, reason: ui.awardReason }, `${n > 0 ? '+' : ''}${n} awarded`);
        break;
      }
      case 'seatPick': if (!ui.seat) return App.toast('Pick a player', true); gameAct({ type: 'seat', playerId: ui.seat }); break;
      case 'hookSetup': gameAct({ type: 'setup', team: S.live.mode === 'team' ? (ui.hookTeam || (S.teams[0] && 't:' + S.teams[0].id)) : null, songIndex: ui.song }); break;
      case 'applauseSet': gameAct({ type: 'applause', level: Number(ui.applause) }); break;
      case 'wagerSet': ui.wager = b.dataset.v; render(true); break;
      case 'wager': gameAct({ type: 'wager', amount: Number(ui.wager || 500) }); ui.wager = ''; break;
      case 'hookSetupOld': if (!ui.performer && !(S.live.perf)) return App.toast('Pick a performer', true);
        gameAct({ type: 'setup', performer: ui.performer || S.live.perf.performer.key, songIndex: ui.song }); break;
      case 'hookScore': gameAct({ type: 'score', judge: Number(ui.judge) }); ui.performer = ''; ui.song = ''; break;
      case 'edit': tab = 'questions'; store.set('dgn_host_tab', tab); render(true); setTimeout(() => { const el = document.getElementById('ed-' + id); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 50); break;
      case 'json': editModal(id); break;
      case 'move': act({ type: 'moveGame', gameId: id, dir: Number(b.dataset.d) }); break;
      case 'resetGame': act({ type: 'resetGame', gameId: id }); break;
      case 'addGame': act({ type: 'addGame', gameType: ui.newType, title: ui.newTitle || 'New Game', mode: ui.newMode }, 'Game added'); ui.newTitle = ''; break;
      case 'makeTeams': if (!S.teams.length || confirm('Reshuffle all teams?')) act({ type: 'makeTeams', count: Number(ui.teamCount) }, 'Teams ready!'); break;
      case 'clearTeams': if (confirm('Remove all teams?')) act({ type: 'clearTeams' }); break;
      case 'renameTeam': { const t = S.teams.find((x) => x.id === id); const n = prompt('Team name', t ? t.name : ''); if (n) act({ type: 'renameTeam', teamId: id, name: n }); break; }
      case 'rename': { const p = player(id); const n = prompt('Player name', p ? p.name : ''); if (n) act({ type: 'renamePlayer', playerId: id, name: n }); break; }
      case 'remove': { const p = player(id); if (confirm(`Remove ${p ? p.name : 'player'} and their points?`)) act({ type: 'removePlayer', playerId: id }); break; }
      case 'redeal': if (confirm('Give this player fresh power-ups?')) act({ type: 'redeal', playerId: id }, 'Re-dealt'); break;
      case 'redealAll': if (confirm('Re-deal power-ups for EVERYONE?')) act({ type: 'redeal' }, 'Re-dealt'); break;
      case 'undo': if (confirm('Undo this points entry?')) act({ type: 'undo', entryId: id }); break;
      case 'saveSettings': act({ type: 'settings', eventName: document.getElementById('sName').value, powerupsEnabled: document.getElementById('sPU').checked, stealAmount: document.getElementById('sSteal').value, swapCap: document.getElementById('sSwap').value }, 'Saved ✓'); break;
      case 'resetScores': if (confirm('Reset ALL scores, games and power-ups? Players stay logged in.')) act({ type: 'resetScores' }, 'Reset done'); break;
      case 'resetAll': if (prompt('Type WIPE to delete all players, scores and edits') === 'WIPE') act({ type: 'resetAll' }, 'Wiped'); break;
      case 'logout': store.del('dgn_host'); store.del('dgn_host_session'); location.href = '/host'; break;
      default:
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || tab !== 'live' || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName)) return;
    e.preventDefault();
    if (window._cue && window._cue.run && !window._cue.disabled) { window._cue.run(); App.toast(window._cue.label); }
  });

  const saved = session();
  const asked = App.roomFromQuery();
  if (saved && saved.token && saved.code && (!asked || asked === saved.code)) {
    App.room = saved.code;
    if (asked !== saved.code) history.replaceState(null, '', '/host?room=' + saved.code);
    start(saved.token);
  } else loginView();
})();
