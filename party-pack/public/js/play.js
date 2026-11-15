/* The whole party on a phone: create or join a room, lobby, profile, every game, standings,
   awards. The TV is optional; everything here is playable on its own. */
(function () {
  const app = document.getElementById('app');
  const dock = document.getElementById('dock');
  const modal = document.getElementById('modal');
  const esc = App.esc, fmt = App.fmt;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };
  const AVATARS = ['🪔', '🎆', '🐘', '🦚', '🐯', '🌺', '🪷', '🍬', '🎇', '🥭', '🌶️', '🦁', '🐒', '👑', '🪁', '🍵', '🌙', '⭐'];
  const REACTS = ['🔥', '😂', '👏', '😱', '💃', '🪔'];
  let S = null, sock = null, momentKey = '', draft = null;
  const ui = { avatar: store.get('dgn_avatar') || '🪔', name: store.get('dgn_name') || '', email: store.get('dgn_email') || '' };

  const av = (p) => `<span class="avatar" style="--c:${p.color || '#F2A33A'}">${esc(p.avatar || p.emoji || '🪔')}</span>`;
  const shape = (i) => `<span class="shape-ic">${App.shapes[i]}</span>`;
  const timer = (s, e) => `<div class="timer" data-start="${s}" data-end="${e}"><i></i></div>`;
  const center = (em, title, sub = '', extra = '') => `<div class="watch"><div class="watch-em">${em}</div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}${extra}</div>`;
  const send = (action, cb) => sock && sock.emit('player', action, (r) => { if (r && r.error) { App.toast(r.error, true); App.vibrate(120); } else if (cb) cb(); });
  const game = (action, cb) => send({ type: 'game', action }, cb);
  const me = () => S.me;
  const isHost = () => S && S.me && S.me.host;

  // =================== HOME: create / join / rejoin ===================
  function home(mode = new URLSearchParams(location.search).get('room') ? 'join' : 'start') {
    dock.innerHTML = '';
    const room = App.canonRoom(new URLSearchParams(location.search).get('room')) || App.canonRoom(store.get('dgn_room')) || '';
    const avatars = `<div class="avatars">${AVATARS.map((a) => `<button type="button" data-av="${a}" class="${a === ui.avatar ? 'on' : ''}" aria-label="Avatar ${a}">${a}</button>`).join('')}</div>`;
    const who = `<input id="name" maxlength="20" placeholder="Your name" aria-label="Your name" value="${esc(ui.name)}" autocomplete="given-name" />
      <input id="email" type="email" inputmode="email" placeholder="Email (for your rejoin code)" aria-label="Email" value="${esc(ui.email)}" autocomplete="email" />
      <label class="field">Pick your avatar</label>${avatars}`;
    let body = '';
    if (mode === 'start') {
      body = `<div class="stack">
        <button class="btn diya-btn big block" data-go="create">${App.diya(true, 28)} Create a room</button>
        <button class="btn ghost big block" data-go="join">Join a room</button>
        <button class="linkish" data-go="rejoin">Got disconnected? Rejoin</button></div>`;
    } else if (mode === 'create') {
      body = `<form class="card stack" id="f"><h3>Create a room</h3><p class="muted small" style="margin:0">You’ll be the host — and you play too.</p>${who}
        <button class="btn diya-btn big block" type="submit">${App.diya(true, 28)} Create</button></form><button class="linkish" data-go="start">Back</button>`;
    } else if (mode === 'join') {
      body = `<form class="card stack" id="f"><h3>Join a room</h3><input id="room" class="code-input" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="ABCD" aria-label="Room code" value="${esc(room)}" />${who}
        <button class="btn diya-btn big block" type="submit">${App.diya(true, 28)} Join</button></form><button class="linkish" data-go="start">Back</button>`;
    } else {
      body = `<form class="card stack" id="f"><h3>Rejoin</h3><p class="muted small" style="margin:0">Use the 4-digit code you saw when you joined (it was emailed too).</p>
        <input id="room" class="code-input" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="ABCD" aria-label="Room code" value="${esc(room)}" />
        <input id="email" type="email" inputmode="email" placeholder="Your email" aria-label="Email" value="${esc(ui.email)}" />
        <input id="pin" inputmode="numeric" maxlength="4" placeholder="Rejoin code" aria-label="Rejoin code" />
        <button class="btn diya-btn big block" type="submit">${App.diya(true, 28)} Rejoin</button></form><button class="linkish" data-go="start">Back</button>`;
    }
    app.innerHTML = `<div class="login"><div class="shell-card"><div class="breakout">${App.mascot()}</div><p class="greet">Happy Diwali</p><h1>Diwali Party</h1></div>${body}</div>`;
    app.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => home(b.dataset.go));
    app.querySelectorAll('[data-av]').forEach((b) => b.onclick = () => { ui.avatar = b.dataset.av; app.querySelectorAll('[data-av]').forEach((x) => x.classList.toggle('on', x === b)); });
    const f = app.querySelector('#f');
    if (!f) return;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const val = (id) => { const el = f.querySelector('#' + id); return el ? el.value.trim() : ''; };
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        if (mode === 'rejoin') {
          const r = App.canonRoom(val('room'));
          const out = await App.post('/api/rejoin', { room: r, email: val('email'), pin: val('pin') });
          store.set('dgn_email', val('email'));
          enter(r, out.token);
          return;
        }
        ui.name = val('name'); ui.email = val('email');
        if (!ui.name) throw new Error('Please tell us your name.');
        if (!ui.email) throw new Error('Add your email so you can rejoin if you get disconnected.');
        store.set('dgn_name', ui.name); store.set('dgn_email', ui.email); store.set('dgn_avatar', ui.avatar);
        const payload = { name: ui.name, email: ui.email, avatar: ui.avatar, origin: location.origin };
        if (mode === 'create') {
          const out = await App.post('/api/room/create', payload);
          showPin(out.code, out.token, out.pin, out.emailed);
        } else {
          const r = App.canonRoom(val('room'));
          if (!r) throw new Error('Enter the 4-character room code.');
          const out = await App.post('/api/join', { ...payload, room: r });
          showPin(r, out.token, out.pin, out.emailed);
        }
      } catch (err) { App.toast(err.message, true); btn.disabled = false; }
    };
  }

  // Shown once after joining: the code that gets you back in.
  function showPin(room, token, pin, emailed) {
    app.innerHTML = `<div class="login"><div class="shell-card slim"><p class="greet">You’re in! Your rejoin code</p><div class="pin-big">${esc(pin)}</div>
      <p class="muted">${emailed ? 'We emailed it to you too.' : 'Screenshot it — you’ll need it with your email if you get disconnected.'}</p>
      <button class="btn diya-btn big block" id="go">${App.diya(true, 28)} Let’s go</button></div></div>`;
    App.confetti(0.8);
    app.querySelector('#go').onclick = () => enter(room, token);
  }

  function enter(room, token) {
    App.room = room;
    store.set('dgn_room', room); store.set('dgn_token', token); store.set('dgn_token_room', room);
    history.replaceState(null, '', '/play?room=' + room);
    app.innerHTML = `<header class="ctl-head" id="hdr"></header><main class="moment-wrap"><div id="moment"><p class="greet">Lighting the diyas…</p></div></main>`;
    if (sock) sock.disconnect();
    sock = App.connect('player', token, (s) => { const first = !S; S = s; render(first); }, (msg) => {
      store.del('dgn_token'); store.del('dgn_token_room'); S = null;
      App.toast(msg || 'Please rejoin.', true);
      home('rejoin');
    });
  }

  // =================== RENDER ===================
  function render() {
    if (!S || !S.me) return;
    App.applyTheme(S);
    const [key, html, dockMode] = moment();
    header(key);
    const box = document.getElementById('moment');
    if (!box) return;
    if (key !== momentKey) {
      momentKey = key;
      box.classList.remove('m-enter'); void box.offsetWidth; box.classList.add('m-enter');
      App.patch(box, html, true);
      onMoment(key);
    } else App.patch(box, html);
    renderDock(dockMode);
    App.tickTimers && App.tickTimers();
  }

  function header() {
    const m = me();
    const t = m.teamId && S.teams.find((x) => x.id === m.teamId);
    const f = S.flow;
    const hostCtl = isHost() && ['game', 'standings', 'profile'].includes(f.stage)
      ? `<div class="host-ctl">${f.paused ? '<button class="btn small gold" data-host="resume">▶ Resume</button>' : '<button class="btn small ghost" data-host="pause">Pause</button>'}<button class="btn small ghost" data-host="skip">Skip</button></div>` : '';
    App.patch(document.getElementById('hdr'), `<div class="head-row">${av(m)}<div class="who"><b>${esc(m.name)}${m.host ? ' 👑' : ''}</b><span class="muted small">${t ? `${esc(t.emoji)} ${esc(t.name)} · ` : ''}Room ${esc(S.code)}</span></div>
      <div class="score-pill"><b>${fmt(m.score)}</b><small>pts</small></div>${hostCtl}</div>${f.paused ? '<div class="paused-bar">⏸ Paused by the host</div>' : ''}`);
  }

  // Returns [key, html, dockMode] for whatever is happening now.
  function moment() {
    const f = S.flow;
    if (f.stage === 'lobby') return lobby();
    if (f.stage === 'profile') return me().profiled ? ['profile-wait', center('⏳', 'Thanks!', `${f.profiled.filter((id) => S.players.some((p) => p.id === id)).length} of ${S.players.length} done. The first game starts when everyone’s ready.`), 'watch'] : profile();
    if (f.stage === 'standings') return standings();
    if (f.stage === 'awards' || f.stage === 'podium') return finale();
    const L = S.live;
    if (!L) return ['wait', center('🪔', 'Next game coming up…'), 'watch'];
    return ({ quiz: quizM, kbc: kbcM, jeopardy: jeoM, hookstep: hookM }[L.type] || (() => ['?', center('🎲', L.title), 'watch']))(L);
  }

  // =================== LOBBY ===================
  function lobby() {
    const f = S.flow;
    const ready = new Set(f.ready);
    const players = S.players.map((p) => `<div class="lobby-row ${ready.has(p.id) ? 'ready' : ''}">${av(p)}<span class="nm">${esc(p.name)}${p.id === f.hostId ? ' 👑' : ''}</span>
      <span class="st">${ready.has(p.id) ? '✓ Ready' : 'Not ready'}</span>${isHost() && p.id !== me().id ? `<button class="x" data-kick="${p.id}" aria-label="Remove ${esc(p.name)}">✕</button>` : ''}</div>`).join('');
    const iAmReady = ready.has(me().id);
    const waiting = S.players.filter((p) => !ready.has(p.id) && p.id !== f.hostId);
    const link = `${location.origin}/play?room=${S.code}`;
    let hostPanel = '';
    if (isHost()) {
      const chosen = f.order;
      const rows = f.catalog.map((g) => {
        const i = chosen.indexOf(g.id);
        return `<div class="game-row ${i >= 0 ? 'on' : ''}"><button class="tick" data-toggle="${g.id}" aria-label="Include ${esc(g.title)}">${i >= 0 ? i + 1 : ''}</button><span>${g.emoji} ${esc(g.title)}</span>
          ${i >= 0 ? `<button class="mv" data-up="${g.id}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>` : ''}</div>`;
      }).join('');
      const bots = S.players.filter((p) => !p.online && false).length;
      hostPanel = `<div class="card stack"><h3>🎮 Games</h3><p class="muted small" style="margin:0">Tap to include. Numbers show the order.</p>${rows}
        <div class="row" style="gap:8px"><button class="btn small ghost" data-host="addBots">🤖 Add practice bots</button><button class="btn small ghost" data-host="removeBots">Remove bots</button></div>
        <button class="btn diya-btn big block" data-host="start" ${waiting.length || S.players.length < 2 ? 'disabled' : ''}>${App.diya(true, 28)} Start the party</button>
        <p class="muted small center" style="margin:0">${S.players.length < 2 ? 'Waiting for at least one more player.' : waiting.length ? `Waiting on ${waiting.map((p) => esc(p.name)).join(', ')}` : 'Everyone’s ready!'}</p></div>`;
    }
    const html = `<div class="stack">
      <div class="card center"><div class="eyebrow">Room code</div><div class="room-big">${esc(S.code)}</div>
        <img class="qr" src="/api/qr.svg?u=${encodeURIComponent(link)}" alt="QR code to join" />
        <div class="row" style="gap:8px;justify-content:center"><button class="btn small ghost" data-share>🔗 Share link</button><button class="btn small ghost" data-tv>📺 Open on TV</button></div></div>
      ${isHost() ? '' : `<button class="btn ${iAmReady ? 'ghost' : 'diya-btn'} big block" data-ready="${iAmReady ? 'off' : 'on'}">${iAmReady ? '✓ Ready — tap to undo' : `${App.diya(true, 28)} I’m ready`}</button>`}
      <div class="card"><h3>Players (${S.players.length})</h3>${players}</div>
      ${hostPanel}
      ${isHost() ? '' : `<p class="muted center small">${esc(S.players.find((p) => p.id === f.hostId)?.name || 'The host')} starts the party when everyone’s ready.</p>`}
    </div>`;
    return ['lobby', html, 'watch'];
  }

  // =================== PROFILE ===================
  function profile() {
    const P = S.profile;
    if (!draft) draft = { age: '', interests: [], genres: [], answers: {} };
    const chips = (list, sel, attr) => list.map((x) => { const id = x.id || x; const lbl = x.label ? `${x.emoji} ${x.label}` : x; return `<button type="button" class="pick ${sel.includes(id) ? 'on' : ''}" data-${attr}="${esc(id)}">${esc(lbl)}</button>`; }).join('');
    const others = S.players.filter((p) => p.id !== me().id);
    const fun = P.prompts.map((q) => q.type === 'vote' || q.type === 'pick'
      ? `<label class="field">${esc(q.text)}</label><div class="picks">${others.map((p) => `<button type="button" class="pick ${draft.answers[q.id] === p.id ? 'on' : ''}" data-ans="${q.id}" data-val="${p.id}">${esc(p.avatar)} ${esc(p.name)}</button>`).join('')}</div>`
      : `<label class="field" for="q_${q.id}">${esc(q.text)}</label><input id="q_${q.id}" data-text="${q.id}" maxlength="60" placeholder="${esc(q.ph || '')}" value="${esc(draft.answers[q.id] || '')}" />`).join('');
    const html = `<div class="stack profile"><div><h2>Quick profile</h2><p class="muted" style="margin:4px 0 0">So the game picks questions you’ll love. 30 seconds.</p></div>
      <div class="card stack"><label class="field">Your age</label><div class="picks">${chips(P.ageBands, [draft.age], 'age')}</div>
      <label class="field">What are you into? (pick any)</label><div class="picks">${chips(P.topics, draft.interests, 'topic')}</div>
      <label class="field">Favourite movie genres</label><div class="picks">${chips(P.genres, draft.genres, 'genre')}</div></div>
      <div class="card stack"><h3>About you</h3><p class="muted small" style="margin:0">A few answers become questions about you. Skip any.</p>${fun}</div>
      <button class="btn diya-btn big block" data-profile-done>${App.diya(true, 28)} Done</button></div>`;
    return ['profile', html, 'none'];
  }

  // =================== QUIZ / KAHOOT / MOVIE ===================
  function pads(options, mine, hint, disabled) {
    return `<div class="opt-list">${options.map((o, i) => `<button class="opt-pad o${i} ${mine === i ? 'chosen' : ''} ${hint && hint.includes(i) ? 'gone' : ''}" data-answer="${i}" ${disabled || mine != null ? 'disabled' : ''}>${shape(i)}<span>${esc(o)}</span></button>`).join('')}</div>`;
  }
  function qCard(q, extra = '') {
    return `<div class="q-card">${q.clue ? `<div class="clue-big">${esc(q.clue)}</div>` : ''}${q.clue && /^guess the movie!?$/i.test(q.q) ? '' : `<div class="q-text">${esc(q.q)}</div>`}${extra}</div>`;
  }
  function quizM(L) {
    if (L.phase === 'intro') return ['q-intro', center(esc(L.emoji), esc(L.title), `${L.total} questions · faster answers score more${L.mode === 'team' ? ' · teams share their average' : ''}`), 'watch'];
    if (L.phase === 'final') return ['q-final', center('🎆', 'Round complete!', 'Standings coming up…'), 'watch'];
    const q = L.question;
    if (!q) return ['q-wait', center('⏳', 'Get ready…'), 'watch'];
    const m = L.mine || {};
    const waiting = App.now() < L.opensAt;
    if (waiting) setTimeout(render, L.opensAt - App.now() + 30);
    const head = `<div class="q-head"><span>Q${L.qIndex + 1} / ${L.total}${L.doubleDiya ? ' · ✨ ×2' : ''}</span>${L.phase === 'question' && !waiting ? `<b data-count="${L.deadline}"></b>` : ''}</div>${L.phase === 'question' && !waiting ? timer(L.opensAt, L.deadline) : ''}`;
    if (L.phase === 'question') {
      if (waiting) return [`q-get-${L.qIndex}`, head + qCard(q) + `<div class="countdown-big" data-count="${L.opensAt}"></div>`, 'none'];
      const hintPu = me().powerups.find((p) => p.type === 'hint' && !p.used);
      const hintBtn = hintPu && m.choice == null && !m.hint ? `<button class="hint-pill" data-pu="${hintPu.id}">✨ Phuljhari Hint — remove 2</button>` : '';
      return [`q-${L.qIndex}`, head + qCard(q) + pads(q.options, m.choice, m.hint) + (m.choice != null ? '<p class="center muted">Locked in! 🔒</p>' : hintBtn), 'none'];
    }
    const r = L.result || {};
    const right = m.choice === r.answer;
    const pts = m.points || 0;
    // In team games everyone gets the team's average, right or wrong, so say so.
    const teamPts = L.mode === 'team' && me().teamId && r.perTeam ? r.perTeam[me().teamId] || 0 : null;
    const base = m.choice == null ? '😴 No answer' : right ? (teamPts != null ? '✅ Right!' : `✅ +${pts}`) : '❌ Not this time';
    const verdict = `${base}${teamPts ? ` · team +${teamPts}` : ''}${m.bonus ? ` · 🔥 +${m.bonus}` : ''}`;
    return [`q-r-${L.qIndex}`, head + qCard(q, `<div class="answer-line">${shape(r.answer)} ${esc(q.options[r.answer])}</div>`) + `<div class="verdict ${right ? 'good' : 'bad'}">${verdict}</div>`, 'watch'];
  }

  // =================== KBC ===================
  function kbcM(L) {
    if (L.phase === 'idle') return ['k-intro', center('💰', 'Kaun Banega Crorepati', 'Everyone answers. Fastest right answer gets the full prize.'), 'watch'];
    if (L.phase === 'done') return ['k-done', center('🎆', 'That’s the last question!', 'Standings coming up…'), 'watch'];
    const q = L.question;
    if (!q) return ['k-wait', center('⏳', 'Next question…'), 'watch'];
    const m = L.mine || {};
    const waiting = App.now() < L.opensAt;
    if (waiting) setTimeout(render, L.opensAt - App.now() + 30);
    const head = `<div class="q-head"><span>Q${L.qIndex + 1} / ${L.total} · ${fmt(L.points)} for first</span>${L.phase === 'question' && !waiting ? `<b data-count="${L.deadline}"></b>` : ''}</div>${L.phase === 'question' && !waiting ? timer(L.opensAt, L.deadline) : ''}`;
    if (L.phase === 'question') {
      if (waiting) return [`k-get-${L.qIndex}`, head + qCard(q) + `<div class="countdown-big" data-count="${L.opensAt}"></div>`, 'none'];
      return [`k-${L.qIndex}`, head + qCard(q) + pads(q.options, m.choice) + (m.choice != null ? '<p class="center muted">Locked in! 🔒</p>' : ''), 'none'];
    }
    const r = L.result || {};
    const right = m.choice === r.answer;
    return [`k-r-${L.qIndex}`, head + qCard(q, `<div class="answer-line">${shape(r.answer)} ${esc(q.options[r.answer])}</div>`) + `<div class="verdict ${right ? 'good' : 'bad'}">${m.choice == null ? '😴 No answer' : right ? `✅ #${m.rank} · +${fmt(m.points)}` : '❌ Not this time'}</div>`, 'watch'];
  }

  // =================== JEOPARDY ===================
  function jeoM(L) {
    const m = L.mine || {};
    const turn = L.turn ? `${esc(L.turn.emoji)} ${esc(L.turn.name)}` : '';
    if (L.phase === 'board' || L.phase === 'done') {
      const canPick = L.phase === 'board' && m.up;
      const grid = `<div class="jgrid" style="grid-template-columns:repeat(${L.categories.length},1fr)">${L.categories.map((c) => `<div class="jcat">${esc(c.name)}</div>`).join('')}
        ${L.categories[0].clues.map((_, i) => L.categories.map((c, ci) => { const cl = c.clues[i]; return cl.used ? '<div class="jcell used">·</div>' : `<button class="jcell" data-pick="${ci}-${i}" ${canPick ? '' : 'disabled'}>${cl.value}</button>`; }).join('')).join('')}</div>`;
      const msg = L.phase === 'done' ? 'Board cleared!' : canPick ? '<b>Your pick!</b> Tap a clue' : `${turn} is picking…`;
      return [`j-board-${Object.keys(L.categories).length}-${L.turn ? L.turn.key : ''}-${L.phase}`, `<div class="q-head"><span>${msg}</span>${L.phase === 'board' ? `<b data-count="${L.pickUntil}"></b>` : ''}</div>${grid}`, 'watch'];
    }
    const c = L.clue;
    const waiting = App.now() < L.opensAt;
    if (waiting) setTimeout(render, L.opensAt - App.now() + 30);
    const head = `<div class="q-head"><span>${esc(c.category)} · ${c.value}</span>${L.phase === 'clue' && !waiting ? `<b data-count="${L.deadline}"></b>` : ''}</div>${L.phase === 'clue' && !waiting ? timer(L.opensAt, L.deadline) : ''}`;
    if (L.phase === 'clue') {
      if (waiting) return [`j-get-${L.cur.c}-${L.cur.i}`, head + qCard(c), 'none'];
      return [`j-${L.cur.c}-${L.cur.i}`, head + qCard(c) + pads(c.options, m.choice) + (m.choice != null ? '<p class="center muted">Locked in! 🔒</p>' : ''), 'none'];
    }
    const right = m.choice === c.answer;
    return [`j-r-${L.cur.c}-${L.cur.i}`, head + qCard(c, `<div class="answer-line">${shape(c.answer)} ${esc(c.a)}</div>`) + `<div class="verdict ${right ? 'good' : 'bad'}">${m.choice == null ? '😴 No answer' : right ? `✅ +${c.value}` : '❌ Not this time'}</div>`, 'watch'];
  }

  // =================== HOOK STEP ===================
  function hookM(L) {
    const p = L.perf;
    const m = L.mine || {};
    if (L.phase === 'idle') return ['h-intro', center('💃', 'Hook Step Challenge', 'Each team gets a song. Dance the hook step! Everyone else rates you 1–5 diyas.'), 'watch'];
    if (L.phase === 'done') return ['h-done', center('🎆', 'What a dance floor!', 'Standings coming up…'), 'watch'];
    if (!p) return ['h-wait', center('🎵', 'Next song…'), 'watch'];
    const team = p.team ? `${esc(p.team.emoji)} ${esc(p.team.name)}` : '';
    if (L.phase === 'ready') return [`h-ready-${L.results.length}`, m.onStage ? center('🕺', 'You’re up!', `${team} — get to the floor. The song starts in a moment.`) : center('👀', `${team} is up!`, 'Get ready to cheer.'), 'watch'];
    if (L.phase === 'perform') {
      const video = S.media && S.media.videoId ? `<div class="phone-video ${App.now() < L.until ? 'veiled' : ''}"><iframe src="https://www.youtube.com/embed/${esc(S.media.videoId)}?start=${S.media.start || 0}&autoplay=1&playsinline=1&controls=0&modestbranding=1" allow="autoplay; encrypted-media" title="Hook step song"></iframe></div>` : '';
      const btn = m.onStage ? (m.dancing ? '<div class="verdict good">💃 You’re dancing! +100 bonus</div>' : `<button class="btn diya-btn big block" data-dance>💃 I’m dancing! (+${L.bonus})</button>`) : '<p class="center muted">Cheer them on! Voting opens when the clock ends.</p>';
      return [`h-perf-${L.results.length}`, `<div class="q-head"><span>${team}</span><b data-count="${L.until}"></b></div>${video}${btn}`, m.onStage ? 'none' : 'watch'];
    }
    if (L.phase === 'judge') {
      const song = p.song ? `<p class="center">🎵 ${esc(p.song.title)}</p>` : '';
      if (m.onStage) return [`h-judge-${L.results.length}`, center('🙏', 'The room is rating you…', `${p.votes} vote${p.votes === 1 ? '' : 's'} in`, song), 'watch'];
      const stars = [1, 2, 3, 4, 5].map((n) => `<button class="star ${m.vote >= n ? 'on' : ''}" data-vote="${n}" ${m.vote ? 'disabled' : ''} aria-label="${n} diyas">🪔</button>`).join('');
      return [`h-judge-${L.results.length}-${m.vote || 0}`, `<div class="q-head"><span>Rate ${team}</span><b data-count="${L.until}"></b></div>${song}<div class="stars-row">${stars}</div>${m.vote ? '<p class="center muted">Thanks! Vote locked.</p>' : ''}`, 'watch'];
    }
    const last = L.last || {};
    return [`h-scored-${L.results.length}`, center('🏆', `${team}: ${'🪔'.repeat(last.stars || 0)}`, `+${last.teamPoints || 0} each${last.dancers && last.dancers.length ? ` · ${last.dancers.length} brave dancer${last.dancers.length > 1 ? 's' : ''} +${last.bonus}` : ''}`), 'watch'];
  }

  // =================== BETWEEN GAMES / FINALE ===================
  function board(list) {
    return `<div class="lb-mini-list">${list.map((p) => `<div class="lb-mini ${p.id === me().id ? 'me' : ''}"><b class="rk">#${p.rank}</b>${av(p)}<span>${esc(p.name)}</span><em>${fmt(p.score)}</em></div>`).join('')}</div>`;
  }
  function standings() {
    const f = S.flow;
    const next = f.catalog.find((g) => g.id === f.order[f.idx + 1]);
    const teams = S.teams.length ? `<div class="teams-mini">${S.teams.map((t) => `<span style="--tc:${t.color}">${esc(t.emoji)} ${esc(t.name)} · ${fmt(t.total)} avg</span>`).join('')}</div>` : '';
    return [`stand-${f.idx}`, `<div class="stack"><h2 class="center">🏆 Standings</h2>${teams}${board(S.players.slice(0, 8))}
      <div class="card center">${next ? `Up next: <b>${next.emoji} ${esc(next.title)}</b>` : 'Awards coming up! 🏅'} <span class="muted" data-count="${f.until}"></span></div></div>`, 'break'];
  }
  function finale() {
    const awards = (S.awards || []).filter((a) => a.winners.some((w) => w.id === me().id));
    const top3 = S.players.slice(0, 3);
    return [`final-${S.flow.stage}`, `<div class="stack"><h2 class="center">🎆 Final standings</h2>
      <div class="podium-mini">${top3.map((p, i) => `<div class="pod p${i + 1}">${av(p)}<b>${esc(p.name)}</b><span>${fmt(p.score)}</span><i>${['🥇', '🥈', '🥉'][i]}</i></div>`).join('')}</div>
      <div class="card center">You finished <b>#${me().rank}</b> of ${S.players.length} with <b>${fmt(me().score)}</b> points</div>
      ${awards.length ? `<div class="card"><h3>Your awards</h3>${awards.map((a) => `<div class="kv"><span>${a.emoji} ${esc(a.title)}</span><span class="muted small">${esc(a.value)}</span></div>`).join('')}</div>` : ''}
      ${board(S.players.slice(0, 10))}
      <button class="btn ghost block" data-leave>Leave room</button></div>`, 'watch'];
  }

  // =================== DOCK, POWER-UPS, TV LINK ===================
  function renderDock(mode) {
    if (mode === 'none') { dock.innerHTML = ''; return; }
    const unused = me().powerups.filter((p) => !p.used);
    const pu = mode === 'break' && unused.length && S.powerupsEnabled ? `<button class="pu-pill" data-act="powerups">🎁 <span>Power-ups</span><i>${unused.map((p) => p.emoji).join(' ')}</i></button>` : '';
    App.patch(dock, `${pu}<div class="react-bar">${REACTS.map((e) => `<button data-react="${e}" aria-label="Send ${e}">${e}</button>`).join('')}</div>`);
  }
  function openPowerups() {
    const pus = me().powerups;
    modal.innerHTML = `<div class="modal"><div class="sheet"><div class="sheet-grab"></div><h3>🎁 Your secret power-ups</h3><p class="muted small">Use them between games.</p>
      ${pus.map((p) => `<div class="pu-row ${p.used ? 'used' : ''}"><span class="em">${p.emoji}</span><div><b>${esc(p.name)}</b><p class="small muted" style="margin:2px 0">${esc(p.desc)}</p></div>${p.used ? '<span class="chip done">Used</span>' : p.passive ? '<span class="chip">Always on</span>' : `<button class="btn small" data-use="${p.id}">Use</button>`}</div>`).join('')}
      <button class="btn ghost block" data-close>Close</button></div></div>`;
  }
  function usePowerup(id) {
    const pu = me().powerups.find((p) => p.id === id);
    if (!pu) return;
    if (pu.target) {
      const others = S.players.filter((p) => p.id !== me().id);
      modal.innerHTML = `<div class="modal"><div class="sheet"><h3>${pu.emoji} ${esc(pu.name)} — pick someone</h3>${others.map((p) => `<button class="pick-row" data-target="${p.id}" data-pu="${pu.id}">${av(p)} ${esc(p.name)}<span class="sc">${fmt(p.score)}</span></button>`).join('')}<button class="btn ghost block" data-close>Cancel</button></div></div>`;
      return;
    }
    modal.innerHTML = '';
    send({ type: 'powerup', powerupId: pu.id }, () => { App.confetti(0.6); App.toast(`${pu.emoji} ${pu.name}!`); });
  }
  function tvLink() {
    const url = `${location.origin}/tv?room=${S.code}#tv=${encodeURIComponent(S.tvSecret)}`;
    modal.innerHTML = `<div class="modal"><div class="sheet center"><h3>📺 Watch on a TV</h3><p class="muted small">Open this link on a TV, laptop or tablet browser. It mirrors the game with big visuals and music.</p>
      <img class="qr" src="/api/qr.svg?u=${encodeURIComponent(url)}" alt="QR code for the TV link" />
      <input readonly value="${esc(url)}" /><div class="row" style="gap:8px;justify-content:center"><button class="btn small" data-copy="${esc(url)}">Copy link</button><button class="btn ghost small" data-close>Close</button></div></div></div>`;
  }

  function onMoment(key) {
    if (/^q-\d|^k-\d|^j-\d/.test(key)) { App.sfx && App.sfx('tick'); App.vibrate(30); }
    if (/^(q|k|j)-r-/.test(key)) {
      const good = document.querySelector('.verdict.good');
      if (good) { App.sfx && App.sfx('correct'); App.confetti(0.5); App.vibrate([30, 30, 60]); } else App.vibrate(80);
    }
    if (key.startsWith('h-ready') && S.live && S.live.mine && S.live.mine.onStage) App.vibrate([100, 50, 100]);
    if (key.startsWith('final')) App.fireworks(1.2);
    if (key.startsWith('stand-')) App.sfx && App.sfx('fanfare');
  }

  // =================== EVENTS ===================
  document.addEventListener('click', (e) => {
    const el = (sel) => e.target.closest(sel);
    let b;
    if ((b = el('[data-answer]'))) { b.classList.add('chosen'); App.vibrate(25); game({ type: 'answer', choice: Number(b.dataset.answer) }); return; }
    if ((b = el('[data-pick]'))) { const [c, i] = b.dataset.pick.split('-'); game({ type: 'pick', c: Number(c), i: Number(i) }); return; }
    if (el('[data-dance]')) { game({ type: 'dance' }, () => App.confetti(0.6)); return; }
    if ((b = el('[data-vote]'))) { game({ type: 'vote', stars: Number(b.dataset.vote) }, () => App.sfx && App.sfx('pop')); return; }
    if ((b = el('[data-ready]'))) { send({ type: 'ready', on: b.dataset.ready === 'on' }); return; }
    if ((b = el('[data-host]'))) {
      const h = b.dataset.host;
      if (h === 'start') send({ type: 'setGames', order: S.flow.order }, () => send({ type: 'start' }));
      else if (h === 'addBots') send({ type: 'addBots', count: 4 });
      else send({ type: h });
      return;
    }
    if ((b = el('[data-toggle]'))) {
      const id = b.dataset.toggle; let order = [...S.flow.order];
      order = order.includes(id) ? order.filter((x) => x !== id) : [...order, id];
      if (!order.length) { App.toast('Keep at least one game.', true); return; }
      send({ type: 'setGames', order }); return;
    }
    if ((b = el('[data-up]'))) {
      const order = [...S.flow.order]; const i = order.indexOf(b.dataset.up);
      if (i > 0) { [order[i - 1], order[i]] = [order[i], order[i - 1]]; send({ type: 'setGames', order }); }
      return;
    }
    if ((b = el('[data-kick]'))) { if (confirm('Remove this player?')) send({ type: 'kick', pid: b.dataset.kick }); return; }
    if ((b = el('[data-age]'))) { draft.age = b.dataset.age; render(); return; }
    if ((b = el('[data-topic]'))) { const v = b.dataset.topic; draft.interests = draft.interests.includes(v) ? draft.interests.filter((x) => x !== v) : [...draft.interests, v]; render(); return; }
    if ((b = el('[data-genre]'))) { const v = b.dataset.genre; draft.genres = draft.genres.includes(v) ? draft.genres.filter((x) => x !== v) : [...draft.genres, v]; render(); return; }
    if ((b = el('[data-ans]'))) { draft.answers[b.dataset.ans] = b.dataset.val; render(); return; }
    if (el('[data-profile-done]')) {
      document.querySelectorAll('[data-text]').forEach((i) => { draft.answers[i.dataset.text] = i.value.trim(); });
      if (!draft.age) { App.toast('Pick your age range.', true); return; }
      send({ type: 'profile', ...draft }, () => { App.confetti(0.6); });
      return;
    }
    if ((b = el('[data-react]'))) { App.react(b.dataset.react, { name: me().name, avatar: me().avatar }); b.classList.remove('sent'); void b.offsetWidth; b.classList.add('sent'); return; }
    if (el('[data-act=powerups]')) { openPowerups(); return; }
    if ((b = el('[data-use]'))) { usePowerup(b.dataset.use); return; }
    if ((b = el('[data-target]'))) { const id = b.dataset.pu; modal.innerHTML = ''; send({ type: 'powerup', powerupId: id, targetId: b.dataset.target }, () => App.confetti(0.6)); return; }
    if ((b = el('[data-pu]')) && b.classList.contains('hint-pill')) { send({ type: 'powerup', powerupId: b.dataset.pu }); return; }
    if (el('[data-close]') || (e.target.classList && e.target.classList.contains('modal'))) { modal.innerHTML = ''; return; }
    if (el('[data-tv]')) { tvLink(); return; }
    if (el('[data-share]')) {
      const url = `${location.origin}/play?room=${S.code}`;
      if (navigator.share) navigator.share({ title: 'Diwali Party', text: `Join my Diwali Party! Room ${S.code}`, url }).catch(() => {});
      else navigator.clipboard.writeText(url).then(() => App.toast('Link copied'));
      return;
    }
    if ((b = el('[data-copy]'))) { navigator.clipboard.writeText(b.dataset.copy).then(() => App.toast('Copied')); return; }
    if (el('[data-leave]')) { store.del('dgn_token'); store.del('dgn_token_room'); if (sock) sock.disconnect(); S = null; history.replaceState(null, '', '/play'); home('start'); }
  });
  // Typing in the profile keeps the draft without re-rendering.
  document.addEventListener('input', (e) => { const t = e.target; if (t.dataset && t.dataset.text && draft) draft.answers[t.dataset.text] = t.value; });

  // =================== BOOT ===================
  const fromUrl = App.roomFromQuery();
  const saved = App.canonRoom(store.get('dgn_token_room'));
  const tok = store.get('dgn_token');
  if (tok && saved && (!fromUrl || fromUrl === saved)) enter(saved, tok);
  else home(fromUrl ? 'join' : 'start');
})();
