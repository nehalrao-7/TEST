// Game engines. Each engine owns the `live` object while its game is running
// and exposes: init, view (per viewer), host (actions), player (actions), resume.

const crypto = require('crypto');
const S = require('./state');

const now = () => Date.now();
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
    live.opensAt = showOpen(2800);
    live.deadline = live.opensAt + (q.time || 20) * 1000;
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

// ======================= JEOPARDY =======================
// Teams take one turn at a time. There are no buzzers. A right answer pays every person on that team.
const jeopardy = {
  init: () => ({ phase: 'board', used: {}, cur: null, turn: 0, active: null, last: null }),
  clue: (game, cur) => game.content.categories[cur.c].clues[cur.i],

  order(game) {
    if (game.mode === 'team') return Object.values(S.state.teams).map((t) => 't:' + t.id);
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

  host(live, game, a) {
    if (!['board', 'clue', 'answer'].includes(live.phase)) { live.phase = 'board'; live.cur = null; }
    const key = live.cur ? `${live.cur.c}-${live.cur.i}` : null;
    switch (a.type) {
      case 'pick': {
        if (live.phase !== 'board') return;
        const k = `${a.c}-${a.i}`;
        const cat = game.content.categories[a.c];
        if (!cat || !cat.clues[a.i] || live.used[k]) return;
        const who = jeopardy.at(live, game);
        if (!who) throw new Error('Add teams first, then pick a clue.');
        live.phase = 'clue';
        live.cur = { c: Number(a.c), i: Number(a.i) };
        live.active = who;
        live.last = null;
        break;
      }
      case 'setTurn': {
        if (live.phase !== 'board') return;
        const i = jeopardy.order(game).indexOf(a.key);
        if (i >= 0) live.turn = i;
        break;
      }
      case 'correct':
      case 'wrong':
      case 'reveal': {
        if (live.phase !== 'clue' || !live.cur) return;
        const clue = jeopardy.clue(game, live.cur);
        const who = live.active;
        const catName = game.content.categories[live.cur.c].name;
        const correct = a.type === 'correct';
        if (correct) {
          S.awardEntity(who, clue.value, `${game.title}: ${catName} ${clue.value}`, game.id);
          const e = S.parseEntity(who);
          const members = e && e.kind === 'team' ? S.teamMembers(e.id) : [S.state.players[e && e.id]].filter(Boolean);
          members.forEach((p) => { S.stat(p.id).buzzWins++; });
        }
        live.used[key] = { by: correct ? who : null, value: correct ? clue.value : 0 };
        live.last = { key: who, correct, value: clue.value };
        live.phase = 'answer';
        jeopardy.advance(live, game);
        break;
      }
      case 'board':
        live.phase = 'board';
        live.cur = null;
        live.active = null;
        break;
      default:
    }
  },

  player() {
    throw new Error('No buzzers — answer out loud when your team is up.');
  },

  view(live, game, viewer) {
    if (!['board', 'clue', 'answer'].includes(live.phase)) live.phase = 'board';
    const upKey = live.phase === 'clue' ? live.active : jeopardy.at(live, game);
    const cats = game.content.categories.map((c, ci) => ({
      name: c.name,
      clues: c.clues.map((cl, i) => ({ value: cl.value, used: Boolean(live.used[`${ci}-${i}`]), by: live.used[`${ci}-${i}`] ? live.used[`${ci}-${i}`].by : null })),
    }));
    const clue = live.cur && live.phase !== 'board' ? jeopardy.clue(game, live.cur) : null;
    const v = {
      phase: live.phase,
      categories: cats,
      cur: live.phase === 'board' ? null : live.cur,
      clue: clue ? { q: clue.q, value: clue.value, category: game.content.categories[live.cur.c].name, a: live.phase === 'answer' || viewer.host ? clue.a : null } : null,
      turn: upKey ? S.entityInfo(upKey) : null,
      last: live.last && live.phase === 'answer' ? { ...live.last, info: S.entityInfo(live.last.key) } : null,
      entities: Object.fromEntries(Object.values(live.used).filter((u) => u.by).map((u) => [u.by, S.entityInfo(u.by)])),
    };
    if (viewer.player) {
      const mine = S.entityKeyFor(viewer.player, game);
      v.mine = { key: mine, up: Boolean(mine && upKey === mine), earned: v.last && v.last.correct && v.last.key === mine ? v.last.value : 0 };
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
        const opensAt = showOpen(1800);
        live.qIndex = n;
        live.answers = {};
        live.result = null;
        live.opensAt = opensAt;
        live.deadline = opensAt + (q.time || 20) * 1000;
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


// ======================= HOOK STEP CHALLENGE =======================
const hookstep = {
  // No phones: the TV spins a song and calls a team up; whoever dances is tapped in by the host.
  // Team gets rating points (+ crowd applause), every dancer gets a personal Himmat (bravery) bonus.
  init: () => ({ phase: 'idle', perf: null, results: [], usedSongs: [] }),
  bonus: (game) => Number(game.content.himmatBonus) || 100,

  host(live, game, a) {
    const songs = game.content.songs || [];
    const perf = live.perf;
    switch (a.type) {
      case 'setup': {
        const team = a.team && S.entityInfo(a.team) ? a.team : null;
        if (game.mode === 'team' && !team) throw new Error('Pick the team that is up.');
        const songIndex = a.songIndex != null && a.songIndex !== '' ? Number(a.songIndex) : null;
        live.perf = { team, songIndex: songIndex != null && songs[songIndex] ? songIndex : null, dancers: [], stars: null, applause: null, measure: null };
        live.phase = 'ready';
        break;
      }
      case 'spin': {
        if (!perf) throw new Error('Pick who is up first.');
        let pool = songs.map((_, i) => i).filter((i) => !live.usedSongs.includes(i));
        if (!pool.length) pool = songs.map((_, i) => i);
        perf.songIndex = pool[crypto.randomInt(pool.length)];
        live.phase = 'spin';
        live.spinUntil = now() + 4200;
        break;
      }
      case 'perform': {
        if (!perf || perf.songIndex == null) throw new Error('Pick or spin a song first.');
        if (!live.usedSongs.includes(perf.songIndex)) live.usedSongs.push(perf.songIndex);
        live.phase = 'perform';
        live.startedAt = now();
        live.until = now() + (game.content.performSeconds || 45) * 1000;
        break;
      }
      case 'stop': if (live.phase === 'perform') live.phase = 'judge'; break;
      case 'dancer': {
        if (!perf || !S.state.players[a.pid]) return;
        perf.dancers = perf.dancers.includes(a.pid) ? perf.dancers.filter((x) => x !== a.pid) : [...perf.dancers, a.pid];
        break;
      }
      case 'rate': if (perf) perf.stars = Math.max(1, Math.min(5, Math.round(Number(a.stars)))); break;
      case 'measure': if (perf) { perf.measure = { id: S.id(6), at: now() }; } break;
      case 'applause': if (perf) perf.applause = Math.max(0, Math.min(100, Math.round(Number(a.level) || 0))); break;
      case 'score': {
        if (!perf || !['perform', 'judge'].includes(live.phase)) throw new Error('Start the dance first.');
        if (!perf.stars) throw new Error('Rate the dance (1–5 diyas) first.');
        const crowd = Math.round((perf.applause || 0) * 2); // up to +200 for a roaring crowd
        const teamPoints = perf.stars * 100 + crowd;
        const bonus = hookstep.bonus(game);
        const song = songs[perf.songIndex];
        const label = `${game.title}: ${song ? song.title.split(' — ')[0] : 'dance'}`;
        if (perf.team) S.awardEntity(perf.team, teamPoints, label, game.id);
        perf.dancers.forEach((pid) => {
          if (!perf.team) S.award(pid, teamPoints, label, game.id);
          S.award(pid, bonus, '💃 Himmat bonus', game.id);
          S.stat(pid).hookBest = Math.max(S.stat(pid).hookBest, teamPoints + bonus);
        });
        const result = { team: perf.team, songIndex: perf.songIndex, stars: perf.stars, applause: perf.applause || 0, crowd, teamPoints, dancers: [...perf.dancers], bonus };
        live.results.push(result);
        live.last = result;
        live.phase = 'scored';
        break;
      }
      case 'showStep': live.showStep = !live.showStep; break;
      case 'reset': live.phase = 'idle'; live.perf = null; break;
      default:
    }
  },

  player() { throw new Error('No phones needed — watch the TV and come dance! 💃'); },

  // The TV's microphone reports the crowd's applause (0–100).
  applause(live, id, level) {
    if (!live.perf || !live.perf.measure || live.perf.measure.id !== id) return false;
    live.perf.applause = Math.max(0, Math.min(100, Math.round(Number(level) || 0)));
    live.perf.measure = null;
    return true;
  },

  view(live, game, viewer) {
    const songs = game.content.songs || [];
    const perf = live.perf;
    const pinfo = (pid) => { const p = S.state.players[pid]; return p ? { id: p.id, name: p.name, avatar: p.avatar, color: p.color } : null; };
    const team = perf && perf.team ? S.entityInfo(perf.team) : null;
    const v = {
      phase: live.phase, until: live.until, startedAt: live.startedAt, spinUntil: live.spinUntil, bonus: hookstep.bonus(game),
      showStep: Boolean(live.showStep),
      songs: songs.map((x) => x.title),
      perf: perf ? {
        team,
        members: perf.team ? S.teamMembers(S.parseEntity(perf.team).id).map((m) => pinfo(m.id)) : null,
        song: (() => {
          const raw = perf.songIndex != null && live.phase !== 'spin' ? songs[perf.songIndex] : null;
          return raw ? { ...raw, step: (live.showStep || viewer.host) ? raw.step : '' } : null;
        })(),
        dancers: perf.dancers.map(pinfo).filter(Boolean),
        stars: perf.stars, applause: perf.applause, measure: perf.measure,
      } : null,
      results: live.results.map((r) => ({ ...r, team: r.team ? S.entityInfo(r.team) : null, song: songs[r.songIndex] ? songs[r.songIndex].title : '', dancers: r.dancers.map(pinfo).filter(Boolean) })),
      last: live.last && live.phase === 'scored' ? { ...live.last, team: live.last.team ? S.entityInfo(live.last.team) : null, dancers: live.last.dancers.map(pinfo).filter(Boolean) } : null,
    };
    if (viewer.player) {
      const me = viewer.player.id;
      v.mine = { dancing: Boolean(perf && perf.dancers.includes(me)), myTeamUp: Boolean(perf && perf.team && perf.team === 't:' + viewer.player.teamId),
        earned: live.last && live.phase === 'scored' && live.last.dancers.includes(me) ? live.last.bonus : 0 };
    }
    return v;
  },
};

// ======================= CUSTOM (host-scored) =======================
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
  }
  if (state.demo && state.demo.plan && state.demo.plan.acts.length) c.push(state.demo.plan.acts[0].at + 50);
  const future = c.filter((x) => x > now() - 5000);
  return future.length ? Math.min(...future) : null;
}

module.exports = { engines, tick, nextDeadline };
