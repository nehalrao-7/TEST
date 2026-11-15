// Game engines. Each engine owns the `live` object while its game is running
// and exposes: init, view (per viewer), host (actions), player (actions), resume.

const crypto = require('crypto');
const S = require('./state');

const now = () => Date.now();
// Test-only: GAME_SPEED=10 runs every clock ten times faster. Unset in production.
const SPEED = Math.max(1, Number(process.env.GAME_SPEED) || 1);
// Timers are not kept in memory (the app runs on serverless functions). Deadlines are
// enforced by tick(), which runs at the start of every request.
function schedule() {}
const pickWrong = (q, n) => S.shuffle(q.options.map((_, i) => i).filter((i) => i !== q.answer)).slice(0, n);
const countBy = (answers, n) => {
  const c = Array(n).fill(0);
  Object.values(answers).forEach((a) => { if (a.choice >= 0 && a.choice < n) c[a.choice]++; });
  return c;
};
const onlineAnsweredAll = (answers, online, exclude = []) => {
  const ids = [...online].filter((pid) => S.state.players[pid] && !exclude.includes(pid));
  return ids.length > 0 && ids.every((pid) => answers[pid]);
};
const speedPoints = (at, opensAt, deadline) => {
  const frac = Math.min(1, Math.max(0, (at - opensAt) / (deadline - opensAt)));
  return Math.round((100 + 100 * (1 - frac)) / 5) * 5; // 100–200 per correct answer
};
// A title card owns the TV until it ends. The countdown starts after that card,
// so the room reads the title, then the clock, then the answers.
function showOpen(countdownMs = 2800) {
  const ann = S.state.tv && S.state.tv.announce;
  const blocking = ann && ann.style !== 'lower' && ann.until > now();
  return (blocking ? ann.until + 400 : now()) + countdownMs;
}
const publicQ = (q) => ({ q: q.q, options: q.options, clue: q.clue || null, image: q.image || null, time: q.time || 20, personal: Boolean(q.personal) });

