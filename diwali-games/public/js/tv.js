/* TV display */
(function () {
  const { esc, fmt, letters } = App;
  const $ = (id) => document.getElementById(id);
  App.sparkles(60);

  let S = null;
  let prev = { sceneKey: null, announceId: null, revealKey: null, lbKey: null };
  const shownAnnounce = new Set();

  $('soundBtn').onclick = () => { App.enableSound(); App.sfx('join'); $('soundBtn').remove(); };

  App.connect('tv', null, (s) => { S = s; render(); });

  const player = (id) => S.players.find((p) => p.id === id);
  const team = (id) => S.teams.find((t) => t.id === id);
  const av = (p, cls = '') => `<span class="avatar ${cls}" style="--c:${p ? p.color : '#ffb300'}">${p ? esc(p.avatar) : '❔'}</span>`;
  const entAv = (e) => `<span class="avatar" style="--c:${e.color}">${esc(e.emoji)}</span>`;
  const timerBar = (start, end) => `<div class="timer" data-start="${start}" data-end="${end}"><i></i></div>`;
  const joinUrl = () => location.origin + '/play';

  function render() {
    document.title = `${S.eventName} — TV`;
    App.patch($('eventName'), S.eventName.split(' ').length > 2 ? esc(S.eventName).replace(/(\S+\s+\S+)$/, '<span>$1</span>') : esc(S.eventName));
    App.patch($('nowPlaying'), S.live ? `${esc(S.live.emoji)} ${esc(S.live.title)} · ${S.live.mode === 'team' ? 'Team game' : 'Solo game'}` : '');
    App.patch($('miniTop'), S.players.slice(0, 3).filter((p) => p.score > 0).map((p, i) => `<div class="m">${['🥇', '🥈', '🥉'][i]} ${av(p)} ${esc(p.name)} · ${fmt(p.score)}</div>`).join(''));
    App.patch($('ticker'), S.feed.length ? S.feed.map((f) => `<span>${esc(f.emoji || '✨')} ${esc(f.text)}</span>`).join('') : `<span>🪔 Happy Diwali! Join at <b>${esc(joinUrl())}</b></span><span>✨ Secret power-ups await every player…</span>`);

    let view = S.tv.view;
    if (view === 'game' && !S.live) view = 'lobby';
    let html, key;
    if (view === 'lobby') [html, key] = [lobby(), 'lobby'];
    else if (view === 'leaderboard') [html, key] = [leaderboard(), 'lb'];
    else if (view === 'podium') [html, key] = [podium(), 'podium'];
    else if (view === 'teams') [html, key] = [teamsView(), 'teams'];
    else [html, key] = gameScene();

    const stage = $('stage');
    if (key !== prev.sceneKey) {
      stage.innerHTML = `<div class="scene enter"></div>`;
      stage._html = undefined;
      prev.sceneKey = key;
      onSceneChange(key);
    }
    App.patch(stage.firstElementChild, html);
    renderAnnounce();
  }

  function onSceneChange(key) {
    if (key === 'lb') { App.sfx('fanfare'); setTimeout(() => App.confetti(1), 400); }
    if (key === 'podium') { App.sfx('fanfare'); setTimeout(() => App.confetti(2), 2200); setTimeout(() => App.confetti(2), 3400); }
    if (/reveal|answer-correct|scored|ff-result|won/.test(key)) { App.sfx('reveal'); if (!/wrong/.test(key)) App.confetti(0.7); }
    if (/^q-|clue|spin|ff-q/.test(key)) App.sfx('whoosh');
  }

  function renderAnnounce() {
    const a = S.tv.announce;
    const el = $('announce');
    if (a && a.until > App.now() && !shownAnnounce.has(a.id)) {
      shownAnnounce.add(a.id);
      el.className = 'announce ' + (a.kind || '');
      el.innerHTML = `<div class="box"><div class="em">${esc(a.emoji || '✨')}</div><h1>${esc(a.title)}</h1><p>${esc(a.text || '')}</p></div>`;
      App.sfx(a.kind === 'powerup' ? 'power' : 'fanfare');
      if (a.kind === 'powerup' || a.kind === 'end') App.confetti(0.6);
      clearTimeout(el._h);
      el._h = setTimeout(() => el.classList.add('hidden'), Math.max(1500, a.until - App.now()));
    } else if (!a) {
      el.classList.add('hidden');
    }
  }

  // ---------------- scenes ----------------
  function lobby() {
    const url = joinUrl();
    const ps = S.players;
    return `<div class="lobby">
      <div>
        <h1>${esc(S.eventName.replace(/ Game Night$/, ''))}<br/><span class="g">Game Night</span></h1>
        <div class="sub">Scan to join · verify your phone · collect your <b>secret power-ups</b> 🎁</div>
        <div class="join-box">
          <img src="/api/qr.svg?u=${encodeURIComponent(url)}" alt="QR code to join" />
          <div><div class="step">Open on your phone</div><div class="url">${esc(url.replace(/^https?:\/\//, ''))}</div>
          <div class="step" style="margin-top:.8vw">Games tonight: ${S.games.map((g) => esc(g.emoji)).join(' ')}</div></div>
        </div>
      </div>
      <div>
        <div class="count-big">${ps.length} ${ps.length === 1 ? 'player' : 'players'} joined ✨</div>
        <div class="lobby-players">${ps.map((p) => `<div class="pl ${p.online ? '' : 'off'}">${av(p)}<span>${esc(p.name)}</span></div>`).join('') || '<div class="muted" style="color:#fff;opacity:.7;font-size:1.4vw">Waiting for the first guest…</div>'}</div>
      </div>
    </div>`;
  }

  function movement(p) {
    if (!S.snapshot || S.snapshot.every((x) => x.score === 0)) return '';
    const before = S.snapshot.find((x) => x.id === p.id);
    if (!before) return `<span class="mv up">NEW</span>`;
    const d = before.rank - p.rank;
    if (d > 0) return `<span class="mv up">▲${d}</span>`;
    if (d < 0) return `<span class="mv down">▼${-d}</span>`;
    return `<span class="mv same">●</span>`;
  }

  function leaderboard() {
    const ps = S.players;
    const rows = ps.map((p, i) => {
      const t = p.teamId && team(p.teamId);
      return `<div class="lb-row r${p.rank}" style="animation-delay:${(ps.length - i) * 0.06}s">
        <span class="rk">${p.rank}</span>${movement(p)}${av(p)}<span class="nm">${esc(p.name)}</span>
        ${t ? `<span class="team" style="background:${t.color}">${esc(t.emoji)} ${esc(t.name.replace('Team ', ''))}</span>` : ''}
        <span class="sc">${fmt(p.score)}</span></div>`;
    }).join('');
    const teams = S.teams.length ? `<div class="teams-strip">${[...S.teams].sort((a, b) => b.total - a.total).map((t) => `<span class="t" style="--tc:${t.color}">${esc(t.emoji)} ${esc(t.name)} · ${fmt(t.total)} avg</span>`).join('')}</div>` : '';
    return `<div class="lb"><h1>🏆 Leaderboard</h1>${teams}<div class="lb-cols ${ps.length <= 8 ? 'one' : ''} ${ps.length > 12 ? 'dense' : ''}">${rows || '<p class="center">No players yet</p>'}</div></div>`;
  }

  function podium() {
    const top = S.players.slice(0, 3);
    const order = [top[1], top[0], top[2]];
    const cls = ['p2', 'p1', 'p3'];
    return `<div class="podium"><h1>🎆 Champions of the Night 🎆</h1><div class="pods">${order.map((p, i) => p ? `<div class="pod ${cls[i]}">${av(p)}<div class="nm">${esc(p.name)}</div><div class="sc">${fmt(p.score)} pts</div><div class="blk">${cls[i][1]}</div></div>` : '<div class="pod"></div>').join('')}</div></div>`;
  }

  function teamsView() {
    if (!S.teams.length) return `<div class="intro"><div><div class="em">🎲</div><h1>Teams coming up…</h1></div></div>`;
    return `<div class="gframe"><h1 style="font-size:3.6vw;text-align:center">🎲 Tonight's Teams</h1><div class="teams-grid">${S.teams.map((t, i) => `<div class="team-card" style="--tc:${t.color};animation-delay:${i * 0.15}s"><div class="th"><span>${esc(t.emoji)} ${esc(t.name)}</span><span>${fmt(t.total)}</span></div><div class="tb">${t.members.map((id) => { const p = player(id); return p ? `<div class="lrow">${av(p)} ${esc(p.name)}</div>` : ''; }).join('')}</div></div>`).join('')}</div></div>`;
  }

  function gameScene() {
    const L = S.live;
    const fn = { quiz: quizScene, jeopardy: jeopardyScene, kbc: kbcScene, hookstep: hookScene, custom: customScene }[L.type];
    return fn(L);
  }

  const intro = (L, sub) => `<div class="intro"><div><div class="em">${esc(L.emoji)}</div><h1>${esc(L.title)}</h1><p>${sub}</p></div></div>`;

  // ---------- quiz ----------
  function quizScene(L) {
    if (L.phase === 'intro') return [intro(L, `${L.total} questions · ${L.mode === 'team' ? 'teams score the average of their members' : 'faster answers score more'} · answer on your phone!`), 'q-intro'];
    if (L.phase === 'final') return [intro({ ...L, emoji: '🎉' }, 'Round complete! Leaderboard coming up…'), 'q-final'];
    const q = L.question;
    const head = `<div class="ghead"><span class="pill gold">Q ${L.qIndex + 1} / ${L.total}</span><span class="pill">${esc(L.title)}</span>
      ${L.phase === 'question' ? `<span class="count" data-count="${L.deadline}" data-tick="1"></span>` : ''}</div>`;
    const qcard = `<div class="qcard">${q.clue ? `<div class="clue">${esc(q.clue)}</div>` : ''}${q.image ? `<img class="qimg" src="${esc(q.image)}" alt=""/>` : ''}<div class="q">${esc(q.q)}</div></div>`;

    if (L.phase === 'question') {
      const waiting = App.now() < L.opensAt;
      if (waiting) setTimeout(render, L.opensAt - App.now() + 30);
      const opts = waiting
        ? `<div class="countdown-big" data-count="${L.opensAt}"></div>`
        : `<div class="opts">${q.options.map((o, i) => `<div class="opt o${i}"><span class="k">${letters[i]}</span>${esc(o)}</div>`).join('')}</div>`;
      return [`<div class="gframe">${head}${timerBar(L.opensAt, L.deadline)}${qcard}${opts}<div class="answered">🔒 ${L.answered} / ${S.players.filter((p) => p.online).length} answered</div></div>`, `q-${L.qIndex}${waiting ? '-w' : ''}`];
    }
    // reveal
    const r = L.result;
    const total = r.counts.reduce((a, b) => a + b, 0) || 1;
    const opts = `<div class="opts">${q.options.map((o, i) => `<div class="opt o${i} ${i === r.answer ? 'right' : 'dim'}"><span class="k">${i === r.answer ? '✓' : letters[i]}</span>${esc(o)}<span class="n">${r.counts[i]}</span><span class="bar" style="width:${(r.counts[i] / total) * 100}%"></span></div>`).join('')}</div>`;
    let side;
    if (L.mode === 'team') {
      const ts = S.teams.map((t) => ({ t, pts: r.perTeam[t.id] || 0 })).sort((a, b) => b.pts - a.pts);
      side = `<div class="list-card"><h3>Team points</h3>${ts.map(({ t, pts }) => `<div class="lrow"><span class="avatar" style="--c:${t.color}">${esc(t.emoji)}</span>${esc(t.name)}<span class="pts">+${pts}</span></div>`).join('')}</div>`;
    } else {
      side = `<div class="list-card"><h3>⚡ Fastest fingers</h3>${r.fastest.map((f) => { const p = player(f.id); return p ? `<div class="lrow">${av(p)}${esc(p.name)} <span class="small" style="opacity:.7">${(f.ms / 1000).toFixed(1)}s</span><span class="pts">+${f.points}${p.double ? ' ×2' : ''}</span></div>` : ''; }).join('') || '<div class="lrow">Nobody got it! 😱</div>'}</div>`;
    }
    return [`<div class="gframe">${head}${qcard}<div class="reveal-side">${opts}${side}</div></div>`, `q-${L.qIndex}-reveal`];
  }

  // ---------- jeopardy ----------
  function jeopardyScene(L) {
    const head = `<div class="ghead"><span class="pill gold">${esc(L.title)}</span><span class="pill">${L.mode === 'team' ? 'Teams' : 'Solo'} · buzz on your phone</span></div>`;
    if (L.phase === 'board') {
      const cats = L.categories;
      const rows = Math.max(...cats.map((c) => c.clues.length));
      let cells = cats.map((c) => `<div class="jcat">${esc(c.name)}</div>`).join('');
      for (let i = 0; i < rows; i++) {
        cells += cats.map((c) => {
          const cl = c.clues[i];
          if (!cl) return '<div></div>';
          if (cl.used) { const e = cl.by && L.entities[cl.by]; return `<div class="jcell used">${e ? esc(e.emoji) : '—'}</div>`; }
          return `<div class="jcell">${cl.value}</div>`;
        }).join('');
      }
      return [`<div class="gframe">${head}<div class="jboard" style="grid-template-columns:repeat(${cats.length},1fr);grid-template-rows:auto repeat(${rows},1fr)">${cells}</div></div>`, 'j-board'];
    }
    const c = L.clue;
    const queue = L.buzzes.map((b) => `<div class="lrow ${L.active && L.active.key === b.key ? 'active' : ''} ${L.locked.includes(b.key) ? 'locked' : ''}"><span class="avatar" style="--c:${b.color}">${esc(b.emoji)}</span>${esc(b.name)}${b.kind === 'team' ? ` <span class="small" style="opacity:.7">(${esc(b.buzzerName)})</span>` : ''}<span class="pts">${(b.ms / 1000).toFixed(2)}s</span></div>`).join('');
    const answer = L.phase === 'answer';
    const correct = answer && L.last && L.last.correct;
    if (L.active && !answer && prev.buzzKey !== L.active.key) App.sfx('buzz');
    prev.buzzKey = L.active ? L.active.key : null;
    const side = `<div class="list-card bq"><h3>🔔 Buzzers</h3>${L.buzzOpen && !L.buzzes.length ? '<div class="buzz-now">BUZZ NOW!</div>' : ''}${queue}
      ${answer && L.last && L.last.correct ? `<div class="buzz-now" style="animation:none;margin-top:1vw">+${L.last.value} to ${esc(L.last.info.name)}!</div>` : ''}</div>`;
    return [`<div class="gframe">${head}<div class="jclue"><div class="qcard"><div class="cat">${esc(c.category)} · ${c.value}</div><div class="q">${esc(c.q)}</div>${answer ? `<div class="ans pop">✨ ${esc(c.a)}</div>` : ''}</div>${side}</div></div>`, `j-clue-${L.cur.c}-${L.cur.i}${answer ? (correct ? '-answer-correct' : '-answer') : ''}`];
  }

  // ---------- KBC ----------
  function ladderHtml(L, curLevel, doneUpTo) {
    return `<div class="ladder">${L.ladder.map((l, i) => `<div class="lv ${l.safe ? 'safe' : ''} ${i === curLevel ? 'cur' : ''} ${i < doneUpTo ? 'done' : ''}"><span>${i + 1}</span><span>${l.safe ? '★ ' : ''}${fmt(l.points)}</span></div>`).join('')}</div>`;
  }
  function kbcScene(L) {
    const head = `<div class="ghead"><span class="pill gold">💰 Kaun Banega Crorepati</span></div>`;
    if (L.phase === 'idle') {
      const hist = L.history.map((h) => { const p = player(h.pid); return p ? `<div class="lrow">${av(p)}${esc(p.name)}<span class="pts">${fmt(h.winnings)}</span></div>` : ''; }).join('');
      return [`<div class="gframe">${head}<div class="kbc"><div class="intro"><div><div class="em">💰</div><h1>Kaun Banega Crorepati</h1><p>Fastest Finger First decides who takes the hot seat!</p>${hist ? `<div class="list-card" style="margin-top:2vw;text-align:left"><h3>Hot seat winnings</h3>${hist}</div>` : ''}</div></div>${ladderHtml(L, -1, 0)}</div></div>`, 'kbc-idle'];
    }
    if (L.phase === 'ff' || L.phase === 'ff-result') {
      const f = L.ff;
      const q = f.question;
      const waiting = L.phase === 'ff' && App.now() < f.opensAt;
      if (waiting) setTimeout(render, f.opensAt - App.now() + 30);
      const res = f.result;
      const opts = waiting ? `<div class="countdown-big" data-count="${f.opensAt}"></div>` : `<div class="kbc-opts">${q.options.map((o, i) => `<div class="kbc-opt ${res ? (i === res.answer ? 'right' : '') : ''}"><span class="k">${letters[i]}:</span>${esc(o)}${res ? `<span class="pc">${res.counts[i]}</span>` : ''}</div>`).join('')}</div>`;
      let side = '';
      if (res) {
        side = `<div class="list-card"><h3>⚡ Fastest correct</h3>${res.ranking.slice(0, 8).map((r, i) => { const p = player(r.id); return p ? `<div class="lrow" ${i === 0 ? 'style="color:var(--gold)"' : ''}>${i === 0 ? '👑' : i + 1 + '.'} ${av(p)}${esc(p.name)}<span class="pts">${(r.ms / 1000).toFixed(2)}s</span></div>` : ''; }).join('') || '<div class="lrow">Nobody got it right!</div>'}</div>`;
      } else {
        side = `<div class="list-card"><h3>Fastest Finger First</h3><div class="answered">🔒 ${f.answered} locked in</div></div>`;
      }
      return [`<div class="gframe">${head}${L.phase === 'ff' ? timerBar(f.opensAt, f.deadline) : ''}<div class="kbc"><div class="kbc-main"><div class="kbc-banner">FASTEST FINGER FIRST ${L.phase === 'ff' ? `· <span data-count="${f.deadline}" data-tick="1"></span>` : ''}</div><div class="kbc-q">${esc(q.q)}</div>${opts}</div>${side}</div></div>`, `ff-q-${L.ff.question.q}${res ? '-ff-result' : ''}${waiting ? '-w' : ''}`];
    }
    // hot seat
    const h = L.hot;
    const p = player(h.pid);
    const q = h.question;
    const pollHtml = h.poll ? (() => {
      const total = h.poll.counts.reduce((a, b) => a + b, 0) || 1;
      return `<div class="list-card"><h3>📊 Audience Poll${h.poll.open ? ` · <span data-count="${h.poll.deadline}"></span>s` : ''}</h3><div class="small" style="margin:-.6vw 0 .6vw;opacity:.8">${h.poll.votes} votes</div><div class="poll">${h.poll.counts.map((c, i) => `<div class="b"><span>${Math.round((c / total) * 100)}%</span><i style="height:${(c / total) * 100}%"></i><span>${letters[i]}</span></div>`).join('')}</div></div>`;
    })() : '';
    const phone = h.phoneUntil && h.phoneUntil > App.now() ? `<div class="kbc-banner">📞 Phone a friend · <span data-count="${h.phoneUntil}" data-tick="1"></span>s</div>` : '';
    const opts = `<div class="kbc-opts">${q.options.map((o, i) => {
      let cls = '';
      if (h.removed.includes(i)) cls = 'gone';
      else if (h.answer != null && i === h.answer) cls = 'right';
      else if (h.answer != null && i === h.locked) cls = 'wrong';
      else if (h.locked === i) cls = 'locked';
      return `<div class="kbc-opt ${cls}"><span class="k">${letters[i]}:</span>${esc(o)}</div>`;
    }).join('')}</div>`;
    let banner = '';
    if (h.qPhase === 'over') banner = `<div class="kbc-banner pop" style="font-size:3vw">${h.status === 'won' ? '🏆 CROREPATI! ' : h.status === 'walked' ? '🚶 Walked away with ' : '💔 Takes home '}${fmt(h.winnings)} points</div>`;
    else if (h.qPhase === 'reveal' && h.correct) banner = `<div class="kbc-banner pop" style="font-size:3vw">✅ Sahi jawab! ${fmt(L.ladder[h.questionLevel].points)} points secured</div>`;
    else if (h.locked != null) banner = `<div class="kbc-banner">🔒 Lock kiya jaaye…</div>`;
    const lifelines = `<div class="lifelines"><span class="${h.lifelines.fifty ? '' : 'used'}">50:50</span><span class="${h.lifelines.poll ? '' : 'used'}">📊</span><span class="${h.lifelines.phone ? '' : 'used'}">📞</span></div>`;
    const levelShown = h.questionLevel;
    const key = `hot-${h.pid}-${levelShown}-${h.qPhase}${h.qPhase === 'over' ? (h.status === 'won' ? '-won' : '-wrong') : ''}${h.qPhase === 'reveal' ? '-reveal' : ''}`;
    return [`<div class="gframe">${head}<div class="kbc"><div class="kbc-main">
      <div class="kbc-hot">${av(p)} ${esc(p ? p.name : '')} in the hot seat · Question ${levelShown + 1} for ${fmt(L.ladder[levelShown].points)}</div>
      <div class="kbc-q">${esc(q.q)}</div>${opts}${banner}${phone}
      </div><div class="kbc-side">${lifelines}${pollHtml && h.qPhase === 'question' ? pollHtml : ladderHtml(L, h.qPhase === 'over' ? -1 : levelShown, h.level)}</div></div></div>`, key];
  }

  // ---------- hook step ----------
  function hookScene(L) {
    const head = `<div class="ghead"><span class="pill gold">💃 ${esc(L.title)}</span>${L.phase === 'perform' || L.phase === 'voting' ? `<span class="count" data-count="${L.until}" data-tick="1"></span>` : ''}</div>`;
    const perf = L.perf;
    const who = perf ? perf.performer : null;
    const whoHtml = who ? `<div class="perf">${entAv(who)}<h1>${esc(who.name)}</h1>${perf.members ? `<div class="step">${perf.members.map(esc).join(' · ')}</div>` : ''}</div>` : '';
    if (L.phase === 'idle') {
      const res = L.results.length ? `<div class="list-card" style="width:60vw;margin-top:2vw;text-align:left"><h3>Performances so far</h3>${[...L.results].sort((a, b) => b.points - a.points).map((r) => `<div class="lrow">${entAv(r.performer)}${esc(r.performer.name)} <span class="small" style="opacity:.7">${esc(r.song)} · ${r.avg}★</span><span class="pts">+${r.points}</span></div>`).join('')}</div>` : '';
      return [`<div class="gframe">${head}<div class="hook"><div><div class="intro" style="height:auto"><div><div class="em">💃🕺</div><h1>Hook Step Challenge</h1><p>Spin a song · nail the hook step · the crowd rates you 1–5 diyas</p></div></div>${res}</div></div></div>`, 'hook-idle'];
    }
    if (L.phase === 'spin') {
      return [`<div class="gframe">${head}<div class="hook"><div class="perf">${whoHtml}<div class="slot" id="slot">🎵</div></div></div></div>`, 'spin'];
    }
    const song = perf.song;
    const songHtml = song ? `<div class="song">🎵 ${esc(song.title)}</div><div class="step">Hook step: <b>${esc(song.step)}</b></div>` : '<div class="song">🎵 Song: ???</div>';
    if (L.phase === 'ready') return [`<div class="gframe">${head}<div class="hook"><div class="perf">${whoHtml}${songHtml}<div class="step" style="opacity:.7">Get ready…</div></div></div></div>`, 'hook-ready-' + (who && who.key) + (song ? song.title : '')];
    if (L.phase === 'perform') return [`<div class="gframe">${head}${timerBar(L.startedAt, L.until)}<div class="hook"><div class="perf">${whoHtml}${songHtml}<div class="big-count" data-count="${L.until}"></div></div></div></div>`, 'hook-perform'];
    if (L.phase === 'voting' || L.phase === 'tally') return [`<div class="gframe">${head}<div class="hook"><div class="perf">${whoHtml}<h1 style="font-size:4vw">${L.phase === 'voting' ? 'Rate it on your phones! 🪔' : 'Votes are in…'}</h1><div class="song">${perf.votes} votes</div></div></div></div>`, 'hook-vote-' + L.phase];
    const last = L.last;
    const full = Math.round(last.avg);
    return [`<div class="gframe">${head}<div class="hook"><div class="perf">${entAv(last.performer)}<h1>${esc(last.performer.name)}</h1>
      <div class="stars-tv">${'🪔'.repeat(full)}<span style="opacity:.25">${'🪔'.repeat(5 - full)}</span></div>
      <div class="song">${last.avg} avg from ${last.votes} votes${last.judge ? ` + ${last.judge} judges' bonus` : ''}</div>
      <h1 style="color:var(--gold)" class="pop">+${last.points} points</h1></div></div></div>`, 'hook-scored-' + L.results.length];
  }

  function customScene(L) {
    const ps = S.players.slice(0, 10);
    return [`<div class="gframe"><div class="intro" style="height:auto;margin-top:2vw"><div><div class="em" style="font-size:7vw">${esc(L.emoji)}</div><h1>${esc(L.title)}</h1><p>${esc(L.description)}</p></div></div>
      <div class="lb-cols one">${ps.map((p) => `<div class="lb-row r${p.rank}"><span class="rk">${p.rank}</span>${av(p)}<span class="nm">${esc(p.name)}</span><span class="sc">${fmt(p.score)}</span></div>`).join('')}</div></div>`, 'custom'];
  }

  // Spin animation for the hook step slot machine
  setInterval(() => {
    const slot = document.getElementById('slot');
    if (!slot || !S || !S.live || S.live.type !== 'hookstep') return;
    const songs = S.live.songs;
    slot.textContent = '🎵 ' + songs[(Math.random() * songs.length) | 0].split(' — ')[0];
    App.sfx('tick');
  }, 120);

  // Re-render periodically so time-based states (phone-a-friend, announcements) update.
  setInterval(() => { if (S) render(); }, 1000);
})();
