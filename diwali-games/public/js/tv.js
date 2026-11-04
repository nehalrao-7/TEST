/* TV display — the stage everyone watches. */
(function () {
  const { esc, fmt } = App;
  const $ = (id) => document.getElementById(id);
  App.sparkles(50);
  $('diyaRow').innerHTML = Array.from({ length: 13 }, () => App.diya(true)).join('');

  let S = null;
  const prev = { sceneKey: null, buzzKey: null, players: null };
  const shownAnnounce = new Set();
  const lbAnimated = new Set();

  $('soundBtn').onclick = () => { App.enableSound(); App.sfx('arrive'); $('soundBtn').remove(); mediaSig = ''; syncMedia(); };
  App.onReact((r) => { App.showReaction(r); App.sfx('pop'); });

  // ---------- YouTube music / video ----------
  let yt = null, ytReady = false, mediaSig = '';
  window.onYouTubeIframeAPIReady = () => {
    yt = new YT.Player('ytPlayer', {
      width: '100%', height: '100%',
      playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1, fs: 0, iv_load_policy: 3 },
      events: { onReady: () => { ytReady = true; syncMedia(); } },
    });
  };
  function syncMedia() {
    const m = S && S.media;
    const playing = m && !m.stopped && m.videoId;
    $('mediaBox').classList.toggle('audio', !(playing && m.show));
    $('mediaLabel').textContent = playing ? '🎵 ' + (m.label || '') : '';
    const chip = $('musicChip');
    chip.classList.toggle('hidden', !(playing && !m.show));
    chip.classList.toggle('blocked', Boolean(playing && !App.soundOn));
    $('musicText').textContent = !playing ? '' : App.soundOn ? 'Now playing… listen closely!' : 'Music ready — click "enable sound" on the TV';
    if (!ytReady) return;
    const sig = playing ? `${m.key}|${m.nonce}|${m.videoId}|${m.start}|${m.end}` : 'none';
    if (sig === mediaSig) return;
    mediaSig = sig;
    if (!playing) { yt.stopVideo(); return; }
    const opts = { videoId: m.videoId, startSeconds: m.start || 0 };
    if (m.end) opts.endSeconds = m.end;
    yt.loadVideoById(opts);
    if (App.soundOn) { yt.unMute(); yt.setVolume(100); } else yt.mute();
  }

  App.connect('tv', null, (s) => { S = s; render(); });

  const player = (id) => S.players.find((p) => p.id === id);
  const team = (id) => S.teams.find((t) => t.id === id);
  const av = (p, cls = '') => `<span class="avatar ${cls}" style="--c:${p ? p.color : '#f7931e'}">${p ? esc(p.avatar) : '❔'}</span>`;
  const entAv = (e) => `<span class="avatar" style="--c:${e.color}">${esc(e.emoji)}</span>`;
  const timerBar = (start, end) => `<div class="timer" data-start="${start}" data-end="${end}"><i></i></div>`;
  const shapeK = (i) => `<span class="k"><span class="shape">${App.shapes[i] || ''}</span><span class="tick">✓</span></span>`;
  const joinUrl = () => location.origin + '/play';
  const flame = (n) => (n >= 2 ? ` <span class="flame-chip">🔥${n}</span>` : '');
  const medalCount = (deadline, start) => `<span class="medal burn" data-burn="${deadline}" data-burn-start="${start}"><span data-count="${deadline}" data-tick="1"></span></span>`;

  // Burning countdown rings
  (function burn() {
    document.querySelectorAll('[data-burn]').forEach((el) => {
      const e = Number(el.dataset.burn), s = Number(el.dataset.burnStart), t = App.now();
      const p = Math.max(0, Math.min(100, ((e - t) / (e - s)) * 100));
      el.style.setProperty('--p', p.toFixed(1));
      el.classList.toggle('low', e - t < 5500 && e - t > 0);
    });
    requestAnimationFrame(burn);
  })();

  function render() {
    document.title = `${S.eventName} — TV`;
    App.patch($('eventName'), S.eventName.split(' ').length > 2 ? esc(S.eventName).replace(/(\S+\s+\S+)$/, '<span>$1</span>') : esc(S.eventName));
    App.patch($('nowPlaying'), S.live ? `<span class="plaque">${esc(S.live.emoji)} ${esc(S.live.title)} · ${S.live.mode === 'team' ? 'Teams' : 'Solo'}</span>` : '');
    App.patch($('miniTop'), S.players.slice(0, 3).filter((p) => p.score > 0).map((p, i) => `<div class="m">${['🥇', '🥈', '🥉'][i]} ${av(p)} ${esc(p.name)} · ${fmt(p.score)}</div>`).join(''));
    App.patch($('ticker'), S.feed.length ? S.feed.map((f) => `<span>${esc(f.emoji || '✨')} ${esc(f.text)}</span>`).join('') : `<span>🪔 Shubh Deepavali! Join at <b>${esc(joinUrl())}</b></span><span>✨ Every guest gets secret power-ups…</span><span>📱 Send reactions from your phone — they float up right here!</span>`);
    detectArrivals();

    let view = S.tv.view;
    if (view === 'game' && !S.live) view = 'lobby';
    let html, key;
    if (view === 'lobby') [html, key] = [lobby(), 'lobby'];
    else if (view === 'leaderboard') [html, key] = leaderboard();
    else if (view === 'podium') [html, key] = [podium(), 'podium'];
    else if (view === 'teams') [html, key] = [teamsView(), 'teams'];
    else if (view === 'awards') [html, key] = awardsView();
    else [html, key] = gameScene();

    document.body.classList.toggle('in-game', view === 'game');
    const stage = $('stage');
    if (key !== prev.sceneKey) {
      stage.innerHTML = `<div class="scene enter"></div>`;
      prev.sceneKey = key;
      App.patch(stage.firstElementChild, html, true);
      onSceneChange(key);
    } else App.patch(stage.firstElementChild, html);
    renderAnnounce();
    syncMedia();
  }

  function onSceneChange(key) {
    if (/^lb/.test(key)) { App.sfx('drumroll'); setTimeout(() => runLeaderboard(key), 900); }
    else if (key === 'podium') { App.sfx('fanfare'); setTimeout(() => App.fireworks(2), 2200); setTimeout(() => App.fireworks(2), 3400); }
    else if (/^award-/.test(key)) {
      if (/-champ$/.test(key)) { App.sfx('drumroll'); setTimeout(() => { App.sfx('fanfare'); App.fireworks(2.5); }, 2100); }
      else if (/-intro$/.test(key)) App.sfx('fanfare');
      else { App.sfx('drumroll'); setTimeout(() => { App.sfx('ding'); App.fireworks(1); }, 2100); }
    } else if (/-reveal$/.test(key)) { App.sfx('drumroll'); setTimeout(() => { App.sfx('reveal'); App.fireworks(1); }, 1900); }
    else if (/answer-correct|scored|ff-result|-won/.test(key)) { App.sfx('reveal'); App.fireworks(0.8); }
    else if (/-wrong$/.test(key)) App.sfx('wrong');
    else if (/^q-|clue|spin|ff-q/.test(key)) App.sfx('whoosh');
  }

  // Grand entrance for every guest who joins (Jackbox-style).
  function detectArrivals() {
    const ids = S.players.map((p) => p.id);
    if (prev.players) {
      const fresh = S.players.filter((p) => !prev.players.includes(p.id));
      fresh.slice(0, 3).forEach((p, i) => setTimeout(() => {
        const el = $('arrival');
        el.classList.remove('hidden');
        el.innerHTML = `${av(p)} ${esc(p.name)} has arrived! 🎆`;
        el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
        App.sfx('arrive');
        App.fireworks(0.4);
        clearTimeout(el._h); el._h = setTimeout(() => el.classList.add('hidden'), 3200);
      }, i * 1400));
      prev.newIds = new Set(fresh.map((p) => p.id));
      setTimeout(() => { prev.newIds = new Set(); }, 6000);
    }
    prev.players = ids;
  }

  function renderAnnounce() {
    const a = S.tv.announce;
    const el = $('announce');
    if (a && a.until > App.now() && !shownAnnounce.has(a.id)) {
      shownAnnounce.add(a.id);
      el.className = 'announce ' + (a.kind || '');
      el.innerHTML = `<div class="box paper"><div class="em">${esc(a.emoji || '✨')}</div><h1>${esc(a.title)}</h1><p>${esc(a.text || '')}</p></div>`;
      App.sfx(a.kind === 'powerup' ? 'power' : 'fanfare');
      if (a.kind === 'powerup' || a.kind === 'end' || a.kind === 'start') App.fireworks(0.7);
      clearTimeout(el._h);
      el._h = setTimeout(() => el.classList.add('hidden'), Math.max(1500, a.until - App.now()));
    } else if (!a) el.classList.add('hidden');
  }

  // ---------------- lobby ----------------
  function lobby() {
    const url = joinUrl();
    const ps = S.players;
    const newIds = prev.newIds || new Set();
    return `<div class="lobby">
      <div>
        <div class="title-big">${esc(S.eventName.replace(/ Game Night$/i, '') || 'Diwali')}</div>
        <div class="title-hand">Game Night ✨</div>
        <div class="sub">Scan · verify your phone · unwrap your <b>secret power-ups</b> 🎁</div>
        <div class="join-box paper">
          <img src="/api/qr.svg?u=${encodeURIComponent(url)}" alt="QR code to join" />
          <div><div class="step">Scan or type on your phone</div><div class="url">${esc(url.replace(/^https?:\/\//, ''))}</div>
          <div class="games">${S.games.map((g) => esc(g.emoji)).join(' ')}</div></div>
        </div>
        ${S.questionnaire && S.questionnaire.open ? `<div class="q-note">📝 <b>${S.questionnaire.done}</b> of ${ps.length} guests have spilled the beans in “About me”. Some answers become tonight's questions 👀</div>` : ''}
      </div>
      <div>
        <div class="guest-head"><h2>The Guest List</h2><span class="hand-note">${ps.length} ${ps.length === 1 ? 'diya' : 'diyas'} lit</span></div>
        <div class="lobby-players">${ps.map((p) => `<div class="pl ${p.online ? '' : 'off'} ${newIds.has(p.id) ? 'new' : ''}">${av(p)}<span class="nm">${esc(p.name)}</span>${App.diya(p.online)}</div>`).join('') || '<div class="empty">The diyas are waiting… be the first to light one! 🪔</div>'}</div>
      </div>
    </div>`;
  }

  // ---------------- leaderboard (FLIP: rows slide from old places to new) ----------------
  function lbLayout(n) {
    const cols = n > 8 ? 2 : 1;
    const perCol = Math.ceil(n / cols);
    const h = Math.min(5.2, 52 / Math.max(perCol, 1)); // vh-ish units in vw
    return { cols, perCol, h };
  }
  function leaderboard() {
    const ps = S.players;
    const snap = S.snapshot && !S.snapshot.every((x) => x.score === 0) ? S.snapshot : null;
    const key = 'lb-' + (S.tv.compareGameId || 'x') + '-' + ps.length;
    const animate = snap && !lbAnimated.has(key);
    const oldOrder = snap ? [...ps].sort((a, b) => {
      const ra = snap.find((x) => x.id === a.id), rb = snap.find((x) => x.id === b.id);
      return (ra ? ra.rank : 999) - (rb ? rb.rank : 999) || ((ra && ra.score) || 0) - ((rb && rb.score) || 0);
    }) : ps;
    const { cols, perCol, h } = lbLayout(ps.length);
    const pos = (idx) => ({ x: cols === 2 ? (idx < perCol ? '0%' : '51%') : '17%', w: cols === 2 ? '49%' : '66%', y: `${(idx % perCol) * (h + 0.6)}vw` });
    let climber = null;
    ps.forEach((p) => {
      const b = snap && snap.find((x) => x.id === p.id);
      const d = b ? b.rank - p.rank : 0;
      if (d >= 2 && (!climber || d > climber.d)) climber = { p, d };
    });
    const rows = ps.map((p, i) => {
      const t = p.teamId && team(p.teamId);
      const before = snap && snap.find((x) => x.id === p.id);
      const d = before ? before.rank - p.rank : 0;
      const mv = !snap ? '' : !before ? '<span class="mv up">NEW</span>' : d > 0 ? `<span class="mv up">▲${d}</span>` : d < 0 ? `<span class="mv down">▼${-d}</span>` : '<span class="mv same">●</span>';
      const start = animate ? pos(oldOrder.indexOf(p)) : pos(i);
      const end = pos(i);
      const scoreFrom = animate && before ? before.score : p.score;
      return `<div class="lb-row r${p.rank} ${!animate && climber && climber.p.id === p.id ? 'climber' : ''}" data-pid="${p.id}" data-x="${end.x}" data-w="${end.w}" data-y="${end.y}" data-to="${p.score}" data-from="${scoreFrom}" style="--x:${start.x};--w:${start.w};--y:${start.y};--h:${h}vw">
        <span class="rk">${p.rank}</span>${mv}${av(p)}<span class="nm">${esc(p.name)}</span>
        ${t ? `<span class="team" style="background:${t.color}">${esc(t.emoji)} ${esc(t.name.replace('Team ', ''))}</span>` : ''}
        <span class="sc">${fmt(scoreFrom)}</span></div>`;
    }).join('');
    const teams = S.teams.length ? `<div class="teams-strip">${[...S.teams].sort((a, b) => b.total - a.total).map((t) => `<span class="t" style="--tc:${t.color}">${esc(t.emoji)} ${esc(t.name)} · ${fmt(t.total)} avg</span>`).join('')}</div>` : '';
    const banner = climber ? `<div class="climb-banner later" style="--d:${animate ? 2.6 : 0}s">📈 ${esc(climber.p.name)} climbs ${climber.d} places!</div>` : '';
    prev.climber = climber && climber.p.id;
    return [`<div class="lb"><div class="lb-title">${App.diya(true, 56)}<h1>The Standings</h1>${App.diya(true, 56)}</div>${teams}<div class="lb-board">${rows || '<p class="center">No players yet</p>'}</div>${banner}</div>`, key];
  }
  function runLeaderboard(key) {
    if (lbAnimated.has(key) || !document.querySelector('.lb-row[data-from]')) { App.fireworks(0.8); return; }
    // Mark done only after the slide finishes, so a re-render can't cut the animation short.
    setTimeout(() => lbAnimated.add(key), 1800);
    App.sfx('whoo');
    document.querySelectorAll('.lb-row').forEach((el) => {
      el.style.setProperty('--x', el.dataset.x);
      el.style.setProperty('--w', el.dataset.w);
      el.style.setProperty('--y', el.dataset.y);
      App.countUp(el.querySelector('.sc'), Number(el.dataset.to), 1300, Number(el.dataset.from));
      if (el.dataset.pid === prev.climber) setTimeout(() => el.classList.add('climber'), 1400);
    });
    setTimeout(() => { App.sfx('fanfare'); App.fireworks(1); }, 1450);
  }

  function podium() {
    const top = S.players.slice(0, 3);
    const order = [top[1], top[0], top[2]];
    const cls = ['p2', 'p1', 'p3'];
    return `<div class="podium"><h1>Champions of the Night</h1><div class="pods">${order.map((p, i) => p ? `<div class="pod ${cls[i]}">${av(p)}<div class="nm">${esc(p.name)}</div><div class="sc">${fmt(p.score)} pts</div><div class="blk">${cls[i][1]}</div></div>` : '<div class="pod"></div>').join('')}</div></div>`;
  }

  function teamsView() {
    if (!S.teams.length) return `<div class="intro"><div><div class="em">🎲</div><h1>Teams coming up…</h1></div></div>`;
    return `<div class="gframe"><div class="intro" style="height:auto"><h1 style="font-size:3.8vw;margin:0">Tonight's Teams</h1></div><div class="teams-grid">${S.teams.map((t, i) => `<div class="team-card paper" style="--tc:${t.color};animation-delay:${i * 0.15}s"><div class="th"><span>${esc(t.emoji)} ${esc(t.name)}</span><span>${fmt(t.total)}</span></div><div class="tb">${t.members.map((id) => { const p = player(id); return p ? `<div class="lrow">${av(p)} ${esc(p.name)}</div>` : ''; }).join('')}</div></div>`).join('')}</div></div>`;
  }

  // ---------------- Diwali Awards ----------------
  function awardsView() {
    const list = S.awards || [];
    const i = S.tv.awardIndex || 0;
    const dots = `<div class="award-dots">${Array.from({ length: list.length + 2 }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>`;
    if (i === 0) {
      return [`<div class="awards"><div class="award-card paper"><div class="kicker">and now, the moment you've all been waiting for…</div><div class="medal">🏆</div>
        <h1>The Diwali Awards</h1><div class="desc">${list.length} awards · one champion · zero chill</div>${dots}</div></div>`, 'award-intro'];
    }
    if (i > list.length) {
      const champ = S.players[0];
      return [`<div class="awards"><div class="award-card paper"><div class="kicker">the brightest diya of the night</div><div class="medal">🪔</div>
        <h1>Light of the Party</h1><div class="drumline">drumroll please… 🥁</div>
        ${champ ? `<div class="winners"><div class="winner">${av(champ)}<b>${esc(champ.name)}</b></div></div><div class="value">${fmt(champ.score)} points · Shubh Deepavali! 🎆</div>` : ''}${dots}</div></div>`, 'award-champ'];
    }
    const a = list[i - 1];
    return [`<div class="awards"><div class="award-card paper"><div class="kicker">award ${i} of ${list.length}</div><div class="medal">${esc(a.emoji)}</div>
      <h1>${esc(a.title)}</h1><div class="desc">${esc(a.desc)}</div><div class="drumline">and it goes to… 🥁</div>
      <div class="winners">${a.winners.map((w) => `<div class="winner">${av(w)}<b>${esc(w.name)}</b></div>`).join('')}</div>
      <div class="value">${esc(a.value)}</div>${dots}</div></div>`, 'award-' + a.id];
  }

  // ---------------- games ----------------
  function gameScene() {
    const L = S.live;
    const fn = { quiz: quizScene, jeopardy: jeopardyScene, kbc: kbcScene, hookstep: hookScene, custom: customScene }[L.type];
    return fn(L);
  }
  const intro = (L, sub, rules = []) => `<div class="intro"><div><div class="em">${esc(L.emoji)}</div><h1>${esc(L.title)}</h1><p>${sub}</p>${rules.length ? `<div class="rules">${rules.map((r) => `<span>${r}</span>`).join('')}</div>` : ''}</div></div>`;
  const lockins = (ids) => {
    const on = new Set(ids || []);
    return `<div class="lockins">${S.players.filter((p) => p.online || on.has(p.id)).map((p) => `<div class="lk ${on.has(p.id) ? 'on' : ''}">${av(p)}${App.diya(on.has(p.id))}<small>${esc(p.name)}</small></div>`).join('')}</div>`;
  };

  function quizScene(L) {
    if (L.phase === 'intro') return [intro(L, 'Answer on your phone — match the colour and the shape!', [`${L.total} questions`, L.mode === 'team' ? '👥 teams score their average' : '⚡ faster = more points', '🔥 3 in a row = streak bonus']), 'q-intro'];
    if (L.phase === 'final') return [intro({ ...L, emoji: '🎆' }, 'Round complete! The standings are coming up…'), 'q-final'];
    const q = L.question;
    const head = `<div class="ghead"><span class="pill gold">Q ${L.qIndex + 1} / ${L.total}</span><span class="pill">${esc(L.title)}</span>${q && q.personal ? '<span class="pill personal">✨ About our guests</span>' : ''}
      ${L.phase === 'question' && App.now() >= L.opensAt ? medalCount(L.deadline, L.opensAt) : ''}</div>`;
    const qcard = `<div class="qcard paper">${q.clue ? `<div class="clue">${esc(q.clue)}</div>` : ''}${q.image ? `<img class="qimg" src="${esc(q.image)}" alt=""/>` : ''}<div class="q">${esc(q.q)}</div></div>`;

    if (L.phase === 'question') {
      const waiting = App.now() < L.opensAt;
      if (waiting) setTimeout(render, L.opensAt - App.now() + 30);
      const opts = waiting
        ? `<div class="countdown-big" data-count="${L.opensAt}"></div>`
        : `<div class="opts">${q.options.map((o, i) => `<div class="opt o${i}">${shapeK(i)}${esc(o)}</div>`).join('')}</div>`;
      return [`<div class="gframe">${head}${waiting ? '' : timerBar(L.opensAt, L.deadline)}${qcard}${opts}${lockins(L.answeredIds)}</div>`, `q-${L.qIndex}${waiting ? '-w' : ''}`];
    }
    // reveal — staged: drumroll, wrong ones drop out one by one, the right one ignites
    const r = L.result;
    const total = r.counts.reduce((a, b) => a + b, 0) || 1;
    const wrong = q.options.map((_, i) => i).filter((i) => i !== r.answer);
    const opts = `<div class="opts reveal">${q.options.map((o, i) => {
      const cls = i === r.answer ? 'win' : 'out';
      const d = i === r.answer ? 1.8 : 0.5 + wrong.indexOf(i) * 0.4;
      const faces = (r.byChoice && r.byChoice[i] || []).slice(0, 8).map((pid) => av(player(pid))).join('');
      return `<div class="opt o${i} ${cls}" style="--d:${d}s">${shapeK(i)}<span>${esc(o)}</span><span class="faces later" style="--d:2.3s">${faces}</span><span class="n later" style="--d:2.3s">${r.counts[i]}</span><span class="bar" style="width:${(r.counts[i] / total) * 100}%;--d2:2.3s"></span></div>`;
    }).join('')}<div class="drum">🥁 Sahi jawab hai…</div></div>`;
    let side;
    if (L.mode === 'team') {
      const ts = S.teams.map((t) => ({ t, pts: r.perTeam[t.id] || 0 })).sort((a, b) => b.pts - a.pts);
      side = `<div class="list-card later" style="--d:2.5s"><h3>Team points</h3>${ts.map(({ t, pts }) => `<div class="lrow"><span class="avatar" style="--c:${t.color}">${esc(t.emoji)}</span>${esc(t.name)}<span class="pts">+${pts}</span></div>`).join('')}</div>`;
    } else {
      const fires = Object.entries(r.streaks || {}).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3);
      side = `<div class="list-card later" style="--d:2.5s"><h3>⚡ Bijli fingers</h3>${r.fastest.map((f) => { const p = player(f.id); return p ? `<div class="lrow">${av(p)}${esc(p.name)}${flame((r.streaks || {})[f.id])} <span class="small" style="opacity:.7">${(f.ms / 1000).toFixed(1)}s</span><span class="pts">+${f.points}${p.double ? ' ×2' : ''}</span></div>` : ''; }).join('') || '<div class="lrow">Nobody got it! 😱</div>'}
        ${fires.length ? `<h3 style="margin-top:1vw">🔥 On fire</h3>${fires.map(([pid, n]) => { const p = player(pid); return p ? `<div class="lrow">${av(p)}${esc(p.name)}<span class="pts">${n} in a row · +50</span></div>` : ''; }).join('')}` : ''}</div>`;
    }
    return [`<div class="gframe">${head}${qcard}<div class="reveal-side">${opts}${side}</div></div>`, `q-${L.qIndex}-reveal`];
  }

  function jeopardyScene(L) {
    const head = `<div class="ghead"><span class="pill gold">🧠 ${esc(L.title)}</span><span class="pill">${L.mode === 'team' ? 'Teams' : 'Solo'} · buzz on your phone</span></div>`;
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
      ${answer && correct ? `<div class="buzz-now" style="animation:none;margin-top:1vw">+${L.last.value} to ${esc(L.last.info.name)}!</div>` : ''}</div>`;
    return [`<div class="gframe">${head}<div class="jclue"><div class="qcard paper"><div class="cat">${esc(c.category)} · ${c.value}</div><div class="q">${esc(c.q)}</div>${answer ? `<div class="ans pop">✨ ${esc(c.a)}</div>` : ''}</div>${side}</div></div>`, `j-clue-${L.cur.c}-${L.cur.i}${answer ? (correct ? '-answer-correct' : '-answer') : ''}`];
  }

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
      const opts = waiting ? `<div class="countdown-big" data-count="${f.opensAt}"></div>` : `<div class="kbc-opts">${q.options.map((o, i) => `<div class="kbc-opt ${res ? (i === res.answer ? 'right' : '') : ''}"><span class="k">${App.letters[i]}:</span>${esc(o)}${res ? `<span class="pc">${res.counts[i]}</span>` : ''}</div>`).join('')}</div>`;
      const side = res
        ? `<div class="list-card"><h3>⚡ Fastest correct</h3>${res.ranking.slice(0, 8).map((r, i) => { const p = player(r.id); return p ? `<div class="lrow" ${i === 0 ? 'style="color:var(--haldi)"' : ''}>${i === 0 ? '👑' : i + 1 + '.'} ${av(p)}${esc(p.name)}<span class="pts">${(r.ms / 1000).toFixed(2)}s</span></div>` : ''; }).join('') || '<div class="lrow">Nobody got it right!</div>'}</div>`
        : `<div class="list-card"><h3>Fastest Finger First</h3>${lockins(f.answeredIds)}</div>`;
      return [`<div class="gframe">${head}${L.phase === 'ff' && !waiting ? timerBar(f.opensAt, f.deadline) : ''}<div class="kbc"><div class="kbc-main"><div class="kbc-banner">FASTEST FINGER FIRST ${L.phase === 'ff' && !waiting ? `· <span data-count="${f.deadline}" data-tick="1"></span>` : ''}</div><div class="kbc-q">${esc(q.q)}</div>${opts}</div>${side}</div></div>`, `ff-q-${L.ff.question.q}${res ? '-ff-result' : ''}${waiting ? '-w' : ''}`];
    }
    const h = L.hot;
    const p = player(h.pid);
    const q = h.question;
    const pollHtml = h.poll ? (() => {
      const total = h.poll.counts.reduce((a, b) => a + b, 0) || 1;
      return `<div class="list-card"><h3>📊 Audience Poll${h.poll.open ? ` · <span data-count="${h.poll.deadline}"></span>s` : ''}</h3><div class="small" style="margin:-.6vw 0 .6vw;opacity:.8">${h.poll.votes} votes</div><div class="poll">${h.poll.counts.map((c, i) => `<div class="b"><span>${Math.round((c / total) * 100)}%</span><i style="height:${(c / total) * 100}%"></i><span>${App.letters[i]}</span></div>`).join('')}</div></div>`;
    })() : '';
    const phone = h.phoneUntil && h.phoneUntil > App.now() ? `<div class="kbc-banner">📞 Phone a friend · <span data-count="${h.phoneUntil}" data-tick="1"></span>s</div>` : '';
    const opts = `<div class="kbc-opts">${q.options.map((o, i) => {
      let cls = '';
      if (h.removed.includes(i)) cls = 'gone';
      else if (h.answer != null && i === h.answer) cls = 'right';
      else if (h.answer != null && i === h.locked) cls = 'wrong';
      else if (h.locked === i) cls = 'locked';
      return `<div class="kbc-opt ${cls}"><span class="k">${App.letters[i]}:</span>${esc(o)}</div>`;
    }).join('')}</div>`;
    let banner = '';
    if (h.qPhase === 'over') banner = `<div class="kbc-banner pop" style="font-size:3vw">${h.status === 'won' ? '🏆 CROREPATI! ' : h.status === 'walked' ? '🚶 Walked away with ' : '💔 Takes home '}${fmt(h.winnings)} points</div>`;
    else if (h.qPhase === 'reveal' && h.correct) banner = `<div class="kbc-banner pop" style="font-size:3vw">✅ Sahi jawab! ${fmt(L.ladder[h.questionLevel].points)} points secured</div>`;
    else if (h.locked != null) banner = `<div class="kbc-banner">🔒 Lock kiya jaaye…</div>`;
    const lifelines = `<div class="lifelines"><span class="${h.lifelines.fifty ? '' : 'used'}">50:50</span><span class="${h.lifelines.poll ? '' : 'used'}">📊</span><span class="${h.lifelines.phone ? '' : 'used'}">📞</span></div>`;
    const lvl = h.questionLevel;
    const key = `hot-${h.pid}-${lvl}-${h.qPhase}${h.qPhase === 'over' ? (h.status === 'won' ? '-won' : '-wrong') : ''}${h.qPhase === 'reveal' ? '-reveal-kbc' : ''}`;
    return [`<div class="gframe">${head}<div class="kbc"><div class="kbc-main">
      <div class="kbc-hot">${av(p)} ${esc(p ? p.name : '')} in the hot seat · Question ${lvl + 1} for ${fmt(L.ladder[lvl].points)}${q.personal ? ' · <span class="pill personal">✨ About our guests</span>' : ''}</div>
      <div class="kbc-q">${esc(q.q)}</div>${opts}${banner}${phone}
      </div><div class="kbc-side">${lifelines}${pollHtml && h.qPhase === 'question' ? pollHtml : ladderHtml(L, h.qPhase === 'over' ? -1 : lvl, h.level)}</div></div></div>`, key];
  }

  function hookScene(L) {
    const head = `<div class="ghead"><span class="pill gold">💃 ${esc(L.title)}</span>${L.phase === 'perform' || L.phase === 'voting' ? medalCount(L.until, L.startedAt) : ''}</div>`;
    const perf = L.perf;
    const who = perf ? perf.performer : null;
    const whoHtml = who ? `<div class="perf">${entAv(who)}<h1>${esc(who.name)}</h1>${perf.members ? `<div class="step">${perf.members.map(esc).join(' · ')}</div>` : ''}</div>` : '';
    if (L.phase === 'idle') {
      const res = L.results.length ? `<div class="list-card" style="width:60vw;margin-top:2vw;text-align:left"><h3>Performances so far</h3>${[...L.results].sort((a, b) => b.points - a.points).map((r) => `<div class="lrow">${entAv(r.performer)}${esc(r.performer.name)} <span class="small" style="opacity:.7">${esc(r.song)} · ${r.avg}★</span><span class="pts">+${r.points}</span></div>`).join('')}</div>` : '';
      return [`<div class="gframe">${head}<div class="hook"><div>${intro({ emoji: '💃', title: L.title }, 'Spin a song · nail the hook step · the crowd rates you 1–5 diyas')}${res}</div></div></div>`, 'hook-idle'];
    }
    if (L.phase === 'spin') return [`<div class="gframe">${head}<div class="hook"><div class="perf">${whoHtml}<div class="slot paper" id="slot">🎵</div></div></div></div>`, 'spin'];
    const song = perf.song;
    const songHtml = song ? `<div class="song">🎵 ${esc(song.title)}</div><div class="step">Hook step: <b>${esc(song.step)}</b></div>` : '<div class="song">🎵 Song: ???</div>';
    if (L.phase === 'ready') return [`<div class="gframe">${head}<div class="hook"><div class="perf">${whoHtml}${songHtml}<div class="hand-note">Get ready… 💫</div></div></div></div>`, 'hook-ready-' + (who && who.key) + (song ? song.title : '')];
    if (L.phase === 'perform') return [`<div class="gframe">${head}${timerBar(L.startedAt, L.until)}<div class="hook"><div class="perf">${whoHtml}${songHtml}<div class="big-count" data-count="${L.until}"></div></div></div></div>`, 'hook-perform'];
    if (L.phase === 'voting' || L.phase === 'tally') return [`<div class="gframe">${head}<div class="hook"><div class="perf">${whoHtml}<h1 style="font-size:4vw">${L.phase === 'voting' ? 'Rate it on your phones! 🪔' : 'Votes are in…'}</h1><div class="song">${perf.votes} votes</div></div></div></div>`, 'hook-vote-' + L.phase];
    const last = L.last;
    const full = Math.round(last.avg);
    return [`<div class="gframe">${head}<div class="hook"><div class="perf">${entAv(last.performer)}<h1>${esc(last.performer.name)}</h1>
      <div class="stars-tv">${'🪔'.repeat(full)}<span style="opacity:.25">${'🪔'.repeat(5 - full)}</span></div>
      <div class="song">${last.avg} avg from ${last.votes} votes${last.judge ? ` + ${last.judge} judges' bonus` : ''}</div>
      <h1 style="color:var(--haldi)" class="pop">+${last.points} points</h1></div></div></div>`, 'hook-scored-' + L.results.length];
  }

  function customScene(L) {
    const ps = S.players.slice(0, 8);
    return [`<div class="gframe">${intro(L, esc(L.description))}<div class="lockins">${ps.map((p) => `<div class="lk on">${av(p)}<small>${esc(p.name)} · ${fmt(p.score)}</small></div>`).join('')}</div></div>`, 'custom'];
  }

  // Slot-machine spin for the hook step
  setInterval(() => {
    const slot = document.getElementById('slot');
    if (!slot || !S || !S.live || S.live.type !== 'hookstep') return;
    const songs = S.live.songs;
    slot.textContent = '🎵 ' + songs[(Math.random() * songs.length) | 0].split(' — ')[0];
    App.sfx('tick');
  }, 120);

  setInterval(() => { if (S) render(); }, 1000);
})();