// ======================= QUIZ (Kahoot / Guess the Movie) =======================
const quiz = {
  init: () => ({ phase: 'intro', qIndex: -1, answers: {}, hints: {}, result: null }),

  open(live, game, ctx) {
    const qs = game.content.questions || [];
    if (live.qIndex + 1 >= qs.length) { live.phase = 'final'; return; }
    live.qIndex++;
    const q = qs[live.qIndex];
    live.phase = 'question';
    live.answers = {};
    live.hints = {};
    live.result = null;
    live.opensAt = showOpen(2800 / SPEED);
    live.deadline = live.opensAt + ((q.time || 20) * 1000) / SPEED;
    quiz.resume(live, game, ctx);
  },

  resume(live, game, ctx) {
    if (live.phase === 'question') schedule('quiz', live.deadline + 300, () => quiz.reveal(live, game, ctx));
  },

  reveal(live, game) {
    if (live.phase !== 'question') return;
    const q = game.content.questions[live.qIndex];
    // Double Diya: the last question of every round is worth double (Mario Party's last-turns twist).
    const mult = live.qIndex === game.content.questions.length - 1 ? 2 : 1;
    const perPlayer = {};
    for (const [pid, a] of Object.entries(live.answers)) {
      perPlayer[pid] = a.choice === q.answer ? speedPoints(a.at, live.opensAt, live.deadline) * mult : 0;
    }
    const perTeam = {};
    const paid = {};
    const doubled = {};
    const reason = `${game.title} Q${live.qIndex + 1}${mult > 1 ? ' ✨ Double Diya' : ''}`;
    const give = (pid, amt, why) => {
      if (!(amt > 0)) return;
      const got = S.award(pid, amt, why, game.id) || 0;
      paid[pid] = (paid[pid] || 0) + got;
      if (got > amt) doubled[pid] = true;
    };
    if (game.mode === 'team') {
      for (const t of Object.values(S.state.teams)) {
        const members = S.teamMembers(t.id);
        if (!members.length) continue;
        const pts = Math.round(members.reduce((a, m) => a + (perPlayer[m.id] || 0), 0) / members.length / 5) * 5;
        perTeam[t.id] = pts;
        members.forEach((m) => give(m.id, pts, reason));
      }
    } else {
      for (const [pid, pts] of Object.entries(perPlayer)) give(pid, pts, reason);
    }
    const fastest = Object.entries(live.answers)
      .filter(([, a]) => a.choice === q.answer)
      .sort((a, b) => a[1].at - b[1].at)
      .slice(0, 5)
      .map(([pid, a]) => ({ id: pid, ms: a.at - live.opensAt, points: perPlayer[pid] }));
    // Streaks (Kahoot-style): 3+ correct in a row earns a bonus.
    live.streaks = live.streaks || {};
    const streakBonus = {};
    for (const p of Object.values(S.state.players)) {
      const a = live.answers[p.id];
      if (!a) { live.streaks[p.id] = 0; continue; }
      const st = S.stat(p.id);
      st.answered++;
      if (a.choice === q.answer) {
        st.correct++;
        live.streaks[p.id] = (live.streaks[p.id] || 0) + 1;
        st.bestStreak = Math.max(st.bestStreak, live.streaks[p.id]);
        if (live.streaks[p.id] >= 3) { streakBonus[p.id] = 50; give(p.id, 50, `🔥 ${live.streaks[p.id]} in a row`); }
      } else live.streaks[p.id] = 0;
    }
    if (fastest[0]) S.stat(fastest[0].id).fastest++;
    const order = Object.entries(live.answers).sort((a, b) => a[1].at - b[1].at).map(([pid]) => pid);
    live.result = { answer: q.answer, double: mult > 1, counts: countBy(live.answers, q.options.length), perPlayer, perTeam, paid, doubled, fastest, streaks: { ...live.streaks }, streakBonus,
      byChoice: q.options.map((_, i) => order.filter((pid) => live.answers[pid].choice === i)) };
    live.phase = 'reveal';
  },

  host(live, game, a, ctx) {
    if (a.type === 'next') quiz.open(live, game, ctx);
    else if (a.type === 'reveal') quiz.reveal(live, game);
  },

  player(live, game, p, a, ctx) {
    if (a.type !== 'answer') return;
    if (live.phase !== 'question') throw new Error('Too late!');
    const t = now();
    if (t < live.opensAt || t > live.deadline + 250) throw new Error('Not accepting answers right now.');
    if (live.answers[p.id]) throw new Error('Answer already locked in.');
    if (game.mode === 'team' && !p.teamId) throw new Error('You are not on a team yet — ask the host.');
    const q = game.content.questions[live.qIndex];
    const choice = Number(a.choice);
    if (!(choice >= 0 && choice < q.options.length)) return;
    live.answers[p.id] = { choice, at: t };
    if (onlineAnsweredAll(live.answers, ctx.online)) quiz.reveal(live, game);
  },

  hint: {
    can: (live, p) => live.phase === 'question' && !live.answers[p.id] && !live.hints[p.id],
    apply: (live, game, p) => { live.hints[p.id] = pickWrong(game.content.questions[live.qIndex], 2); },
  },

  view(live, game, viewer) {
    const qs = game.content.questions || [];
    const q = live.qIndex >= 0 ? qs[live.qIndex] : null;
    const v = {
      phase: live.phase, qIndex: live.qIndex, total: qs.length, doubleDiya: live.qIndex === qs.length - 1,
      question: q && live.phase !== 'intro' ? publicQ(q) : null,
      opensAt: live.opensAt, deadline: live.deadline,
      answered: Object.keys(live.answers).length,
      answeredIds: Object.keys(live.answers),
      result: live.phase === 'reveal' ? live.result : null,
    };
    if (viewer.player) {
      const a = live.answers[viewer.player.id];
      const order = a ? Object.values(live.answers).filter((x) => x.at < a.at).length + 1 : null;
      v.mine = { answered: Boolean(a), choice: a ? a.choice : null, hint: live.hints[viewer.player.id] || null, order,
        points: live.result ? live.result.perPlayer[viewer.player.id] || 0 : null,
        streak: (live.streaks || {})[viewer.player.id] || 0,
        bonus: live.result && live.result.streakBonus ? live.result.streakBonus[viewer.player.id] || 0 : 0 };
    }
    if (viewer.host && q) v.answerKey = q.answer;
    if (viewer.host) v.answersBy = Object.fromEntries(Object.entries(live.answers).map(([k, x]) => [k, x.choice]));
    return v;
  },
};

