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
  function loginView() {
    app.innerHTML = `<div class="login-card card stack">
      <div class="center"><div style="font-size:52px">🪔</div><h2 style="font-size:28px">Host console</h2><p class="muted">Enter the host PIN (printed in the server log, or set with HOST_PIN).</p></div>
      <form id="lf" class="stack"><input type="password" id="pin" inputmode="numeric" placeholder="Host PIN" autocomplete="current-password" /><button class="btn big block">Enter</button></form></div>`;
    app.querySelector('#lf').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await App.post('/api/host/login', { pin: app.querySelector('#pin').value });
        store.set('dgn_host', r.token);
        start(r.token);
      } catch (err) { App.toast(err.message, true); }
    };
  }

  function start(token) {
    App.sparkles(14);
    app.innerHTML = `<div class="htop"><div class="logo"><span class="diya">🪔</span><b>Host <span>Console</span></b></div><div class="htabs" id="tabs"></div></div><div id="main"></div>`;
    sock = App.connect('host', token, (s) => { S = s; render(); }, () => { store.del('dgn_host'); sock.disconnect(); loginView(); });
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
      left = `<div class="card"><h3>${esc(L.emoji)} ${esc(L.title)} <span class="chip live">LIVE</span><span class="chip">${L.mode}</span>${S.personalCount ? `<span class="chip gold">✨ ${S.personalCount} personalised</span>` : ''}
        <button class="btn red small" style="margin-left:auto" data-a="end">🏁 End game → leaderboard</button></h3>${fn(L)}</div>`;
    }
    return `<div class="hgrid"><div>${demoCard()}${left}${tvCard()}</div><div>${pendingCard()}${awardCard()}${feedCard()}</div></div>`;
  }

  function demoCard() {
    if (S.demo) {
      return `<div class="card demo-on"><div class="row"><span style="font-size:30px">🤖</span><div class="grow"><b>Demo mode: ${S.demo.bots} bots are playing along</b>
        <div class="small muted">They answer, buzz, vote, rate dances, use power-ups and send reactions. Run any game from the list below.</div></div>
        <button class="btn red small" data-a="demoEnd">End demo & reset for the party</button></div></div>`;
    }
    if (S.games.some((g) => g.status === 'live')) return '';
    return `<div class="card demo-off"><div class="row"><span style="font-size:30px">🤖</span><div class="grow"><b>Try a practice run with bots</b>
      <div class="small muted">Adds bot guests with questionnaire answers (couples, best friends, group votes) and teams. Join as a player in another tab or on your phone, then run the games from here. One click removes them afterwards.</div></div>
      <select data-ui="demoCount" style="width:auto">${[6, 8, 10, 12].map((n) => opt(n, `${n} bots`, ui.demoCount || 8)).join('')}</select>
      <button class="btn rani" data-a="demoStart">🤖 Start demo</button></div></div>`;
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
      ? `<div class="kv"><span>🎵 <b>${esc(m.label || 'Clip')}</b> <span class="small muted">from ${window.fmtTime(m.start || 0)}${m.end ? ' to ' + window.fmtTime(m.end) : ''} · ${m.show ? 'video showing' : 'audio only'}</span></span></div>
        <div class="btn-row" style="margin-top:8px"><button class="btn small" data-a="media" data-op="replay">↺ Replay from start</button><button class="btn small ghost" data-a="media" data-op="${m.show ? 'hide' : 'show'}">${m.show ? '🙈 Hide video' : '👁 Show video'}</button><button class="btn small red" data-a="media" data-op="stop">⏹ Stop</button></div>`
      : m && m.stopped ? `<div class="kv"><span>⏹ Stopped: ${esc(m.label || '')}</span><button class="btn small" data-a="media" data-op="replay">↺ Play again</button></div>`
      : '<p class="small muted" style="margin:4px 0">Nothing playing. Clips on questions, clues and songs start automatically.</p>';
    return `<div class="sec-title">🎵 Music & video on TV</div>${now}
      <div class="row" style="margin-top:8px"><input type="text" data-ui="djUrl" placeholder="Paste any YouTube link to play on the TV now" value="${esc(ui.djUrl || '')}" style="flex:1 1 220px"/><button class="btn small gold" data-a="media" data-op="dj">▶ Play</button></div>`;
  }

  function linksHtml() {
    const o = location.origin;
    return `<div class="links stack">${[['Players join', o + '/play'], ['TV display', o + '/tv'], ['Host', o + '/host']].map(([l, u]) => `<div class="row"><span style="width:100px" class="small muted">${l}</span><input type="text" readonly value="${u}" class="grow" style="flex:1"/><button class="btn small ghost" data-a="copy" data-u="${u}">Copy</button></div>`).join('')}</div>`;
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
    if (L.phase === 'board') {
      const cats = L.categories;
      const rows = Math.max(...cats.map((c) => c.clues.length));
      let cells = cats.map((c) => `<div class="jc">${esc(c.name)}</div>`).join('');
      for (let i = 0; i < rows; i++) cells += cats.map((c, ci) => c.clues[i] ? `<button data-g="pick" data-c="${ci}" data-i="${i}" ${c.clues[i].used ? 'disabled' : ''}>${c.clues[i].value}</button>` : '<span></span>').join('');
      return `<p class="muted">Pick a clue — buzzers open automatically.</p><div class="jgrid" style="grid-template-columns:repeat(${cats.length},1fr)">${cells}</div>`;
    }
    const c = L.clue;
    const queue = L.buzzes.map((b, i) => `<div class="row ${L.active && L.active.key === b.key ? 'active' : ''} ${L.locked.includes(b.key) ? 'locked' : ''}">${i + 1}. ${esc(b.emoji)} ${esc(b.name)} ${b.kind === 'team' ? `<span class="small muted">(${esc(b.buzzerName)})</span>` : ''}<span class="small muted" style="margin-left:auto">${(b.ms / 1000).toFixed(2)}s</span></div>`).join('');
    return `<div class="qbox"><div class="small muted">${esc(c.category)} · ${c.value}</div><div class="q">${esc(c.q)}</div></div>
      <div class="answer-key">Answer: ${esc(c.a)}</div>
      <div class="sec-title">Buzz queue</div><div class="queue">${queue || '<p class="muted">Waiting for buzzes…</p>'}</div>
      ${L.phase === 'clue' ? `<div class="btn-row" style="margin-top:12px">
        <button class="btn green" data-g="correct" ${L.active ? '' : 'disabled'}>✓ Correct${L.active ? ' — ' + esc(L.active.name) : ''}</button>
        <button class="btn red" data-g="wrong" ${L.active ? '' : 'disabled'}>✗ Wrong</button>
        <button class="btn ghost" data-g="reveal">Reveal answer (no points)</button></div>`
      : `<div class="btn-row" style="margin-top:12px"><button class="btn big" data-g="board">↩ Back to board</button></div>`}`;
  }

  // ---------- KBC ----------
  function kbcCtl(L) {
    const seatSel = `<div class="row" style="margin-top:10px"><select data-ui="seat" style="flex:1"><option value="">— or pick anyone —</option>${S.players.map((p) => opt(p.id, `${esc(p.avatar)} ${esc(p.name)}`, ui.seat)).join('')}</select><button class="btn small gold" data-a="seatPick">🪑 Seat</button></div>`;
    const hist = L.history.length ? `<div class="sec-title">Hot seat history</div>${L.history.map((h) => `<div class="kv"><span>${pname(h.pid)}</span><b>${fmt(h.winnings)}</b></div>`).join('')}` : '';
    if (L.phase === 'idle') return `<p class="muted">Run Fastest Finger First to pick a contestant, or seat someone directly.</p><button class="btn big" data-g="ff">⚡ Fastest Finger First</button>${seatSel}${hist}`;
    if (L.phase === 'ff') return `<div class="qbox"><div class="q">${esc(L.ff.question.q)}</div></div><p><b>${L.ff.answered}</b> answered · <span data-count="${L.ff.deadline}"></span>s</p><button class="btn" data-g="ffClose">⏩ Close now</button>`;
    if (L.phase === 'ff-result') {
      const r = L.ff.result;
      return `<p>Winner: <b>${r.winner ? pname(r.winner) : 'nobody got it right'}</b></p>
        ${r.ranking.slice(0, 5).map((x, i) => `<div class="kv"><span>${i + 1}. ${pname(x.id)}</span><span>${(x.ms / 1000).toFixed(2)}s</span></div>`).join('')}
        <div class="btn-row" style="margin-top:10px">${r.winner ? `<button class="btn big gold" data-g="seat">🪑 Seat ${pname(r.winner)}</button>` : ''}<button class="btn ghost" data-g="ff">⚡ Another FFF</button></div>${seatSel}`;
    }
    const h = L.hot;
    const q = h.question;
    let ctl = '';
    if (h.qPhase === 'question') {
      ctl = `<p>Locked: <b>${h.locked != null ? letters[h.locked] : '— waiting for contestant (or lock for them) —'}</b></p>
        <div class="btn-row">${q.options.map((o, i) => `<button class="btn small ${h.locked === i ? 'gold' : 'ghost'}" data-g="lock" data-i="${i}" ${h.removed.includes(i) ? 'disabled' : ''}>Lock ${letters[i]}</button>`).join('')}${h.locked != null ? '<button class="btn small ghost" data-g="unlock">Unlock</button>' : ''}</div>
        <div class="btn-row" style="margin-top:10px"><button class="btn big" data-g="reveal" ${h.locked == null ? 'disabled' : ''}>🎯 Reveal answer</button><button class="btn ghost" data-g="walk">🚶 Walk away</button></div>
        <div class="sec-title">Lifelines</div><div class="btn-row">${[['fifty', '✂️ 50:50'], ['poll', '📊 Audience poll'], ['phone', '📞 Phone a friend']].map(([k, l]) => `<button class="btn small teal" data-g="lifeline" data-name="${k}" ${h.lifelines[k] ? '' : 'disabled'}>${l}</button>`).join('')}</div>
        ${h.poll ? `<p class="small">Poll ${h.poll.open ? '(open)' : '(closed)'}: ${h.poll.counts.map((c, i) => `${letters[i]} ${c}`).join(' · ')}</p>` : ''}`;
    } else if (h.qPhase === 'reveal') {
      ctl = `<p>✅ Correct! Now at level ${h.level}.</p><button class="btn big" data-g="nextQ">▶ Next question (${fmt(L.ladder[h.level].points)})</button>`;
    } else {
      ctl = `<p><b>${h.status === 'won' ? '🏆 Won the ladder' : h.status === 'walked' ? '🚶 Walked away' : '💔 Wrong answer'}</b> — awarded ${fmt(h.winnings)} points.</p>
        <div class="btn-row"><button class="btn big" data-g="ff">⚡ Next Fastest Finger</button><button class="btn ghost" data-g="idle">KBC lobby</button></div>${seatSel}`;
    }
    return `<p>🪑 <b>${pname(h.pid)}</b> · Q${h.questionLevel + 1} for <b>${fmt(L.ladder[h.questionLevel].points)}</b> · safe ${fmt(h.safe)}</p>
      <div class="qbox">${q.personal ? '<span class="chip gold">✨ From guests\' answers</span>' : ''}<div class="q">${esc(q.q)}</div><ol type="A">${q.options.map((o, i) => `<li class="${i === h.answerKey ? 'ok' : ''}" style="${h.removed.includes(i) ? 'text-decoration:line-through;opacity:.4' : ''}">${esc(o)}${i === h.answerKey ? ' ✓' : ''}</li>`).join('')}</ol></div>${ctl}${hist}`;
  }

  // ---------- hook step ----------
  function hookCtl(L) {
    const perf = L.perf;
    const performerSel = `<select data-ui="performer"><option value="">— who's performing? —</option>${entityOptions(ui.performer || (perf ? perf.performer.key : ''), L.mode === 'team')}</select>`;
    const songSel = `<select data-ui="song"><option value="">🎰 Random (spin)</option>${L.songs.map((s, i) => opt(i, esc(s), ui.song)).join('')}</select>`;
    let body = `<div class="stack">${performerSel}${songSel}<div class="btn-row"><button class="btn" data-a="hookSetup">✅ Set performer${ui.song === '' ? '' : ' & song'}</button>${perf ? '<button class="btn gold" data-g="spin">🎰 Spin a song</button>' : ''}</div></div>`;
    if (perf) {
      body += `<div class="qbox" style="margin-top:12px"><div><b>${esc(perf.performer.emoji)} ${esc(perf.performer.name)}</b> ${perf.members ? `<span class="small muted">(${perf.members.map(esc).join(', ')})</span>` : ''}</div>
        <div>🎵 ${perf.song ? `${esc(perf.song.title)} — <span class="muted">${esc(perf.song.step)}</span>` : L.phase === 'spin' ? 'spinning…' : '<i>no song yet</i>'}</div>
        <div class="small muted">Phase: ${L.phase}${L.phase === 'voting' ? ` · ${perf.votes} votes · avg ${perf.avg}` : ''}</div></div>
        <div class="btn-row">
          <button class="btn" data-g="perform" ${perf.song && L.phase === 'ready' ? '' : 'disabled'}>▶ Start performance</button>
          <button class="btn teal" data-g="vote" ${['perform', 'ready'].includes(L.phase) ? '' : 'disabled'}>🗳 Open voting</button>
          ${L.phase === 'voting' ? '<button class="btn ghost" data-g="closeVote">Close voting</button>' : ''}
        </div>
        ${['voting', 'tally'].includes(L.phase) ? `<div class="row" style="margin-top:10px"><span>Judges' bonus</span><select data-ui="judge" style="width:auto">${[0, 50, 100, 150, 200].map((n) => opt(n, '+' + n, ui.judge)).join('')}</select><button class="btn green" data-a="hookScore">🏅 Award (${perf.avg}★ × 100 + bonus)</button></div>` : ''}
        ${L.phase === 'scored' && L.last ? `<p>Awarded <b>+${L.last.points}</b>. Pick the next performer above.</p>` : ''}`;
    }
    if (L.results.length) body += `<div class="sec-title">Results</div>${L.results.map((r) => `<div class="kv"><span>${esc(r.performer.emoji)} ${esc(r.performer.name)} · <span class="muted small">${esc(r.song)}</span></span><b>+${r.points}</b></div>`).join('')}`;
    return body;
  }

  // ================= GAMES TAB =================
  function gamesTab() {
    const typeNames = { quiz: 'Quiz (Kahoot / Guess the Movie)', jeopardy: 'Jeopardy', kbc: 'KBC', hookstep: 'Hook Step', custom: 'Custom (host-scored)' };
    return `<div class="hgrid"><div><div class="card"><h3>🗂 Game lineup</h3>
      ${S.games.map((g, i) => `<div class="game-row ${g.status === 'live' ? 'live' : ''}"><span class="em">${esc(g.emoji)}</span><div class="grow"><div class="nm">${esc(g.title)}</div><div class="small muted">${typeNames[g.type]}</div></div>
        <select data-a="mode" data-id="${g.id}" style="width:auto" ${g.status === 'live' ? 'disabled' : ''}>${opt('individual', '👤 Solo', g.mode)}${opt('team', '👥 Teams', g.mode)}</select>
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
      jeopardy: 'categories: [{ name, clues: [{ value, q, a }] }], wrongPenalty: true/false',
      kbc: 'ladder: [{ points, safe?: true, questions: [{ q, options, answer }] }], fastestFinger: [{ q, options, answer, time }]',
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
        <td>${d.powerups.map((u) => `<span class="pu-mini ${u.used ? 'used' : ''}" title="${esc(S.powerupDefs[u.type].name)}${u.used ? ' (used)' : ''}">${S.powerupDefs[u.type].emoji}</span>`).join(' ')}${d.doublePending ? ' <span class="chip gold">×2 next</span>' : ''}</td>
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
  app.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.eg && !/radio|checkbox/.test(e.target.type) && e.target.tagName !== 'SELECT') { editor.onInput(e); return; } const k = e.target.dataset && e.target.dataset.ui; if (k) ui[k] = e.target.value; });
  app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.eg) { if (/radio|checkbox/.test(t.type) || t.tagName === 'SELECT') editor.onInput(e); return; }
    if (t.dataset.ui) { ui[t.dataset.ui] = t.value; render(); return; }
    if (t.dataset.a === 'mode') act({ type: 'editGame', gameId: t.dataset.id, mode: t.value });
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
      return gameAct(a);
    }
    const b = e.target.closest('[data-a]');
    if (!b || b.tagName === 'SELECT') return;
    const id = b.dataset.id;
    switch (b.dataset.a) {
      case 'start': act({ type: 'startGame', gameId: id }); break;
      case 'end': if (confirm('End this game and show the leaderboard?')) act({ type: 'endGame' }); break;
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
      case 'award': {
        if (!ui.awardTarget) return App.toast('Pick a player or team first', true);
        const n = b.dataset.n ? Number(b.dataset.n) : Number(ui.awardAmount);
        act({ type: 'award', target: ui.awardTarget, amount: n, reason: ui.awardReason }, `${n > 0 ? '+' : ''}${n} awarded`);
        break;
      }
      case 'seatPick': if (!ui.seat) return App.toast('Pick a player', true); gameAct({ type: 'seat', playerId: ui.seat }); break;
      case 'hookSetup': if (!ui.performer && !(S.live.perf)) return App.toast('Pick a performer', true);
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
      case 'logout': store.del('dgn_host'); location.reload(); break;
      default:
    }
  });

  const tok = store.get('dgn_host');
  if (tok) start(tok); else loginView();
})();
