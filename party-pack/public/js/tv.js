/* TV display — the stage everyone watches. */
(function () {
  const { esc, fmt } = App;
  const $ = (id) => document.getElementById(id);

  $('logoMark').innerHTML = App.mark(30);
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
  // Dance-Off fills the screen. A blur sits on top until the dance clock hits zero, then lifts. The clip keeps playing.
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
  // The TV key arrives once in the link's #fragment (or ?tv= from older links), is kept on this
  // device for that room, and is wiped from the address bar so it isn't shown on screen or shared.
  function readTvSecret(code) {
    const fromLink = new URLSearchParams(location.hash.slice(1)).get('tv') || new URLSearchParams(location.search).get('tv') || '';
    const k = 'dgn_tv_secret:' + (code || '');
    if (fromLink) { try { localStorage.setItem(k, fromLink); } catch { /* private mode */ } return fromLink; }
    try { return localStorage.getItem(k) || sessionStorage.getItem('dgn_tv_secret') || ''; } catch { return ''; }
  }
  function enterRoom(code) {
    App.room = code;
    App.tvSecret = readTvSecret(code);
    try { localStorage.setItem('dgn_tv_room', code); } catch { /* private mode */ }
    history.replaceState(null, '', '/tv?room=' + encodeURIComponent(code));
    document.body.classList.remove('tv-gate');
    if (sock) sock.disconnect();
    sock = App.connect('tv', null, (s) => { S = s; render(); }, (msg) => {
      try { localStorage.removeItem('dgn_tv_room'); localStorage.removeItem('dgn_tv_secret:' + code); } catch { /* ignore */ }
      App.room = '';
      showGate(msg);
    });
  }
  function showGate(msg) {
    document.body.classList.add('tv-gate');
    $('stage').innerHTML = `<div class="gate">${App.mark(110)}<h1>Open the TV</h1><p>Tap “Open on TV” on any player’s phone and open that link here.</p>
      <p class="fine">Dance videos play from YouTube. Fonts load from Google. Live updates may use Supabase.</p>
      ${msg ? `<p class="gate-err">${esc(msg)}</p>` : ''}</div>`;
  }
  function bootTv() {
    const code = App.roomFromQuery() || App.canonRoom((() => { try { return localStorage.getItem('dgn_tv_room'); } catch { return ''; } })());
    const secret = readTvSecret(code);
    if (!code || !secret) showGate();
    else enterRoom(code);
  }
  bootTv();

  const player = (id) => S.players.find((p) => p.id === id);
  const av = (p, cls = '') => `<span class="avatar ${cls}" style="--c:${p ? p.color : 'var(--accent)'}">${p ? esc(p.avatar) : '❔'}</span>`;
  const entAv = (e) => `<span class="avatar" style="--c:${e.color}">${esc(e.emoji)}</span>`;
  const timerBar = (start, end) => `<div class="timer" data-start="${start}" data-end="${end}"><i></i></div>`;
  const shapeK = (i) => `<span class="k">${App.shapes[i] || ''}</span>`;
  const joinUrl = () => location.origin + '/play?room=' + encodeURIComponent(App.room || (S && S.code) || '');
  const ring = (deadline, start) => `<span class="ring" data-burn="${deadline}" data-burn-start="${start}"><b data-count="${deadline}" data-tick="1"></b></span>`;
  const at = (ms) => { if (ms > App.now()) setTimeout(render, ms - App.now() + 20); };

  // Countdown rings
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
    App.applyTheme(S);
    document.title = `${S.eventName} — TV`;
    App.patch($('eventName'), esc(S.eventName));
    const inGame = S.live && S.tv.view === 'game';
    App.patch($('nowPlaying'), inGame ? `<span class="plaque">${esc(S.live.emoji)} ${esc(S.live.title)}</span>` : '');
    const mini = S.live && S.live.mode === 'team' && S.teams.length
      ? [...S.teams].sort((a, b) => (b.gamePoints - a.gamePoints) || (b.total - a.total)).filter((t) => (t.gamePoints || t.total) > 0).slice(0, 3)
        .map((t, i) => `<div class="m"><i>${i + 1}</i><span class="avatar" style="--c:${t.color}">${esc(t.emoji)}</span>${esc(String(t.name).replace(/^Team /, ''))}<b>${fmt(t.gamePoints || t.total)}</b></div>`).join('')
      : S.players.slice(0, 3).filter((p) => p.score > 0).map((p, i) => `<div class="m"><i>${i + 1}</i>${av(p)}${esc(p.name)}<b>${fmt(p.score)}</b></div>`).join('');
    App.patch($('miniTop'), S.tv.view === 'game' ? mini : '');
    App.patch($('ticker'), `<span class="join-hint">Join at <b>${esc(location.host)}</b> · Room <b>${esc(S.code || '')}</b></span>`);
    detectArrivals();

    let view = S.tv.view;
    if (view === 'game' && !S.live) view = 'lobby';
    let html, key;
    if (view === 'lobby') [html, key] = [lobby(), 'lobby'];
    else if (view === 'leaderboard') [html, key] = leaderboard();
    else if (view === 'podium') [html, key] = [podium(), 'podium'];
    else if (view === 'awards') [html, key] = awardsView();
    else [html, key] = gameScene();

    document.body.classList.toggle('in-game', view === 'game');
    ['lobby', 'leaderboard', 'podium', 'awards'].forEach((v) => document.body.classList.toggle('view-' + v, view === v));
    const stage = $('stage');
    if (key !== prev.sceneKey) {
      stage.innerHTML = `<div class="scene enter"></div>`;
      prev.sceneKey = key;
      stage.dataset.key = key;
      App.patch(stage.firstElementChild, html, true);
      onSceneChange(key);
    } else App.patch(stage.firstElementChild, html);
    renderAnnounce();
    syncMedia();
  }

  function onSceneChange(key) {
    if (/^lb/.test(key)) { App.sfx('drumroll'); setTimeout(() => runLeaderboard(key), 900); }
    else if (key === 'podium') { App.sfx('fanfare'); setTimeout(() => { App.fireworks(1.2); App.confetti(1.4); }, 1800); }
    else if (/^award-/.test(key)) {
      if (/-intro$/.test(key)) App.sfx('fanfare');
      else { App.sfx('drumroll'); setTimeout(() => { App.sfx('ding'); App.confetti(0.9); }, 1500); }
    } else if (/-reveal$/.test(key)) { setTimeout(() => { App.sfx('reveal'); App.confetti(0.6); }, 900); }
    else if (/answer-correct|scored/.test(key)) { App.sfx('reveal'); App.confetti(0.6); }
    else if (/-go$/.test(key)) App.sfx('ding');
    else if (/^q-|clue|^r-/.test(key)) App.sfx('whoosh');
  }

  // A welcome for every guest who joins.
  function detectArrivals() {
    const ids = S.players.map((p) => p.id);
    if (prev.players) {
      const fresh = S.players.filter((p) => !prev.players.includes(p.id));
      fresh.slice(0, 3).forEach((p, i) => setTimeout(() => {
        const el = $('arrival');
        el.classList.remove('hidden');
        el.innerHTML = `${av(p)} <span><b>${esc(p.name)}</b> joined</span>`;
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
    if (a && a.until > App.now() && !shownAnnounce.has(a.id)) {
      shownAnnounce.add(a.id);
      if (a.kind === 'end') { el.classList.add('hidden'); return; }
      const style = a.style === 'lower' ? 'lower' : 'bumper';
      el.className = `announce ${style} ${a.kind || ''}`;
      el.innerHTML = `<div class="box"><div class="em">${esc(a.emoji || '✨')}</div><div>${a.title ? `<h1>${esc(a.title)}</h1>` : ''}<p>${esc(a.text || '')}</p></div></div>`;
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
    const profiling = S.flow && S.flow.stage === 'profile';
    const done = new Set((S.flow && S.flow.profiled) || []);
    return `<div class="lobby">
      <div class="lobby-hero">
        ${App.mark(120)}
        <h1>${esc(S.eventName || 'Party Pack')}</h1>
        <p class="sub">${profiling ? 'Everyone’s filling in a quick profile on their phone…' : 'Scan to join, or enter the code on your phone.'}</p>
        <div class="join-box">
          <img src="/api/qr.svg?u=${encodeURIComponent(url)}" alt="QR code to join" />
          <div><div class="eyebrow">Room code</div><div class="room-code">${esc(S.code || '').split('').map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</div><div class="where">${esc(location.host)}</div></div>
        </div>
      </div>
      <div class="guests">
        <div class="guest-head"><h2>Players</h2><span>${ps.length} in</span></div>
        <div class="lobby-players">${ps.map((p) => `<div class="pl ${p.online ? '' : 'off'} ${newIds.has(p.id) ? 'new' : ''} ${profiling && done.has(p.id) ? 'done' : ''}">${av(p)}<span class="nm">${esc(p.name)}</span></div>`).join('') || '<div class="empty">Waiting for the first player…</div>'}</div>
      </div>
    </div>`;
  }

  // ---------------- leaderboard (rows slide from their old places to the new ones) ----------------
  function lbLayout(n) {
    const cols = n > 8 ? 2 : 1;
    const perCol = Math.ceil(n / cols);
    const h = Math.min(4.6, 34 / Math.max(perCol, 1));
    return { cols, perCol, h };
  }
  function leaderboard() {
    const ps = S.players;
    const team = (id) => S.teams.find((t) => t.id === id);
    const snap = S.snapshot && !S.snapshot.every((x) => x.score === 0) ? S.snapshot : null;
    const key = 'lb-' + (S.tv.compareGameId || 'x') + '-' + ps.length;
    const animate = snap && !lbAnimated.has(key);
    const oldOrder = snap ? [...ps].sort((a, b) => {
      const ra = snap.find((x) => x.id === a.id), rb = snap.find((x) => x.id === b.id);
      return (ra ? ra.rank : 999) - (rb ? rb.rank : 999) || ((ra && ra.score) || 0) - ((rb && rb.score) || 0);
    }) : ps;
    const { cols, perCol, h } = lbLayout(ps.length);
    const pos = (idx) => ({ x: cols === 2 ? (idx < perCol ? '0%' : '51%') : '18%', w: cols === 2 ? '49%' : '64%', y: `${(idx % perCol) * (h + 0.7)}rem` });
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
      const mv = !snap || !before ? '' : d > 0 ? `<span class="mv up">▲ ${d}</span>` : d < 0 ? `<span class="mv down">▼ ${-d}</span>` : '';
      const start = animate ? pos(oldOrder.indexOf(p)) : pos(i);
      const end = pos(i);
      const scoreFrom = animate && before ? before.score : p.score;
      return `<div class="lb-row r${p.rank}" data-pid="${p.id}" data-x="${end.x}" data-w="${end.w}" data-y="${end.y}" data-to="${p.score}" data-from="${scoreFrom}" style="--x:${start.x};--w:${start.w};--y:${start.y};--h:${h}rem">
        <span class="rk">${p.rank}</span>${av(p)}<span class="nm">${esc(p.name)}</span>${mv}
        ${t ? `<span class="team" style="--tc:${t.color}">${esc(t.emoji)} ${esc(t.name.replace('Team ', ''))}</span>` : ''}
        <span class="sc">${fmt(scoreFrom)}</span></div>`;
    }).join('');
    const f = S.flow || {};
    const next = (f.catalog || []).find((g) => g.id === (f.order || [])[f.idx + 1]);
    const kicker = `<div class="lb-kicker">${next ? `Up next · ${next.emoji} ${esc(next.title)}` : 'Awards coming up'}${climber ? ` · 📈 ${esc(climber.p.name)} climbs ${climber.d}` : ''}</div>`;
    return [`<div class="lb"><h1>Standings</h1>${kicker}<div class="lb-board" style="height:${perCol * (h + 0.7)}rem">${rows || '<p class="center">No players yet</p>'}</div></div>`, key];
  }
  function runLeaderboard(key) {
    if (lbAnimated.has(key) || !document.querySelector('.lb-row[data-from]')) return;
    // Mark done only after the slide finishes, so a re-render can't cut the animation short.
    setTimeout(() => lbAnimated.add(key), 1800);
    App.sfx('whoo');
    document.querySelectorAll('.lb-row').forEach((el) => {
      el.style.setProperty('--x', el.dataset.x);
      el.style.setProperty('--w', el.dataset.w);
      el.style.setProperty('--y', el.dataset.y);
      App.countUp(el.querySelector('.sc'), Number(el.dataset.to), 1300, Number(el.dataset.from));
    });
    setTimeout(() => { App.sfx('fanfare'); App.confetti(0.7); }, 1450);
  }

  function podium() {
    const top = S.players.slice(0, 3);
    const order = [top[1], top[0], top[2]];
    const cls = ['p2', 'p1', 'p3'];
    return `<div class="podium"><div class="eyebrow">Final results</div><h1>Champions of the night</h1><div class="pods">${order.map((p, i) => p ? `<div class="pod ${cls[i]}">${av(p)}<div class="nm">${esc(p.name)}</div><div class="sc">${fmt(p.score)} pts</div><div class="blk">${cls[i][1]}</div></div>` : '<div class="pod"></div>').join('')}</div></div>`;
  }

  // ---------------- Awards ----------------
  function awardsView() {
    const list = S.awards || [];
    const i = S.tv.awardStep || 0;
    const dots = `<div class="award-dots">${Array.from({ length: list.length + 1 }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>`;
    const a = list[i - 1];
    if (!a) {
      return [`<div class="awards"><div class="award-card"><div class="medal">🏆</div><div class="eyebrow">And now</div>
        <h1>The Awards</h1><p class="desc">${list.length ? `${list.length} award${list.length === 1 ? '' : 's'}, then the champion` : 'The champion is coming up'}</p>${dots}</div></div>`, 'award-intro'];
    }
    return [`<div class="awards"><div class="award-card"><div class="medal">${esc(a.emoji)}</div>
      <h1>${esc(a.title)}</h1><p class="desc">${esc(a.desc)}</p>
      <div class="winners">${a.winners.map((w) => `<div class="winner">${av(w)}<b>${esc(w.name)}</b></div>`).join('')}</div>
      <div class="value">${esc(a.value)}</div>${dots}</div></div>`, 'award-' + a.id];
  }

  // ---------------- games ----------------
  function gameScene() {
    const L = S.live;
    const fn = { quiz: quizScene, jeopardy: jeopardyScene, kbc: kbcScene, hookstep: hookScene, reflex: reflexScene }[L.type] || ((x) => [intro(x, ''), 'custom']);
    return fn(L);
  }
  const intro = (L, sub, rules = []) => `<div class="intro"><div class="em">${esc(L.emoji)}</div><h1>${esc(L.title)}</h1><p>${sub}</p>${rules.length ? `<div class="rules">${rules.map((r) => `<span>${r}</span>`).join('')}</div>` : ''}</div>`;
  const lockins = (ids) => {
    const on = new Set(ids || []);
    return `<div class="lockins">${S.players.filter((p) => p.online || on.has(p.id)).map((p) => `<div class="lk ${on.has(p.id) ? 'on' : ''}">${av(p)}<small>${esc(p.name)}</small></div>`).join('')}</div>`;
  };
  const QUIZ_INTRO = {
    spot: ['One of these is not like the others. Tap it on your phone!', ['👀 Find the odd one out', '⚡ Faster = more points']],
    poll: ['No right answers. Pick what you think most of the room will pick.', ['🐝 Match the majority', '🐺 Lone wolves score nothing']],
    flash: ['A row of pictures appears for a few seconds. Then a question about it.', ['💡 Memorise the row', '⚡ Faster = more points']],
    math: ['Quick sums against the clock. Answer on your phone!', ['🔢 No calculators', '⚡ Faster = more points']],
  };

  function quizScene(L) {
    if (L.phase === 'intro') {
      const [sub, rules] = QUIZ_INTRO[L.gen] || ['Answer on your phone — match the colour and the shape!', [`${L.total} questions`, L.mode === 'team' ? '👥 Teams score their average' : '⚡ Faster = more points', '🔥 3 in a row = streak bonus']];
      return [intro(L, sub, rules), 'q-intro'];
    }
    if (L.phase === 'final') return [intro({ ...L, emoji: '🎆' }, 'Round complete! The standings are coming up…'), 'q-final'];
    const q = L.question;
    const now = App.now();
    const waiting = L.phase === 'question' && now < L.opensAt;
    at(L.opensAt);
    const head = `<div class="ghead"><span class="pill">${L.qIndex + 1} <small>of ${L.total}</small></span>${L.doubleDiya ? '<span class="pill accent">Double points ×2</span>' : ''}${q && q.personal ? '<span class="pill accent">About our guests</span>' : ''}
      <span class="grow"></span>${L.phase === 'question' && !waiting ? ring(L.deadline, L.opensAt) : ''}</div>`;
    const showClue = q.clue && !(waiting && L.gen === 'math');
    const qcard = q.kind === 'spot' ? '' : `<div class="qcard">${showClue ? `<div class="clue">${esc(q.clue)}</div>` : ''}${q.clue && /^guess the movie!?$/i.test(String(q.q).trim()) ? '' : `<div class="q">${esc(q.q)}</div>`}</div>`;
    const spot = (answer) => `<div class="spot-wrap"><div class="spot-grid" style="--cols:${q.cols}">${q.options.map((o, i) => `<span class="${answer === i ? 'hit' : ''}" style="--i:${i}">${esc(o)}</span>`).join('')}</div></div>`;
    const flashRow = (still) => { const per = (L.opensAt - L.flashAt - 500) / q.flash.length; return `<div class="flash-row ${still ? 'still' : ''}">${q.flash.map((e, i) => `<span style="animation-delay:${still ? 0 : Math.round(L.flashAt + i * per - App.now())}ms">${esc(e)}</span>`).join('')}</div>`; };

    if (L.phase === 'question') {
      if (waiting && q.kind === 'flash') {
        at(L.flashAt);
        if (now < L.flashAt || !q.flash) return [`<div class="gframe">${head}<div class="mid"><div class="get-ready">Memorise the row…</div></div>${lockins([])}</div>`, `q-${L.qIndex}-w`];
        return [`<div class="gframe">${head}${timerBar(L.flashAt, L.opensAt)}<div class="mid">${flashRow()}</div></div>`, `q-${L.qIndex}-flash`];
      }
      if (waiting) return [`<div class="gframe">${head}${qcard}<div class="mid"><div class="countdown-big" data-count="${L.opensAt}"></div></div>${lockins([])}</div>`, `q-${L.qIndex}-w`];
      const cls = q.kind === 'poll' ? 'two' : q.kind === 'flash' ? 'emoji' : '';
      const opts = q.kind === 'spot' ? spot(null) : `<div class="opts ${cls}">${q.options.map((o, i) => `<div class="opt o${i}" style="--i:${i}">${shapeK(i)}<span>${esc(o)}</span></div>`).join('')}</div>`;
      return [`<div class="gframe">${head}${timerBar(L.opensAt, L.deadline)}${q.kind === 'spot' ? `<div class="spot-lead">${esc(q.q)}</div>` : qcard}${opts}${lockins(L.answeredIds)}</div>`, `q-${L.qIndex}`];
    }
    // reveal: the wrong options fade back, the right one lifts, then the names roll in
    const r = L.result;
    const total = r.counts.reduce((a, b) => a + b, 0) || 1;
    const wins = new Set(r.majority || [r.answer]);
    let opts;
    if (q.kind === 'spot') opts = spot(r.answer);
    else {
      opts = `<div class="opts reveal ${q.kind === 'poll' ? 'two' : q.kind === 'flash' ? 'emoji' : ''}">${q.options.map((o, i) => {
        const faces = (r.byChoice && r.byChoice[i] || []).slice(0, 8).map((pid) => av(player(pid))).join('');
        const pct = Math.round((100 * r.counts[i]) / total);
        return `<div class="opt o${i} ${wins.has(i) ? 'win' : 'out'}" style="--i:${i}">${shapeK(i)}<span>${esc(o)}</span><span class="faces">${faces}</span><b class="n">${q.kind === 'poll' ? pct + '%' : r.counts[i]}</b></div>`;
      }).join('')}</div>`;
    }
    const lrow = (p, right) => `<div class="lrow">${av(p)}<span>${esc(p.name)}</span><b>${right}</b></div>`;
    const fires = Object.entries(r.streaks || {}).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const fireHtml = fires.length ? `<h3>🔥 On fire</h3>${fires.map(([pid, n]) => { const p = player(pid); return p ? lrow(p, `${n} in a row`) : ''; }).join('')}` : '';
    const fastHtml = r.fastest.slice(0, 4).map((f) => { const p = player(f.id); return p ? lrow(p, `${(f.ms / 1000).toFixed(1)}s${L.mode === 'team' ? '' : ` · +${f.points}`}`) : ''; }).join('') || '<div class="lrow"><span>Nobody got it</span></div>';
    let side;
    if (q.kind === 'poll') {
      const n = Object.values(r.perPlayer || {}).filter((x) => x > 0).length;
      side = `<div class="list-card"><h3>🐝 The hive says</h3><div class="big-stat">${r.majority.length === 1 ? esc(q.options[r.majority[0]]) : 'It’s a tie!'}</div><div class="lrow"><span>${n} player${n === 1 ? '' : 's'} with the majority</span><b>+${Math.max(0, ...Object.values(r.perPlayer || { x: 0 }))}</b></div></div>`;
    } else if (L.mode === 'team') {
      const ts = S.teams.map((t) => ({ t, pts: r.perTeam[t.id] || 0 })).sort((a, b) => b.pts - a.pts);
      side = `<div class="list-card"><h3>Team points</h3>${ts.map(({ t, pts }) => `<div class="lrow">${entAv(t)}<span>${esc(t.name)}</span><b>+${pts}</b></div>`).join('')}<h3>⚡ Fastest</h3>${fastHtml}${fireHtml}</div>`;
    } else {
      side = `<div class="list-card"><h3>⚡ Fastest</h3>${fastHtml}${fireHtml}</div>`;
    }
    const top = q.kind === 'flash' && q.flash ? flashRow(true) : '';
    return [`<div class="gframe">${head}${top}${q.kind === 'spot' ? '' : qcard}<div class="reveal-side">${opts}${side}</div></div>`, `q-${L.qIndex}-reveal`];
  }

  // Green Light: the whole screen is the light.
  function reflexScene(L) {
    if (L.phase === 'intro') return [intro(L, 'Watch your phone. When it turns green, tap as fast as you can!', ['🚦 Wait for green', '🙈 Tap early and you sit the round out', `${L.total} rounds`]), 'r-intro'];
    if (L.phase === 'final') return [intro({ ...L, emoji: '🎆' }, 'Lightning reflexes! The standings are coming up…'), 'r-final'];
    const head = `<div class="ghead"><span class="pill">Round ${L.round + 1} <small>of ${L.total}</small></span>${L.round === L.total - 1 ? '<span class="pill accent">Double points ×2</span>' : ''}</div>`;
    if (L.phase === 'arm') {
      const go = !(S.flow && S.flow.paused) && App.now() >= L.goAt;
      at(L.goAt);
      return [`<div class="gframe">${head}<div class="mid"><div class="light ${go ? 'go' : 'wait'}"><b>${go ? 'GO!' : 'Wait…'}</b></div></div>${lockins(L.tappedIds)}</div>`, `r-${L.round}${go ? '-go' : ''}`];
    }
    const r = L.result || { ranking: [], fouls: [] };
    const slowest = Math.max(1, ...r.ranking.map((x) => x.ms));
    const rows = r.ranking.slice(0, 8).map((x, i) => { const p = player(x.id); return p ? `<div class="rx-row" style="--i:${i}">${av(p)}<span class="nm">${esc(p.name)}</span><span class="bar"><i style="--w:${Math.max(6, (100 * x.ms) / slowest)}%"></i></span><b>${x.ms} ms</b><em>+${x.points}</em></div>` : ''; }).join('');
    const fouls = r.fouls.map((id) => player(id)).filter(Boolean);
    return [`<div class="gframe">${head}<div class="rx-board">${rows || '<div class="get-ready">Nobody tapped in time!</div>'}</div>${fouls.length ? `<div class="rx-fouls">🙈 Too soon: ${fouls.map((p) => esc(p.name)).join(', ')}</div>` : ''}</div>`, `r-${L.round}-reveal`];
  }

  function jeopardyScene(L) {
    const who = L.turn;
    const head = `<div class="ghead">${who ? `<span class="pill who" style="--tc:${who.color}">${esc(who.emoji)} ${esc(who.name)} ${L.phase === 'board' ? 'is picking' : 'picked'}</span>` : ''}<span class="grow"></span>${L.phase === 'clue' && App.now() >= L.opensAt ? ring(L.deadline, L.opensAt) : ''}</div>`;
    if (L.phase === 'board' || L.phase === 'done') {
      const cats = L.categories;
      const rows = Math.max(...cats.map((c) => c.clues.length));
      let cells = cats.map((c, ci) => `<div class="jcat" style="--i:${ci}">${esc(c.name)}</div>`).join('');
      for (let i = 0; i < rows; i++) {
        cells += cats.map((c, ci) => {
          const cl = c.clues[i];
          if (!cl) return '<div></div>';
          if (cl.used) { const e = cl.by && L.entities[cl.by]; return `<div class="jcell used">${e ? esc(e.emoji) : '—'}</div>`; }
          return `<div class="jcell" style="--i:${i * cats.length + ci}">${cl.value}</div>`;
        }).join('');
      }
      return [`<div class="gframe">${head}<div class="jboard" style="grid-template-columns:repeat(${cats.length},1fr)">${cells}</div></div>`, 'j-board-' + (who ? who.key : '')];
    }
    const c = L.clue;
    at(L.opensAt);
    const answer = L.phase === 'answer';
    const n = answer && L.last ? L.last.right.length : 0;
    const opts = `<div class="opts ${answer ? 'reveal' : ''}">${c.options.map((o, i) => `<div class="opt o${i} ${answer ? (i === c.answer ? 'win' : 'out') : ''}" style="--i:${i}">${shapeK(i)}<span>${esc(o)}</span>${answer && L.last ? `<b class="n">${L.last.counts[i]}</b>` : ''}</div>`).join('')}</div>`;
    return [`<div class="gframe">${head}${L.phase === 'clue' && App.now() >= L.opensAt ? timerBar(L.opensAt, L.deadline) : ''}<div class="qcard"><div class="cat">${esc(c.category)} · ${fmt(c.value)}</div><div class="q">${esc(c.q)}</div></div>${opts}
      ${answer ? `<div class="get-ready small">${n ? `${n} player${n === 1 ? '' : 's'} earned +${fmt(c.value)}` : 'Nobody got that one'}</div>` : lockins(L.answeredIds)}</div>`, `j-clue-${L.cur.c}-${L.cur.i}${answer ? (n ? '-answer-correct' : '-answer') : ''}`];
  }

  function kbcScene(L) {
    if (L.phase === 'idle' || L.phase === 'done') {
      return [intro({ emoji: '💰', title: L.title }, L.phase === 'done' ? 'That’s the round! The standings are coming up…' : 'Every question is open to everyone. The fastest right answer wins the full prize; each place after gets a little less.', L.phase === 'done' ? [] : [`${L.total} questions`, '📈 Prizes climb every question']), 'kbc-' + L.phase];
    }
    const q = L.question;
    const waiting = L.phase === 'question' && App.now() < L.opensAt;
    at(L.opensAt);
    const res = L.result;
    const head = `<div class="ghead"><span class="pill">${L.qIndex + 1} <small>of ${L.total}</small></span><span class="pill accent">${fmt(L.points)} for first</span><span class="grow"></span>${L.phase === 'question' && !waiting ? ring(L.deadline, L.opensAt) : ''}</div>`;
    const qcard = `<div class="qcard"><div class="q">${esc(q.q)}</div></div>`;
    if (waiting) return [`<div class="gframe">${head}${qcard}<div class="mid"><div class="countdown-big" data-count="${L.opensAt}"></div></div>${lockins([])}</div>`, `kbc-q-${L.qIndex}-w`];
    const opts = `<div class="opts ${res ? 'reveal' : ''}">${q.options.map((o, i) => `<div class="opt o${i} ${res ? (i === res.answer ? 'win' : 'out') : ''}" style="--i:${i}">${shapeK(i)}<span>${esc(o)}</span>${res ? `<b class="n">${res.counts[i]}</b>` : ''}</div>`).join('')}</div>`;
    if (!res) return [`<div class="gframe">${head}${timerBar(L.opensAt, L.deadline)}${qcard}${opts}${lockins(L.answeredIds)}</div>`, `kbc-q-${L.qIndex}`];
    const side = `<div class="list-card"><h3>💰 Prize winners</h3>${res.ranking.slice(0, 6).map((r) => { const p = player(r.id); return p ? `<div class="lrow">${av(p)}<span>${esc(p.name)}</span><b>+${fmt(r.points)}</b></div>` : ''; }).join('') || '<div class="lrow"><span>Nobody got it right!</span></div>'}</div>`;
    return [`<div class="gframe">${head}${qcard}<div class="reveal-side">${opts}${side}</div></div>`, `kbc-q-${L.qIndex}-reveal`];
  }

  function hookScene(L) {
    const perf = L.perf;
    const team = perf && perf.team;
    const dancers = (list) => `<div class="dancers">${(list || []).map((d, i) => `<div class="dancer" style="--i:${i}">${av(d)}<b>${esc(d.name)}</b><small>+${L.bonus}</small></div>`).join('')}</div>`;
    if (L.phase === 'idle' || L.phase === 'done' || !perf) {
      return [intro({ emoji: L.phase === 'done' ? '🎆' : '💃', title: L.title }, L.phase === 'done' ? 'What a dance floor! The standings are coming up…' : 'When you’re called, come up and dance to a mystery song. Everyone else rates it.', L.phase === 'done' ? [] : ['⭐ Stars × 100 points', `💃 Every dancer earns +${L.bonus}`]), 'hook-' + L.phase];
    }
    const song = perf.song;
    const who = team ? `${esc(team.emoji)} ${esc(team.name)}` : 'Open floor';
    if (L.phase === 'ready') {
      return [`<div class="gframe"><div class="mid perf"><div class="eyebrow">Up next on the dance floor</div><h1 class="call">${who}</h1><p class="get-ready small">Come on up — the song starts in a moment.</p>${dancers(perf.dancers)}</div></div>`, 'hook-ready-' + L.results.length];
    }
    if (L.phase === 'perform') {
      return [`<div class="gframe hook-film">${song ? `<div class="song">🎵 ${esc(song.title)}</div>` : ''}<div class="big-count" data-count="${L.until}"></div></div>`, 'hook-perform' + (song ? '-named' : '')];
    }
    if (L.phase === 'judge') {
      return [`<div class="gframe"><div class="mid perf hook-judge"><div class="eyebrow">Rate the dance on your phone</div><h1 class="call">${who}</h1>${song ? `<div class="song">🎵 ${esc(song.title)}</div>` : ''}
        <div class="get-ready small">${perf.votes} vote${perf.votes === 1 ? '' : 's'} in · <span data-count="${L.until}"></span>s</div>${dancers(perf.dancers)}</div></div>`, 'hook-judge'];
    }
    const last = L.last || { stars: 0, dancers: [] };
    return [`<div class="gframe"><div class="mid perf">
      <h1 class="call">${last.team ? `${esc(last.team.emoji)} ${esc(last.team.name)}` : 'Open floor'}</h1>
      <div class="stars-tv">${[1, 2, 3, 4, 5].map((n) => `<span class="${n <= last.stars ? 'on' : ''}" style="--i:${n}">⭐</span>`).join('')}</div>
      <div class="team-pts">+${last.teamPoints} <small>${last.team && last.team.kind === 'team' ? 'each' : 'points'}</small></div>
      ${last.dancers.length ? dancers(last.dancers) : ''}</div></div>`, 'hook-scored-' + L.results.length];
  }

  setInterval(() => { if (S) render(); }, 1000);
})();