// ======================= JEOPARDY (self-running) =======================
// The team (or player) in control picks a clue on their phones. Everyone then answers from
// four options; every right answer earns the clue's value. Control then passes on.
const PICK_MS = 15000 / SPEED;
const CLUE_MS = 20000 / SPEED;
const jeopardy = {
  init: () => ({ phase: 'board', used: {}, cur: null, turn: 0, active: null, last: null, pickUntil: now() + PICK_MS + 4000 / SPEED, answers: {} }),
  clue: (game, cur) => game.content.categories[cur.c].clues[cur.i],
  total: (game) => game.content.categories.reduce((n, c) => n + c.clues.length, 0),

  order(game) {
    if (game.mode === 'team' && Object.keys(S.state.teams).length) return Object.values(S.state.teams).map((t) => 't:' + t.id);
    return Object.values(S.state.players).map((p) => 'p:' + p.id);
  },
  at(live, game) {
    const keys = jeopardy.order(game);
    if (!keys.length) return null;
    const i = ((live.turn || 0) % keys.length + keys.length) % keys.length;
    return keys[i];
  },
  advance(live, game) {
    const n = jeopardy.order(game).length || 1;
    live.turn = ((live.turn || 0) + 1) % n;
  },
  open(live, game, c, i) {
    if (live.phase !== 'board') return;
    const k = `${c}-${i}`;
    const cat = game.content.categories[c];
    if (!cat || !cat.clues[i] || live.used[k]) return;
    live.phase = 'clue';
    live.cur = { c: Number(c), i: Number(i) };
    live.active = jeopardy.at(live, game);
    live.answers = {};
    live.last = null;
    live.opensAt = now() + 1500 / SPEED;
    live.deadline = live.opensAt + CLUE_MS;
  },
  // Picks the cheapest clue left in a random category when the picker runs out of time.
  autoPick(live, game) {
    const left = [];
    game.content.categories.forEach((c, ci) => c.clues.forEach((cl, i) => { if (!live.used[`${ci}-${i}`]) left.push([ci, i, cl.value]); }));
    if (!left.length) return;
    const min = Math.min(...left.map((x) => x[2]));
    const cheapest = left.filter((x) => x[2] === min);
    const [c, i] = cheapest[crypto.randomInt(cheapest.length)];
    jeopardy.open(live, game, c, i);
  },
  close(live, game) {
    if (live.phase !== 'clue' || !live.cur) return;
    const clue = jeopardy.clue(game, live.cur);
    const catName = game.content.categories[live.cur.c].name;
    const right = Object.entries(live.answers).filter(([, a]) => a.choice === clue.answer).sort((x, y) => x[1].at - y[1].at);
    right.forEach(([pid]) => { S.award(pid, clue.value, `${game.title}: ${catName} ${clue.value}`, game.id); S.stat(pid).correct++; });
    Object.keys(live.answers).forEach((pid) => { S.stat(pid).answered++; });
    if (right[0]) S.stat(right[0][0]).buzzWins++;
    const key = `${live.cur.c}-${live.cur.i}`;
    live.used[key] = { by: right.length ? live.active : null, value: clue.value };
    live.last = { key: live.active, correct: right.length > 0, value: clue.value, right: right.map(([pid]) => pid), counts: countBy(live.answers, clue.options.length) };
    live.phase = 'answer';
    live.until = now() + 5000 / SPEED;
    jeopardy.advance(live, game);
  },
  next(live, game) {
    if (Object.keys(live.used).length >= jeopardy.total(game)) { live.phase = 'done'; return; }
    live.phase = 'board';
    live.cur = null;
    live.active = null;
    live.answers = {};
    live.pickUntil = now() + PICK_MS;
  },

  host() {},

  player(live, game, p, a, ctx) {
    if (a.type === 'pick') {
      if (live.phase !== 'board') throw new Error('Wait for the board.');
      const up = jeopardy.at(live, game);
      if (S.entityKeyFor(p, game) !== up) throw new Error('It’s not your turn to pick.');
      jeopardy.open(live, game, Number(a.c), Number(a.i));
      return;
    }
    if (a.type !== 'answer') return;
    if (live.phase !== 'clue') throw new Error('Too late!');
    const t = now();
    if (t < live.opensAt || t > live.deadline + 250 || live.answers[p.id]) return;
    const clue = jeopardy.clue(game, live.cur);
    const choice = Number(a.choice);
    if (!(choice >= 0 && choice < clue.options.length)) return;
    live.answers[p.id] = { choice, at: t };
    if (onlineAnsweredAll(live.answers, ctx.online)) jeopardy.close(live, game);
  },

  view(live, game, viewer) {
    const upKey = live.phase === 'clue' || live.phase === 'answer' ? live.active : jeopardy.at(live, game);
    const cats = game.content.categories.map((c, ci) => ({
      name: c.name,
      clues: c.clues.map((cl, i) => ({ value: cl.value, used: Boolean(live.used[`${ci}-${i}`]), by: live.used[`${ci}-${i}`] ? live.used[`${ci}-${i}`].by : null })),
    }));
    const clue = live.cur && (live.phase === 'clue' || live.phase === 'answer') ? jeopardy.clue(game, live.cur) : null;
    const reveal = live.phase === 'answer';
    const v = {
      phase: live.phase,
      categories: cats,
      cur: clue ? live.cur : null,
      clue: clue ? { q: clue.q, value: clue.value, category: game.content.categories[live.cur.c].name, options: clue.options, a: reveal ? clue.a : null, answer: reveal ? clue.answer : null } : null,
      opensAt: live.opensAt || null, deadline: live.deadline || null, pickUntil: live.pickUntil || null, until: live.until || null,
      answered: Object.keys(live.answers || {}).length,
      answeredIds: Object.keys(live.answers || {}),
      turn: upKey ? S.entityInfo(upKey) : null,
      last: live.last && reveal ? { ...live.last, info: S.entityInfo(live.last.key) } : null,
      entities: Object.fromEntries(Object.values(live.used).filter((u) => u.by).map((u) => [u.by, S.entityInfo(u.by)])),
    };
    if (viewer.player) {
      const mine = S.entityKeyFor(viewer.player, game);
      const a = (live.answers || {})[viewer.player.id];
      v.mine = { key: mine, up: Boolean(mine && upKey === mine), choice: a ? a.choice : null,
        earned: reveal && live.last && live.last.right.includes(viewer.player.id) ? live.last.value : 0 };
    }
    return v;
  },
};

