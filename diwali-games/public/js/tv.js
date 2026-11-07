/* TV display — the stage everyone watches. */
(function () {
  const { esc, fmt } = App;
  const $ = (id) => document.getElementById(id);
  App.sparkles(16);
  $('diyaRow').innerHTML = Array.from({ length: 13 }, () => App.diya(true)).join('');

  let S = null;
  const prev = { sceneKey: null, buzzKey: null, players: null };
  const shownAnnounce = new Set();
  const lbAnimated = new Set();

  function unlockYouTube() {
    App.enableSound();
    if ($('soundBtn')) $('soundBtn').remove();
    if (ytReady && yt) {
      try { yt.unMute(); yt.setVolume(100); yt.playVideo(); } catch { /* the clip starts on the next sync */ }
    }
  }
  $('soundBtn').onclick = () => { unlockYouTube(); App.sfx('arrive'); mediaSig = ''; syncMedia(); };
  document.addEventListener('pointerdown', () => unlockYouTube(), { once: true });
  App.onReact((r) => { if (r.room && App.room && r.room !== App.room) return; App.showReaction(r); App.sfx('pop'); });

  // ---------- YouTube music / video ----------
  // YouTube rejects the player (error 153) unless the embed request carries a Referer.
  const createEl = document.createElement.bind(document);
  document.createElement = function (tag, options) {
    const el = createEl(tag, options);
    if (String(tag).toLowerCase() === 'iframe') el.referrerPolicy = 'strict-origin-when-cross-origin';
    return el;
  };
  let yt = null, ytReady = false, mediaSig = '';
  window.onYouTubeIframeAPIReady = () => {
    yt = new YT.Player('ytPlayer', {
      width: '100%', height: '100%',
      playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1, fs: 0, iv_load_policy: 3 },
      events: {
        onReady: () => {
          ytReady = true;
          const frame = yt.getIframe && yt.getIframe();
          if (frame) frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
          syncMedia();
          requestAnimationFrame(fitPlayer);
          setTimeout(fitPlayer, 400);
        },
      },
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
    if (ytReady) {
      const sig = playing ? `${m.key}|${m.nonce}|${m.videoId}|${m.start}|${m.end}` : 'none';
      if (sig !== mediaSig) {
        mediaSig = sig;
        if (!playing) yt.stopVideo();
        else {
          const opts = { videoId: m.videoId, startSeconds: m.start || 0 };
          if (m.end) opts.endSeconds = m.end;
          yt.loadVideoById(opts);
          hearYouTube(hookLive());
          requestAnimationFrame(fitPlayer);
          setTimeout(fitPlayer, 500);
        }
      }
    }
    syncHookVeil();
  }

  function hookLive() {
    const L = S && S.live;
    const m = S && S.media;
    return Boolean(L && L.type === 'hookstep' && m && !m.stopped && m.videoId && m.show && (L.phase === 'perform' || L.phase === 'judge'));
  }
  function hearYouTube(on) {
    if (!ytReady || !yt) return;
    try {
      if (on || App.soundOn) { yt.unMute(); yt.setVolume(100); }
      else yt.mute();
    } catch { /* the player is still starting */ }
  }

  // The iframe API sizes itself once. Tell it the box it should fill after the layout changes.
  function fitPlayer() {
    if (!ytReady || !yt || !yt.setSize) return false;
    const box = $('mediaBox');
    const w = box.clientWidth;
    const h = box.clientHeight;
    const full = hookLive();
    if (full && (w < window.innerWidth * 0.9 || h < window.innerHeight * 0.9)) return false;
    if (w < 20 || h < 20) return false;
    try { yt.setSize(w, h); return true; } catch { return false; }
  }

  let hookFit = false;
  let playerFitted = false;
  // Hook Step fills the screen. A blur sits on top until the dance clock hits zero, then lifts. The clip keeps playing.
  function syncHookVeil() {
    const box = $('mediaBox');
    const L = S && S.live;
    const hook = hookLive();
    const dancing = hook && L.phase === 'perform' && App.now() < L.until;
    box.classList.toggle('hook-veiled', dancing);
    document.body.classList.toggle('hook-screen', hook);
    document.body.classList.toggle('hook-dancing', Boolean(hook && L.phase === 'perform'));
    if (hook !== hookFit) {
      hookFit = hook;
      playerFitted = false;
      if (hook && $('soundBtn')) $('soundBtn').textContent = '🔊 Tap once to play the video with sound';
    }
    if (hook && !playerFitted) playerFitted = fitPlayer();
    if (!hook) playerFitted = false;
    if (hook) {
      $('mediaLabel').textContent = '';
      if (!syncHookVeil.heard || App.now() - syncHookVeil.heard > 1000) {
        syncHookVeil.heard = App.now();
        hearYouTube(true);
      }
    }
  }

  let sock = null;
  function readTvSecret() {
    const q = new URLSearchParams(location.search).get('tv') || '';
    if (q) { try { sessionStorage.setItem('dgn_tv_secret', q); } catch { /* private mode */ } return q; }
    try { return sessionStorage.getItem('dgn_tv_secret') || ''; } catch { return ''; }
  }
  function enterRoom(code) {
    App.room = code;
    App.tvSecret = readTvSecret();
    try { localStorage.setItem('dgn_tv_room', code); } catch { /* private mode */ }
    const qs = '?room=' + encodeURIComponent(code) + (App.tvSecret ? '&tv=' + encodeURIComponent(App.tvSecret) : '');
    history.replaceState(null, '', '/tv' + qs);
    document.body.classList.remove('tv-gate');
    if (sock) sock.disconnect();
    sock = App.connect('tv', null, (s) => { S = s; render(); }, (msg) => {
      try { localStorage.removeItem('dgn_tv_room'); } catch { /* ignore */ }
      App.room = '';
      showGate(msg);
    });
  }
  function showGate(msg) {
    document.body.classList.add('tv-gate');
    $('stage').innerHTML = `<div class="gate"><div class="em">${App.diya(true)}</div><h1>Open the TV</h1><p>Use the TV link from the host console. The room code alone does not open this screen.</p>
      <p class="fine">Dance videos play from YouTube. Fonts load from Google. Live updates may use Supabase.</p>
      ${msg ? `<p class="gate-err">${esc(msg)}</p>` : ''}</div>`;
  }
  function bootTv() {
    const code = App.roomFromQuery() || App.canonRoom((() => { try { return localStorage.getItem('dgn_tv_room'); } catch { return ''; } })());
    const secret = readTvSecret();
    if (!code || !secret) showGate();
    else enterRoom(code);
  }
  bootTv();

  const player = (id) => S.players.find((p) => p.id === id);
  const team = (id) => S.teams.find((t) => t.id === id);
  const av = (p, cls = '') => `<span class="avatar ${cls}" style="--c:${p ? p.color : '#f7931e'}">${p ? esc(p.avatar) : '❔'}</span>`;
  const entAv = (e) => `<span class="avatar" style="--c:${e.color}">${esc(e.emoji)}</span>`;
  const timerBar = (start, end) => `<div class="timer" data-start="${start}" data-end="${end}"><i></i></div>`;
  const shapeK = (i) => `<span class="k"><span class="shape">${App.shapes[i] || ''}</span><span class="tick">✓</span></span>`;
  const joinUrl = () => location.origin + '/play?room=' + encodeURIComponent(App.room || (S && S.code) || '');
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
    if (S && S.live && S.live.type === 'hookstep') syncHookVeil();
    requestAnimationFrame(burn);
  })();

  function render() {
    document.title = `${S.eventName} — TV`;
    App.patch($('eventName'), S.eventName.split(' ').length > 2 ? esc(S.eventName).replace(/(\S+\s+\S+)$/, '<span>$1</span>') : esc(S.eventName));
    App.patch($('nowPlaying'), S.live ? `<span class="plaque">${esc(S.live.emoji)} ${esc(S.live.title)} · ${S.live.mode === 'team' ? 'Teams' : 'Solo'}${S.live.difficultyName ? ' · ' + esc(S.live.difficultyName) : ''}${S.live.practice ? ' · 🧪 Practice' : ''}</span>` : `<span class="plaque">Room ${esc(S.code || '')}</span>`);
    const mini = S.live && S.live.mode === 'team' && S.teams.length
      ? [...S.teams].sort((a, b) => (b.gamePoints - a.gamePoints) || (b.total - a.total)).filter((t) => (t.gamePoints || t.total) > 0).slice(0, 3)
        .map((t, i) => `<div class="m">${['🥇', '🥈', '🥉'][i]} <span class="avatar" style="--c:${t.color}">${esc(t.emoji)}</span> ${esc(String(t.name).replace(/^Team /, ''))} · ${fmt(t.gamePoints || t.total)}</div>`).join('')
      : S.players.slice(0, 3).filter((p) => p.score > 0).map((p, i) => `<div class="m">${['🥇', '🥈', '🥉'][i]} ${av(p)} ${esc(p.name)} · ${fmt(p.score)}</div>`).join('');
    App.patch($('miniTop'), mini);
    const line = S.feed[0];
    App.patch($('ticker'), line
      ? `<span class="chyron">${esc(line.emoji || '✨')} ${esc(line.text)}</span>`
      : `<span class="chyron">Room <b>${esc(S.code || '')}</b></span>`);
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
    document.body.classList.toggle('show-diyas', view === 'lobby');
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
    else if (key === 'podium') { App.sfx('fanfare'); setTimeout(() => App.fireworks(1.1, 'sky'), 2200); }
    else if (/^award-/.test(key)) {
      if (/-champ$/.test(key)) { App.sfx('drumroll'); setTimeout(() => { App.sfx('fanfare'); App.fireworks(1.15, 'sky'); }, 2100); }
      else if (/-intro$/.test(key)) App.sfx('fanfare');
      else { App.sfx('drumroll'); setTimeout(() => { App.sfx('ding'); App.fireworks(0.55, 'sides'); }, 2100); }
    } else if (/-reveal$/.test(key)) { App.sfx('drumroll'); setTimeout(() => { App.sfx('reveal'); App.fireworks(0.5, 'sides'); }, 2400); }
    else if (/answer-correct|scored|ff-result|-won/.test(key)) { App.sfx('reveal'); App.fireworks(0.45, 'sides'); }
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
    const showing = a && a.until > App.now() && a.kind !== 'end' && a.style === 'lower';
    document.body.classList.toggle('has-lower', Boolean(showing));
    if (a && a.until > App.now() && !shownAnnounce.has(a.id)) {
      shownAnnounce.add(a.id);
      if (a.kind === 'end') { el.classList.add('hidden'); return; }
      const style = a.style === 'lower' ? 'lower' : 'bumper';
      el.className = `announce ${style} ${a.kind || ''}`;
      el.innerHTML = style === 'lower'
        ? `<div class="box"><div class="em">${esc(a.emoji || '✨')}</div><div><h1>${esc(a.title)}</h1><p>${esc(a.text || '')}</p></div></div>`
        : `<div class="box paper"><div class="em">${esc(a.emoji || '✨')}</div><h1>${esc(a.title)}</h1><p>${esc(a.text || '')}</p></div>`;
      App.sfx(a.kind === 'powerup' ? 'power' : 'fanfare');
      clearTimeout(el._h);
      el._h = setTimeout(() => el.classList.add('hidden'), Math.max(800, a.until - App.now()));
    } else if (!a) el.classList.add('hidden');
  }

  // ---------------- lobby ----------------
  function lobby() {
    const url = joinUrl();
    const ps = S.players;
    const newIds = prev.newIds || new Set();
    return `<div class="lobby">
      <div class="lobby-hero">
        <div class="tv-mascot">${App.mascot()}</div>
        <div class="title-big">${esc(S.eventName.replace(/ Game Night$/i, '') || 'Diwali')}</div>
        <div class="title-hand">Game Night ✨</div>
        <div class="sub">Type the room code on your phone. Your score stays in this room.</div>
        <div class="join-box paper">
          <img src="/api/qr.svg?u=${encodeURIComponent(url)}" alt="QR code to join" />
          <div><div class="step">Room code</div><div class="room-code">${esc(S.code || '')}</div>
          <div class="games">${S.games.map((g) => esc(g.emoji)).join(' ')}</div></div>
        </div>
        ${S.questionnaire && S.questionnaire.open && ps.length ? `<div class="q-note">📝 <b>${S.questionnaire.done}</b> of ${ps.length} guests have answered. Some of those answers become tonight's questions.</div>` : ''}
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
    const h = Math.min(4.15, 32 / Math.max(perCol, 1));
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
    const fin = S.tv.announce && S.tv.announce.kind === 'end' && S.tv.announce.until > App.now()
      ? `<div class="lb-kicker">${esc(S.tv.announce.title)} · ${esc(S.tv.announce.text || '')}</div>` : '';
    const banner = climber ? `<div class="climb-banner later" style="--d:${animate ? 2.6 : 0}s">📈 ${esc(climber.p.name)} climbs ${climber.d} places!</div>` : '';
    prev.climber = climber && climber.p.id;
    return [`<div class="lb"><div class="lb-title">${App.diya(true, 56)}<h1>The Standings</h1>${App.diya(true, 56)}</div>${fin}${teams}<div class="lb-board">${rows || '<p class="center">No players yet</p>'}</div>${banner}</div>`, key];
  }
  function runLeaderboard(key) {
    if (lbAnimated.has(key) || !document.querySelector('.lb-row[data-from]')) { App.fireworks(0.45, 'sides'); return; }
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
    setTimeout(() => { App.sfx('fanfare'); App.fireworks(0.45, 'sides'); }, 1450);
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
      <div class="value">${esc(a.value)}${S.awardPoints ? ` · <b>+${S.awardPoints} points</b>` : ''}</div>${dots}</div></div>`, 'award-' + a.id];
  }

  // ---------------- games ----------------
  function gameScene() {
    const L = S.live;
    const fn = { quiz: quizScene, jeopardy: jeopardyScene, kbc: kbcScene, hookstep: hookScene, custom: customScene }[L.type];
    return fn(L);
  }
  const intro = (L, sub, rules = []) => {
    const all = L && L.difficultyName ? rules.concat([`🎚️ ${L.difficultyName}`]) : rules;
    return `<div class="intro"><div><div class="em">${esc(L.emoji)}</div><h1>${esc(L.title)}</h1><p>${sub}</p>${all.length ? `<div class="rules">${all.map((r) => `<span>${r}</span>`).join('')}</div>` : ''}</div></div>`;
  };
  const lockins = (ids) => {
    const on = new Set(ids || []);
    return `<div class="lockins">${S.players.filter((p) => p.online || on.has(p.id)).map((p) => `<div class="lk ${on.has(p.id) ? 'on' : ''}">${av(p)}${App.diya(on.has(p.id))}<small>${esc(p.name)}</small></div>`).join('')}</div>`;
  };

  function quizScene(L) {
    if (L.phase === 'intro') return [intro(L, 'Answer on your phone — match the colour and the shape!', [`${L.total} questions`, L.mode === 'team' ? '👥 teams score their average' : '⚡ faster = more points', '🔥 3 in a row = streak bonus']), 'q-intro'];
    if (L.phase === 'final') return [intro({ ...L, emoji: '🎆' }, 'Round complete! The standings are coming up…'), 'q-final'];
    const q = L.question;
    const head = `<div class="ghead"><span class="pill gold">Q ${L.qIndex + 1} / ${L.total}</span><span class="pill">${esc(L.title)}</span>${L.doubleDiya ? '<span class="pill personal">✨ Double Diya · ×2 points</span>' : ''}${q && q.personal ? '<span class="pill personal">✨ About our guests</span>' : ''}
      ${L.phase === 'reveal' ? '<span class="show-call">Sahi jawab hai…</span>' : ''}${L.phase === 'question' && App.now() >= L.opensAt ? medalCount(L.deadline, L.opensAt) : ''}</div>`;
    const qcard = `<div class="qcard paper">${q.clue ? `<div class="clue">${esc(q.clue)}</div>` : ''}${q.image ? `<img class="qimg" src="${esc(q.image)}" alt=""/>` : ''}<div class="q">${esc(q.q)}</div></div>`;

    if (L.phase === 'question') {
      const waiting = App.now() < L.opensAt;
      if (waiting) setTimeout(render, L.opensAt - App.now() + 30);
      const opts = waiting
        ? `${L.doubleDiya ? '<div class="dd-banner">✨ Double Diya — the final question is worth double! ✨</div>' : ''}<div class="countdown-big" data-count="${L.opensAt}"></div>`
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
    }).join('')}</div>`;
    const fires = Object.entries(r.streaks || {}).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const fireHtml = fires.length ? `<h3 style="margin-top:1vw">🔥 On fire</h3>${fires.map(([pid, n]) => { const p = player(pid); return p ? `<div class="lrow">${av(p)}${esc(p.name)}<span class="pts">${n} in a row</span></div>` : ''; }).join('')}` : '';
    const fastHtml = r.fastest.slice(0, 3).map((f) => { const p = player(f.id); return p ? `<div class="lrow">${av(p)}${esc(p.name)}${flame((r.streaks || {})[f.id])} <span class="small" style="opacity:.7">${(f.ms / 1000).toFixed(1)}s</span><span class="pts">${L.mode === 'team' ? (r.doubled && r.doubled[f.id] ? '×2' : '') : `+${f.points}${r.doubled && r.doubled[f.id] ? ' ×2' : ''}`}</span></div>` : ''; }).join('') || '<div class="lrow">Nobody got it</div>';
    let side;
    if (L.mode === 'team') {
      const ts = S.teams.map((t) => ({ t, pts: r.perTeam[t.id] || 0 })).sort((a, b) => b.pts - a.pts);
      side = `<div class="list-card later" style="--d:2.5s"><h3>Team points</h3>${ts.map(({ t, pts }) => `<div class="lrow"><span class="avatar" style="--c:${t.color}">${esc(t.emoji)}</span>${esc(t.name)}<span class="pts">+${pts}</span></div>`).join('')}<h3 style="margin-top:1vw">⚡ Fastest</h3>${fastHtml}${fireHtml}</div>`;
    } else {
      side = `<div class="list-card later" style="--d:2.5s"><h3>⚡ Bijli fingers</h3>${fastHtml}${fireHtml}</div>`;
    }
    return [`<div class="gframe">${head}${qcard}<div class="reveal-side">${opts}${side}</div></div>`, `q-${L.qIndex}-reveal`];
  }

  function jeopardyScene(L) {
    const ctl = L.control;
    const head = `<div class="ghead"><span class="pill gold">🧠 ${esc(L.title)}</span>${ctl ? `<span class="pill control" style="--tc:${ctl.color}">${esc(ctl.emoji)} ${esc(ctl.name)} ${L.phase === 'board' ? 'picks next' : 'in control'}</span>` : ''}</div>`;
    if (L.phase === 'board') {
      const cats = L.categories;
      const rows = Math.max(...cats.map((c) => c.clues.length));
      let cells = cats.map((c, ci) => `<div class="jcat" style="animation-delay:${ci * 0.06}s">${esc(c.name)}</div>`).join('');
      for (let i = 0; i < rows; i++) {
        cells += cats.map((c, ci) => {
          const cl = c.clues[i];
          if (!cl) return '<div></div>';
          if (cl.used) { const e = cl.by && L.entities[cl.by]; return `<div class="jcell used">${e ? esc(e.emoji) : '—'}</div>`; }
          return `<div class="jcell" style="animation-delay:${0.2 + (i * cats.length + ci) * 0.025}s">${cl.value}</div>`;
        }).join('');
      }
      return [`<div class="gframe">${head}<div class="jboard" style="grid-template-columns:repeat(${cats.length},1fr);grid-template-rows:auto repeat(${rows},1fr)">${cells}</div></div>`, 'j-board'];
    }
    const c = L.clue;
    if (L.phase === 'dd') {
      return [`<div class="gframe">${head}<div class="dd-stage"><div class="dd-gem">💎</div><h1>Daily Double!</h1><p>${ctl ? `${esc(ctl.emoji)} ${esc(ctl.name)}` : 'The team in control'} — how much will you wager?</p><div class="dd-cat">${esc(c.category)}</div></div></div>`, `j-dd-${L.cur.c}-${L.cur.i}`];
    }
    const queue = L.buzzes.map((b) => `<div class="lrow ${L.active && L.active.key === b.key ? 'active' : ''} ${L.locked.includes(b.key) ? 'locked' : ''}"><span class="avatar" style="--c:${b.color}">${esc(b.emoji)}</span>${esc(b.name)}${b.kind === 'team' ? ` <span class="small" style="opacity:.7">(${esc(b.buzzerName)})</span>` : ''}<span class="pts">${(b.ms / 1000).toFixed(2)}s</span></div>`).join('');
    const answer = L.phase === 'answer';
    const correct = answer && L.last && L.last.correct;
    if (L.active && !answer && prev.buzzKey !== L.active.key) App.sfx('buzz');
    prev.buzzKey = L.active ? L.active.key : null;
    let status;
    if (L.dd) status = `<div class="buzz-state dd">💎 ${esc(ctl ? ctl.name : '')} · wager ${fmt(L.wager)}</div>`;
    else if (answer) status = correct ? `<div class="buzz-state win">+${fmt(L.last.value)} to ${esc(L.last.info.name)}!</div>` : '';
    else if (!L.buzzOpen) status = `<div class="buzz-state armed">🔒 Buzzers armed<small>listen to the host…</small></div>`;
    else if (L.active && L.answerUntil) status = `<div class="buzz-state open">${esc(L.active.name)} · <span data-count="${L.answerUntil}" data-tick="1"></span>s</div>`;
    else if (!L.buzzes.length) status = `<div class="buzz-state open">🔔 BUZZ NOW!</div>`;
    else status = '';
    const side = `<div class="list-card bq"><h3>🔔 Buzzers</h3>${status}${queue}</div>`;
    return [`<div class="gframe">${head}<div class="jclue"><div class="qcard paper ${L.buzzOpen && !answer ? 'live' : ''}"><div class="cat">${esc(c.category)} · ${fmt(c.value)}${L.dd ? ' · 💎 Daily Double' : ''}</div><div class="q">${esc(c.q)}</div>${answer ? `<div class="ans pop">✨ ${esc(c.a)}</div>` : ''}</div>${side}</div></div>`, `j-clue-${L.cur.c}-${L.cur.i}${answer ? (correct ? '-answer-correct' : '-answer') : ''}`];
  }

  function ladderHtml(L, curLevel, doneUpTo) {
    return `<div class="ladder">${L.ladder.map((l, i) => `<div class="lv ${l.safe ? 'safe' : ''} ${i === curLevel ? 'cur' : ''} ${i < doneUpTo ? 'done' : ''}"><span>${i + 1}</span><span>${l.safe ? '★ ' : ''}${fmt(l.points)}</span></div>`).join('')}</div>`;
  }
  function predBar(h) {
    const pc = h.predCounts || { sahi: 0, galat: 0 };
    const tot = pc.sahi + pc.galat;
    if (!tot) return h.qPhase === 'question' ? '<div class="pred-bar empty">🔮 Audience — call it on your phones: Sahi or Galat?</div>' : '';
    const res = h.predResult && h.qPhase !== 'question' ? `<b class="called">🔮 ${h.predResult.right.length} called it · +25 each</b>` : '';
    return `<div class="pred-bar"><span class="ps" style="flex:${pc.sahi || 0.001}">✅ ${pc.sahi} Sahi</span><span class="pg" style="flex:${pc.galat || 0.001}">${pc.galat} Galat ❌</span></div>${res}`;
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
      <div class="kbc-q">${esc(q.q)}</div>${opts}${banner}${phone}${predBar(h)}
      </div><div class="kbc-side">${lifelines}${pollHtml && h.qPhase === 'question' ? pollHtml : ladderHtml(L, h.qPhase === 'over' ? -1 : lvl, h.level)}</div></div></div>`, key];
  }

  function hookScene(L) {
    const perf = L.perf;
    const team = perf && perf.team;
    const head = `<div class="ghead"><span class="pill gold">💃 ${esc(L.title)}</span>${team ? `<span class="pill control" style="--tc:${team.color}">${esc(team.emoji)} ${esc(team.name)}</span>` : ''}<span class="pill">📵 No phones · +${L.bonus} for every dancer</span>${L.phase === 'perform' ? medalCount(L.until, L.startedAt) : ''}</div>`;
    const dancers = (list) => `<div class="dancers">${(list || []).map((d, i) => `<div class="dancer" style="animation-delay:${i * 0.08}s">${av(d)}<b>${esc(d.name)}</b><small>+${L.bonus}</small></div>`).join('')}</div>`;
    if (L.phase === 'idle' || !perf) {
      const res = L.results.length ? `<div class="list-card hook-results"><h3>Dance-offs so far</h3>${[...L.results].sort((a, b) => b.teamPoints - a.teamPoints).map((r) => `<div class="lrow">${r.team ? `<span class="avatar" style="--c:${r.team.color}">${esc(r.team.emoji)}</span>${esc(r.team.name)}` : '💃 Open floor'} <span class="small" style="opacity:.7">${esc(r.song)} · ${'🪔'.repeat(r.stars)} · ${r.dancers.length} dancers</span><span class="pts">+${r.teamPoints}</span></div>`).join('')}</div>` : '';
      return [`<div class="gframe">${head}<div class="hook"><div>${intro({ emoji: '💃', title: L.title }, 'Phones down. A song spins, a team is called up — <b>anyone who dances earns a personal bonus</b> on top of the team points.')}${res}</div></div></div>`, 'hook-idle'];
    }
    if (L.phase === 'spin') return [`<div class="gframe">${head}<div class="hook"><div class="perf">${team ? `<div class="call">${esc(team.emoji)} ${esc(team.name)}</div>` : ''}<div class="reel paper"><div class="reel-win" id="slot">🎵</div></div><div class="hand-note">Spinning the song…</div></div></div></div>`, 'spin'];
    const song = perf.song;
    const stepHtml = L.showStep && song && song.step ? `<div class="step">${esc(song.step)}</div>` : '';
    const songHtml = song ? `<div class="song">🎵 ${esc(song.title)}</div>${stepHtml}` : '';
    if (L.phase === 'ready') {
      return [`<div class="gframe">${head}<div class="hook"><div class="perf"><div class="call big">${team ? `${esc(team.emoji)} ${esc(team.name)}` : 'Open floor!'}</div>
        <h1 class="brave">Who's brave enough? Come up!</h1>${songHtml}${dancers(perf.dancers)}</div></div></div>`, 'hook-ready-' + (song ? song.title : '')];
    }
    if (L.phase === 'perform') {
      const title = song ? `<div class="song">${esc(song.title)}</div>` : '';
      return [`<div class="gframe hook-film">${title}<div class="big-count" data-count="${L.until}"></div>${stepHtml}</div>`, 'hook-perform' + (L.showStep ? '-hint' : '')];
    }
    if (L.phase === 'judge') {
      const stars = perf.stars || 0;
      const measuring = perf.measure && !perf.applause && perf.applause !== 0;
      if (perf.measure && prev.measureId !== perf.measure.id) { prev.measureId = perf.measure.id; measureApplause(perf.measure.id); }
      return [`<div class="gframe">${head}<div class="hook hook-judge"><div class="perf"><h1 style="font-size:4vw">The original</h1>
        <div class="stars-tv judge">${[1, 2, 3, 4, 5].map((n) => `<span class="${n <= stars ? 'on' : ''}" style="transition-delay:${n * 0.08}s">🪔</span>`).join('')}</div>
        <div class="applause"><span>👏 Crowd</span><div class="meter"><i id="meterFill" style="width:${perf.applause || 0}%"></i></div><b id="meterVal">${measuring ? 'CHEER NOW!' : perf.applause != null ? perf.applause : '—'}</b></div>
        ${dancers(perf.dancers)}</div></div></div>`, 'hook-judge'];
    }
    const last = L.last;
    return [`<div class="gframe">${head}<div class="hook hook-scored-fit"><div class="perf">
      <div class="call big">${last.team ? `${esc(last.team.emoji)} ${esc(last.team.name)}` : 'Open floor'}</div>
      <div class="stars-tv">${'🪔'.repeat(last.stars)}<span style="opacity:.2">${'🪔'.repeat(5 - last.stars)}</span></div>
      <h1 class="pop team-pts">+${last.teamPoints} <small>${last.team ? 'team points' : 'points each'}</small></h1>
      ${last.crowd ? `<div class="song">👏 Crowd bonus +${last.crowd}</div>` : ''}
      ${last.dancers.length ? `<div class="hand-note">Himmat bonus for every dancer 🙌</div>${dancers(last.dancers)}` : ''}</div></div></div>`, 'hook-scored-' + L.results.length];
  }

  // Applause-o-meter: the TV's microphone listens to the crowd for 5 seconds.
  async function measureApplause(id) {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch { App.toast('Allow the microphone on the TV to use the Applause-o-meter', true); return; }
    const ac = App.audio || new (window.AudioContext || window.webkitAudioContext)();
    App.audio = ac; ac.resume();
    const an = ac.createAnalyser(); an.fftSize = 1024;
    ac.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    const t0 = performance.now(); let peak = 0, sum = 0, n = 0;
    App.sfx('drumroll');
    await new Promise((resolve) => {
      const step = () => {
        an.getFloatTimeDomainData(buf);
        let rms = 0; for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / buf.length);
        const level = Math.max(0, Math.min(100, (20 * Math.log10(rms + 1e-6) + 55) * 2.2)); // ~-55 dB → 0, ~-10 dB → 100
        peak = Math.max(peak, level); sum += level; n++;
        const fill = document.getElementById('meterFill'), val = document.getElementById('meterVal');
        if (fill) fill.style.width = level.toFixed(0) + '%';
        if (val) val.textContent = level.toFixed(0);
        if (performance.now() - t0 < 5000) requestAnimationFrame(step); else resolve();
      };
      step();
    });
    stream.getTracks().forEach((t) => t.stop());
    const score = Math.round(0.6 * peak + 0.4 * (sum / Math.max(1, n)));
    App.sfx('ding'); App.fireworks(score / 80);
    fetch('/api/applause', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, level: score, room: App.room, tvSecret: App.tvSecret || '' }) }).catch(() => {});
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