// ======================= KBC =======================
// Solo. Every question is open to the whole room. The fastest right answer gets the full
// value, and each later right answer gets less.
function placePoints(full, rank) {
  let pts = full;
  for (let i = 0; i < rank; i++) {
    const next = Math.round((pts * 0.7) / 10) * 10;
    pts = next < pts ? next : pts - 10;
  }
  return Math.max(10, pts);
}

const kbc = {
  init: () => ({ phase: 'idle', qIndex: -1, answers: {}, result: null }),
  list(game) {
    const out = [];
    (game.content.ladder || []).forEach((level) => {
      (level.questions || []).forEach((q) => out.push({ ...q, points: level.points || 100, time: q.time || 20 }));
    });
    return out;
  },
  close(live, game) {
    if (live.phase !== 'question' || live.result) return;
    const q = kbc.list(game)[live.qIndex];
    if (!q) return;
    const correct = Object.entries(live.answers).filter(([, a]) => a.choice === q.answer).sort((a, b) => a[1].at - b[1].at);
    const ranking = correct.map(([pid, a], rank) => {
      const paid = S.award(pid, placePoints(q.points, rank), `${game.title}: #${rank + 1}`, game.id) || 0;
      if (rank === 0) S.stat(pid).fastest++;
      S.stat(pid).correct++;
      S.stat(pid).answered++;
      S.stat(pid).kbcBest = Math.max(S.stat(pid).kbcBest, paid);
      return { id: pid, ms: Math.max(0, a.at - live.opensAt), points: paid, rank: rank + 1 };
    });
    Object.keys(live.answers).forEach((pid) => { if (!correct.some(([id]) => id === pid)) S.stat(pid).answered++; });
    live.result = { answer: q.answer, points: q.points, counts: countBy(live.answers, q.options.length), ranking };
    live.phase = 'reveal';
  },

  host(live, game, a) {
    if (!['idle', 'question', 'reveal', 'done'].includes(live.phase)) {
      Object.assign(live, { phase: 'idle', qIndex: -1, answers: {}, result: null });
    }
    const qs = kbc.list(game);
    switch (a.type) {
      case 'next': {
        const n = (live.qIndex == null ? -1 : live.qIndex) + 1;
        if (n >= qs.length) { live.phase = 'done'; live.result = null; return; }
        const q = qs[n];
        const opensAt = showOpen(1800 / SPEED);
        live.qIndex = n;
        live.answers = {};
        live.result = null;
        live.opensAt = opensAt;
        live.deadline = opensAt + ((q.time || 20) * 1000) / SPEED;
        live.phase = 'question';
        break;
      }
      case 'reveal': kbc.close(live, game); break;
      default:
    }
  },

  player(live, game, p, a, ctx) {
    if (a.type !== 'answer') return;
    if (live.phase !== 'question') throw new Error('Too late!');
    const t = now();
    if (t < live.opensAt || t > live.deadline + 250 || live.answers[p.id]) return;
    const q = kbc.list(game)[live.qIndex];
    const choice = Number(a.choice);
    if (!q || !Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return;
    live.answers[p.id] = { choice, at: t };
    if (onlineAnsweredAll(live.answers, ctx.online)) kbc.close(live, game);
  },

  view(live, game, viewer) {
    if (!['idle', 'question', 'reveal', 'done'].includes(live.phase)) live.phase = 'idle';
    const qs = kbc.list(game);
    const q = live.qIndex >= 0 ? qs[live.qIndex] : null;
    const showQ = q && (live.phase === 'question' || live.phase === 'reveal');
    const v = {
      phase: live.phase, qIndex: live.qIndex, total: qs.length,
      points: q ? q.points : 0,
      opensAt: live.opensAt || null, deadline: live.deadline || null,
      answered: Object.keys(live.answers || {}).length,
      answeredIds: Object.keys(live.answers || {}),
      question: showQ ? publicQ(q) : null,
      result: live.phase === 'reveal' && live.result ? live.result : null,
    };
    if (viewer.host && q && showQ) v.answerKey = q.answer;
    if (viewer.player) {
      const mine = (live.answers || {})[viewer.player.id];
      const row = live.result && live.result.ranking.find((r) => r.id === viewer.player.id);
      v.mine = { choice: mine ? mine.choice : null, rank: row ? row.rank : null, points: row ? row.points : 0 };
    }
    return v;
  },
};


// ======================= HOOK STEP (self-running) =======================
// A team is called up and a song plays (name hidden). Dancers tap "I'm dancing" for a bravery
// bonus. When the clock ends the blur lifts and everyone else rates the dance 1–5 diyas.
// The rounded average × 100 goes to every member of that team.
const READY_MS = 6000 / SPEED, PERFORM_MS = 25000 / SPEED, VOTE_MS = 15000 / SPEED, SCORED_MS = 6000 / SPEED;
const hookstep = {
  init: () => ({ phase: 'idle', perf: null, results: [], usedSongs: [], queue: null, until: now() + 6000 / SPEED }),
  bonus: (game) => Number(game.content.himmatBonus) || 100,
  performers(game) {
    if (Object.keys(S.state.teams).length) return Object.values(S.state.teams).map((t) => 't:' + t.id);
    return Object.values(S.state.players).map((p) => 'p:' + p.id);
  },
  members(key) {
    const e = S.parseEntity(key);
    if (!e) return [];
    return e.kind === 'team' ? S.teamMembers(e.id) : [S.state.players[e.id]].filter(Boolean);
  },
  pickSong(live, game) {
    const songs = game.content.songs || [];
    let pool = songs.map((_, i) => i).filter((i) => !live.usedSongs.includes(i));
    if (!pool.length) pool = songs.map((_, i) => i);
    const RANK = { easy: 0, medium: 1, hard: 2 };
    const rank = (i) => RANK[songs[i].level] ?? 1;
    const lowest = Math.min(...pool.map(rank));
    pool = pool.filter((i) => rank(i) === lowest);
    return pool[crypto.randomInt(pool.length)];
  },
  // Moves to the next stage when its clock runs out. Called by the director.
  step(live, game) {
    const t = now();
    if (live.until && t < live.until) return;
    if (live.phase === 'idle' || live.phase === 'scored') {
      if (!live.queue) live.queue = S.shuffle(hookstep.performers(game)).slice(0, Number(game.content.rounds) || 4);
      const key = live.queue.shift();
      if (!key) { live.phase = 'done'; live.until = null; return; }
      const songIndex = hookstep.pickSong(live, game);
      live.usedSongs.push(songIndex);
      live.perf = { team: key, songIndex, dancers: [], votes: {}, stars: null };
      live.phase = 'ready';
      live.until = t + READY_MS;
    } else if (live.phase === 'ready') {
      live.phase = 'perform';
      live.startedAt = t;
      live.until = t + ((Number(game.content.performSeconds) || 25) * 1000) / SPEED;
    } else if (live.phase === 'perform') {
      live.phase = 'judge';
      live.until = t + VOTE_MS;
    } else if (live.phase === 'judge') {
      hookstep.score(live, game);
      live.phase = 'scored';
      live.until = t + SCORED_MS;
    }
  },
  score(live, game) {
    const perf = live.perf;
    const votes = Object.values(perf.votes || {});
    const avg = votes.length ? votes.reduce((a, b) => a + b, 0) / votes.length : 3;
    perf.stars = Math.max(1, Math.min(5, Math.round(avg)));
    const teamPoints = perf.stars * 100;
    const bonus = hookstep.bonus(game);
    const song = (game.content.songs || [])[perf.songIndex];
    const label = `${game.title}: ${song ? song.title.split(' — ')[0] : 'dance'}`;
    hookstep.members(perf.team).forEach((m) => S.award(m.id, teamPoints, label, game.id));
    perf.dancers.forEach((pid) => {
      S.award(pid, bonus, '💃 Himmat bonus', game.id);
      S.stat(pid).hookBest = Math.max(S.stat(pid).hookBest, teamPoints + bonus);
    });
    const result = { team: perf.team, songIndex: perf.songIndex, stars: perf.stars, votes: votes.length, applause: 0, crowd: 0, teamPoints, dancers: [...perf.dancers], bonus };
    live.results.push(result);
    live.last = result;
  },

  host() {},

  player(live, game, p, a) {
    const perf = live.perf;
    if (a.type === 'dance') {
      if (!perf || !['ready', 'perform'].includes(live.phase)) throw new Error('Wait for your song!');
      if (!hookstep.members(perf.team).some((m) => m.id === p.id)) throw new Error('It’s not your turn to dance yet.');
      if (!perf.dancers.includes(p.id)) perf.dancers.push(p.id);
      return;
    }
    if (a.type === 'vote') {
      if (!perf || live.phase !== 'judge') throw new Error('Voting isn’t open.');
      if (hookstep.members(perf.team).some((m) => m.id === p.id)) throw new Error('You can’t rate your own dance!');
      perf.votes[p.id] = Math.max(1, Math.min(5, Math.round(Number(a.stars) || 3)));
      const voters = Object.values(S.state.players).filter((x) => !hookstep.members(perf.team).some((m) => m.id === x.id));
      if (voters.length && voters.every((x) => perf.votes[x.id])) { hookstep.score(live, game); live.phase = 'scored'; live.until = now() + SCORED_MS; }
    }
  },

  view(live, game, viewer) {
    const songs = game.content.songs || [];
    const perf = live.perf;
    const pinfo = (pid) => { const p = S.state.players[pid]; return p ? { id: p.id, name: p.name, avatar: p.avatar, color: p.color } : null; };
    const hidden = live.phase === 'ready' || (live.phase === 'perform' && now() < live.until);
    const v = {
      phase: live.phase, until: live.until, startedAt: live.startedAt, bonus: hookstep.bonus(game), showStep: false, songs: [],
      perf: perf ? {
        team: S.entityInfo(perf.team),
        members: hookstep.members(perf.team).map((m) => pinfo(m.id)),
        song: (() => { const raw = perf.songIndex != null && !hidden ? songs[perf.songIndex] : null; return raw ? { title: raw.title, step: '' } : null; })(),
        dancers: perf.dancers.map(pinfo).filter(Boolean),
        stars: perf.stars, votes: Object.keys(perf.votes || {}).length, applause: null, measure: null,
      } : null,
      results: live.results.map((r) => ({ ...r, team: S.entityInfo(r.team), song: songs[r.songIndex] ? songs[r.songIndex].title : '', dancers: r.dancers.map(pinfo).filter(Boolean) })),
      last: live.last && live.phase === 'scored' ? { ...live.last, team: S.entityInfo(live.last.team), dancers: live.last.dancers.map(pinfo).filter(Boolean) } : null,
    };
    if (viewer.player && perf) {
      const onStage = hookstep.members(perf.team).some((m) => m.id === viewer.player.id);
      v.mine = { onStage, dancing: perf.dancers.includes(viewer.player.id), vote: (perf.votes || {})[viewer.player.id] || null };
    }
    return v;
  },
};

const custom = {
  init: () => ({ phase: 'live' }),
  host() {},
  player() {},
  view: (live, game) => ({ phase: 'live', description: game.content.description || '' }),
};

const engines = { quiz, jeopardy, kbc, hookstep, custom };

// Apply any deadlines that have passed. Runs before every request.
function tick(state) {
  const t = now();
  if (state.tv.announce && state.tv.announce.until < t - 1000) state.tv.announce = null;
  const live = state.live;
  if (!live) return;
  const base = state.games.find((g) => g.id === live.gameId);
  const game = base && live.content ? { ...base, content: live.content } : base;
  if (!game) return;
  if (game.type === 'quiz' && live.phase === 'question' && t > live.deadline + 300) quiz.reveal(live, game);
  if (game.type === 'kbc' && live.phase === 'question' && live.deadline && t > live.deadline + 300) kbc.close(live, game);
  if (game.type === 'hookstep' && live.phase === 'spin' && t > live.spinUntil) live.phase = 'ready';
}

// Earliest upcoming deadline, so clients know when to ask the server to tick.
function nextDeadline(state) {
  const c = [];
  if (state.tv.announce) c.push(state.tv.announce.until + 1100);
  const live = state.live;
  if (live) {
    if (live.phase === 'question' && live.deadline) c.push(live.deadline + 400);
    if (live.phase === 'spin') c.push(live.spinUntil + 100);
    if (live.phase === 'perform' && live.until) c.push(live.until + 150);
  }
  if (state.demo && state.demo.plan && state.demo.plan.acts.length) c.push(state.demo.plan.acts[0].at + 50);
  const future = c.filter((x) => x > now() - 5000);
  return future.length ? Math.min(...future) : null;
}

module.exports = { engines, tick, nextDeadline, SPEED };
