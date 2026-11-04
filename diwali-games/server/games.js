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
    live.opensAt = now() + 3000;
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
    const reason = `${game.title} Q${live.qIndex + 1}${mult > 1 ? ' ✨ Double Diya' : ''}`;
    if (game.mode === 'team') {
      for (const t of Object.values(S.state.teams)) {
        const members = S.teamMembers(t.id);
        if (!members.length) continue;
        const pts = Math.round(members.reduce((a, m) => a + (perPlayer[m.id] || 0), 0) / members.length / 5) * 5;
        perTeam[t.id] = pts;
        if (pts > 0) members.forEach((m) => S.award(m.id, pts, reason, game.id));
      }
    } else {
      for (const [pid, pts] of Object.entries(perPlayer)) if (pts > 0) S.award(pid, pts, reason, game.id);
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
        if (live.streaks[p.id] >= 3) { streakBonus[p.id] = 50; S.award(p.id, 50, `🔥 ${live.streaks[p.id]} in a row`, game.id); }
      } else live.streaks[p.id] = 0;
    }
    if (fastest[0]) S.stat(fastest[0].id).fastest++;
    const order = Object.entries(live.answers).sort((a, b) => a[1].at - b[1].at).map(([pid]) => pid);
    live.result = { answer: q.answer, double: mult > 1, counts: countBy(live.answers, q.options.length), perPlayer, perTeam, fastest, streaks: { ...live.streaks }, streakBonus,
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
// The board lives on the TV; the host picks clues. Buzzers stay "armed" until the host opens them
// (buzzing early earns a short lockout, as on the real show). The team in control picks next,
// and two hidden Daily Doubles let the team in control wager.
const jeopardy = {
  init: () => ({ phase: 'board', used: {}, cur: null, buzzOpen: false, buzzes: [], locked: [], active: null, last: null, early: {}, control: null, dd: null, wager: null, ddActive: false }),
  clue: (game, cur) => game.content.categories[cur.c].clues[cur.i],
  EARLY_LOCK: 600,

  ensureSetup(live, game) {
    if (!live.dd) {
      const cells = [];
      game.content.categories.forEach((c, ci) => c.clues.forEach((_, i) => { if (i > 0) cells.push(`${ci}-${i}`); }));
      live.dd = S.shuffle(cells).slice(0, Math.min(2, Math.max(0, cells.length - 3)));
    }
    if (!live.control) {
      if (game.mode === 'team') { const t = S.shuffle(Object.values(S.state.teams))[0]; live.control = t ? 't:' + t.id : null; }
      else { const p = S.shuffle(Object.values(S.state.players))[0]; live.control = p ? 'p:' + p.id : null; }
    }
  },

  advance(live) {
    const next = live.buzzes.find((b) => !live.locked.includes(b.key));
    live.active = next ? next.key : null;
  },

  maxWager(live, game) {
    const top = Math.max(...game.content.categories.flatMap((c) => c.clues.map((cl) => cl.value)));
    const e = S.parseEntity(live.control);
    let score = 0;
    if (e && e.kind === 'team') { const t = S.teamsView().find((x) => x.id === e.id); score = t ? t.gamePoints : 0; }
    else if (e) {
      score = S.state.ledger.filter((x) => x.playerId === e.id && x.gameId === game.id).reduce((n, x) => n + x.amount, 0);
    }
    return Math.max(top, score);
  },

  host(live, game, a) {
    jeopardy.ensureSetup(live, game);
    const key = live.cur ? `${live.cur.c}-${live.cur.i}` : null;
    switch (a.type) {
      case 'pick': {
        const k = `${a.c}-${a.i}`;
        const cat = game.content.categories[a.c];
        if (!cat || !cat.clues[a.i] || live.used[k]) return;
        const isDD = live.dd.includes(k) && live.control;
        Object.assign(live, { phase: isDD ? 'dd' : 'clue', cur: { c: a.c, i: a.i }, buzzOpen: false, buzzes: [], locked: [], active: null, openedAt: null, last: null, early: {}, wager: null, ddActive: false });
        if (isDD) S.announce({ emoji: '💎', title: 'DAILY DOUBLE!', text: `${(S.entityInfo(live.control) || {}).name || 'The team in control'} — make your wager!`, kind: 'dd', ms: 3500 });
        break;
      }
      case 'wager': {
        if (live.phase !== 'dd') return;
        const max = jeopardy.maxWager(live, game);
        live.wager = Math.max(100, Math.min(max, Math.round(Number(a.amount) / 50) * 50 || 100));
        live.ddActive = true;
        live.active = live.control;
        live.phase = 'clue';
        break;
      }
      case 'openBuzz': if (live.phase === 'clue' && !live.ddActive) { live.buzzOpen = true; live.openedAt = now(); } break;
      case 'setControl': if (S.entityInfo(a.key)) live.control = a.key; break;
      case 'correct': {
        if (!live.active || live.phase !== 'clue') return;
        const clue = jeopardy.clue(game, live.cur);
        const value = live.ddActive ? live.wager : clue.value;
        S.awardEntity(live.active, value, `${game.title}: ${game.content.categories[live.cur.c].name} ${live.ddActive ? '💎 Daily Double' : clue.value}`, game.id);
        const buzzer = live.buzzes.find((b) => b.key === live.active);
        if (buzzer) S.stat(buzzer.pid).buzzWins++;
        live.used[key] = { by: live.active, value };
        live.last = { key: live.active, correct: true, value, dd: live.ddActive };
        live.control = live.active; // correct answer takes control of the board
        live.phase = 'answer';
        live.buzzOpen = false;
        break;
      }
      case 'wrong': {
        if (!live.active || live.phase !== 'clue') return;
        const clue = jeopardy.clue(game, live.cur);
        if (live.ddActive) {
          S.awardEntity(live.active, -live.wager, `${game.title}: 💎 Daily Double`, game.id);
          live.used[key] = { by: null };
          live.last = { key: live.active, correct: false, value: live.wager, dd: true };
          live.phase = 'answer';
          break;
        }
        if (game.content.wrongPenalty) S.awardEntity(live.active, -clue.value, `${game.title}: wrong answer`, game.id);
        live.last = { key: live.active, correct: false, value: clue.value };
        live.locked.push(live.active);
        jeopardy.advance(live);
        break;
      }
      case 'reveal': {
        if (!live.cur) return;
        live.used[key] = live.used[key] || { by: null };
        live.phase = 'answer';
        live.buzzOpen = false;
        break;
      }
      case 'board': Object.assign(live, { phase: 'board', cur: null, buzzOpen: false, buzzes: [], locked: [], active: null, wager: null, ddActive: false }); break;
      default:
    }
  },

  player(live, game, p, a) {
    if (a.type !== 'buzz') return;
    if (live.phase !== 'clue' || live.ddActive) throw new Error('No buzzing right now.');
    const key = S.entityKeyFor(p, game);
    if (!key) throw new Error('You are not on a team yet — ask the host.');
    if (!live.buzzOpen) { live.early = live.early || {}; live.early[key] = now(); return; } // jumped the gun
    if (live.early && live.early[key] && now() < live.openedAt + jeopardy.EARLY_LOCK) throw new Error('Too early! Locked for a moment…');
    if (live.locked.includes(key)) throw new Error('Your buzz is locked for this clue.');
    if (live.buzzes.some((b) => b.key === key)) return;
    live.buzzes.push({ key, pid: p.id, ms: now() - live.openedAt });
    if (!live.active) jeopardy.advance(live);
  },

  view(live, game, viewer) {
    jeopardy.ensureSetup(live, game);
    const cats = game.content.categories.map((c, ci) => ({
      name: c.name,
      clues: c.clues.map((cl, i) => ({ value: cl.value, used: Boolean(live.used[`${ci}-${i}`]), by: live.used[`${ci}-${i}`] ? live.used[`${ci}-${i}`].by : null, dd: viewer.host ? live.dd.includes(`${ci}-${i}`) : undefined })),
    }));
    const clue = live.cur ? jeopardy.clue(game, live.cur) : null;
    const v = {
      phase: live.phase, categories: cats, cur: live.cur, buzzOpen: live.buzzOpen, openedAt: live.openedAt,
      clue: clue ? { q: clue.q, value: live.ddActive ? live.wager : clue.value, category: game.content.categories[live.cur.c].name, a: live.phase === 'answer' || viewer.host ? clue.a : null } : null,
      buzzes: live.buzzes.map((b) => ({ ...S.entityInfo(b.key), pid: b.pid, buzzerName: S.state.players[b.pid] ? S.state.players[b.pid].name : '', ms: b.ms })),
      active: live.active ? S.entityInfo(live.active) : null,
      control: live.control ? S.entityInfo(live.control) : null,
      dd: live.phase === 'dd' || live.ddActive, wager: live.wager,
      locked: live.locked, last: live.last ? { ...live.last, info: S.entityInfo(live.last.key) } : null,
      entities: Object.fromEntries(Object.values(live.used).filter((u) => u.by).map((u) => [u.by, S.entityInfo(u.by)])),
    };
    if (viewer.host) v.maxWager = jeopardy.maxWager(live, game);
    if (viewer.player) {
      const key = S.entityKeyFor(viewer.player, game);
      v.mine = { key, locked: live.locked.includes(key), buzzed: live.buzzes.some((b) => b.key === key), active: live.active === key,
        early: Boolean(live.early && live.early[key]), inControl: live.control === key,
        position: live.buzzes.findIndex((b) => b.key === key) + 1 };
    }
    return v;
  },
};

// ======================= KBC =======================
const kbc = {
  init: () => ({ phase: 'idle', seatCount: 0, ffIndex: -1, ff: null, hot: null, history: [] }),
  currentQ: (game, hot) => {
    const qs = game.content.ladder[hot.qLevel].questions;
    // Never ask the hot-seat guest a personal question about themselves.
    for (let k = 0; k < qs.length; k++) {
      const q = qs[(hot.seat + k) % qs.length];
      const who = q.involves || (q.about ? [q.about] : []);
      if (!who.includes(hot.pid)) return q;
    }
    return qs[hot.seat % qs.length];
  },
  safeAmount(game, levelReached) {
    let amt = 0;
    game.content.ladder.forEach((l, i) => { if (l.safe && i < levelReached) amt = l.points; });
    return amt;
  },

  finish(live, game, winnings, outcome) {
    const hot = live.hot;
    hot.status = outcome;
    hot.winnings = winnings;
    hot.qPhase = 'over';
    if (winnings > 0) S.award(hot.pid, winnings, `${game.title} hot seat`, game.id);
    S.stat(hot.pid).kbcBest = Math.max(S.stat(hot.pid).kbcBest, winnings);
    const p = S.state.players[hot.pid];
    live.history.push({ pid: hot.pid, winnings, level: hot.level, outcome });
    const lines = { won: `${p.name} conquered the whole ladder — ${winnings} points! 🏆`, walked: `${p.name} walks away with ${winnings} points.`, wrong: `${p.name} leaves the hot seat with ${winnings} points.` };
    S.announce({ emoji: outcome === 'won' ? '🏆' : '💰', title: outcome === 'won' ? 'CROREPATI!' : 'HOT SEAT OVER', text: lines[outcome], kind: 'kbc' });
  },

  resume(live, game, ctx) {
    if (live.phase === 'ff' && live.ff) schedule('kbc-ff', live.ff.deadline + 300, () => kbc.ffClose(live, game));
    if (live.hot && live.hot.poll && live.hot.poll.open) schedule('kbc-poll', live.hot.poll.deadline, () => { live.hot.poll.open = false; });
  },

  ffClose(live, game) {
    if (live.phase !== 'ff') return;
    const q = game.content.fastestFinger[live.ff.qi];
    const correct = Object.entries(live.ff.answers).filter(([, a]) => a.choice === q.answer).sort((a, b) => a[1].at - b[1].at);
    live.ff.ranking = correct.map(([pid, a]) => ({ id: pid, ms: a.at - live.ff.opensAt }));
    live.ff.winner = correct.length ? correct[0][0] : null;
    if (live.ff.winner) S.stat(live.ff.winner).ffWins++;
    live.ff.counts = countBy(live.ff.answers, q.options.length);
    live.phase = 'ff-result';
  },

  host(live, game, a, ctx) {
    const hot = live.hot;
    switch (a.type) {
      case 'ff': {
        const pool = game.content.fastestFinger || [];
        if (!pool.length) throw new Error('No Fastest Finger questions configured.');
        live.ffIndex = (live.ffIndex + 1) % pool.length;
        const q = pool[live.ffIndex];
        const opensAt = now() + 3000;
        live.ff = { qi: live.ffIndex, opensAt, deadline: opensAt + (q.time || 15) * 1000, answers: {}, winner: null };
        live.phase = 'ff';
        live.hot = null;
        kbc.resume(live, game, ctx);
        break;
      }
      case 'ffClose': kbc.ffClose(live, game); break;
      case 'seat': {
        const pid = a.playerId || (live.ff && live.ff.winner);
        if (!pid || !S.state.players[pid]) throw new Error('Pick a player for the hot seat.');
        live.hot = { pid, seat: live.seatCount++, level: 0, qLevel: 0, qPhase: 'question', locked: null, removed: [], poll: null, phoneUntil: null,
          lifelines: { fifty: true, poll: true, phone: true }, status: 'playing' };
        live.phase = 'hot';
        const p = S.state.players[pid];
        S.announce({ emoji: '🪑', title: 'HOT SEAT!', text: `${p.name}, welcome to Kaun Banega Crorepati!`, kind: 'kbc', ms: 4000 });
        break;
      }
      case 'lock': if (hot && hot.qPhase === 'question') hot.locked = Number(a.choice); break;
      case 'unlock': if (hot && hot.qPhase === 'question') hot.locked = null; break;
      case 'reveal': {
        if (!hot || hot.qPhase !== 'question' || hot.locked == null) throw new Error('No answer locked yet.');
        const q = kbc.currentQ(game, hot);
        hot.correct = hot.locked === q.answer;
        hot.answer = q.answer;
        hot.qPhase = 'reveal';
        // Audience predictions (everyone plays along, Catan-style): calling it right earns +25.
        const preds = hot.predictions || {};
        const right = Object.entries(preds).filter(([, v]) => (v === 'sahi') === hot.correct).map(([pid]) => pid);
        right.forEach((pid) => S.award(pid, 25, '🔮 Called it in KBC', game.id, { noDouble: true }));
        hot.predResult = { right, total: Object.keys(preds).length };
        if (hot.correct) {
          hot.level++;
          if (hot.level >= game.content.ladder.length) kbc.finish(live, game, game.content.ladder[hot.level - 1].points, 'won');
        } else {
          kbc.finish(live, game, kbc.safeAmount(game, hot.level), 'wrong');
          hot.qPhase = 'over';
        }
        break;
      }
      case 'nextQ': if (hot && hot.qPhase === 'reveal' && hot.status === 'playing') Object.assign(hot, { qLevel: hot.level, qPhase: 'question', locked: null, removed: [], poll: null, phoneUntil: null, correct: null, answer: null, predictions: {}, predResult: null }); break;
      case 'walk': kbc.walk(live, game); break;
      case 'lifeline': kbc.lifeline(live, game, a.name, ctx); break;
      case 'idle': live.phase = 'idle'; live.hot = null; live.ff = null; break;
      default:
    }
  },

  walk(live, game) {
    const hot = live.hot;
    if (!hot || hot.status !== 'playing' || hot.qPhase !== 'question') throw new Error('Cannot walk away right now.');
    const winnings = hot.level > 0 ? game.content.ladder[hot.level - 1].points : 0;
    hot.answer = kbc.currentQ(game, hot).answer;
    kbc.finish(live, game, winnings, 'walked');
  },

  lifeline(live, game, name, ctx) {
    const hot = live.hot;
    if (!hot || hot.qPhase !== 'question' || hot.locked != null) throw new Error('Lifelines are not available right now.');
    if (!hot.lifelines[name]) throw new Error('That lifeline is used up.');
    hot.lifelines[name] = false;
    const q = kbc.currentQ(game, hot);
    const p = S.state.players[hot.pid];
    if (name === 'fifty') {
      hot.removed = pickWrong(q, 2);
      S.announce({ emoji: '✂️', title: '50 : 50', text: 'Two wrong answers vanish!', kind: 'kbc', ms: 3000 });
    } else if (name === 'poll') {
      hot.poll = { open: true, votes: {}, deadline: now() + 20000 };
      S.announce({ emoji: '📊', title: 'AUDIENCE POLL', text: `Everyone — vote on your phones to help ${p.name}!`, kind: 'kbc', ms: 4000 });
      kbc.resume(live, game, ctx);
    } else if (name === 'phone') {
      hot.phoneUntil = now() + 45000;
      S.announce({ emoji: '📞', title: 'PHONE A FRIEND', text: `${p.name} gets 45 seconds to ask any one guest!`, kind: 'kbc', ms: 4000 });
    }
  },

  player(live, game, p, a, ctx) {
    const hot = live.hot;
    if (a.type === 'ffAnswer') {
      if (live.phase !== 'ff') throw new Error('Too late!');
      const t = now();
      if (t < live.ff.opensAt || t > live.ff.deadline + 250 || live.ff.answers[p.id]) return;
      live.ff.answers[p.id] = { choice: Number(a.choice), at: t };
      if (onlineAnsweredAll(live.ff.answers, ctx.online)) kbc.ffClose(live, game);
    } else if (a.type === 'lock') {
      if (!hot || hot.pid !== p.id || hot.qPhase !== 'question') return;
      const c = Number(a.choice);
      if (hot.removed.includes(c)) return;
      hot.locked = c;
      S.pushFeed({ emoji: '🔒', text: `${p.name}: "Lock kiya jaaye!"` });
    } else if (a.type === 'lifeline') {
      if (!hot || hot.pid !== p.id) return;
      kbc.lifeline(live, game, a.name, ctx);
    } else if (a.type === 'walk') {
      if (!hot || hot.pid !== p.id) return;
      kbc.walk(live, game);
    } else if (a.type === 'predict') {
      if (!hot || hot.qPhase !== 'question' || hot.pid === p.id) return;
      hot.predictions = hot.predictions || {};
      hot.predictions[p.id] = a.pick === 'galat' ? 'galat' : 'sahi';
    } else if (a.type === 'pollVote') {
      if (!hot || !hot.poll || !hot.poll.open || hot.pid === p.id) return;
      hot.poll.votes[p.id] = Number(a.choice);
      const others = [...ctx.online].filter((x) => x !== hot.pid && S.state.players[x]);
      if (others.every((x) => hot.poll.votes[x] !== undefined)) hot.poll.open = false;
    }
  },

  view(live, game, viewer) {
    const ladder = game.content.ladder.map((l) => ({ points: l.points, safe: Boolean(l.safe) }));
    const v = { phase: live.phase, ladder, history: live.history };
    if (live.ff && (live.phase === 'ff' || live.phase === 'ff-result')) {
      const q = game.content.fastestFinger[live.ff.qi];
      v.ff = { question: publicQ(q), opensAt: live.ff.opensAt, deadline: live.ff.deadline, answered: Object.keys(live.ff.answers).length, answeredIds: Object.keys(live.ff.answers),
        result: live.phase === 'ff-result' ? { answer: q.answer, winner: live.ff.winner, ranking: live.ff.ranking, counts: live.ff.counts } : null };
      if (viewer.player) {
        const a = live.ff.answers[viewer.player.id];
        v.ff.mine = a ? a.choice : null;
      }
    }
    if (live.hot) {
      const hot = live.hot;
      const q = kbc.currentQ(game, hot);
      const showAnswer = hot.qPhase !== 'question';
      v.hot = {
        pid: hot.pid, level: hot.level, qPhase: hot.qPhase, locked: hot.locked, removed: hot.removed, lifelines: hot.lifelines,
        status: hot.status, winnings: hot.winnings, correct: hot.correct, answer: showAnswer ? hot.answer : null,
        phoneUntil: hot.phoneUntil, question: q ? publicQ(q) : null,
        questionLevel: hot.qLevel,
        poll: hot.poll ? { open: hot.poll.open, deadline: hot.poll.deadline, counts: countBy(Object.fromEntries(Object.entries(hot.poll.votes).map(([k, c]) => [k, { choice: c }])), 4), votes: Object.keys(hot.poll.votes).length } : null,
        safe: kbc.safeAmount(game, hot.level),
      };
      if (viewer.host && q) v.hot.answerKey = q.answer;
      if (viewer.player && hot.poll) v.hot.myVote = hot.poll.votes[viewer.player.id];
      const preds = Object.values(hot.predictions || {});
      v.hot.predCounts = { sahi: preds.filter((x) => x === 'sahi').length, galat: preds.filter((x) => x === 'galat').length };
      v.hot.predResult = hot.predResult || null;
      if (viewer.player) { v.hot.myPrediction = (hot.predictions || {})[viewer.player.id] || null; v.hot.iCalledIt = Boolean(hot.predResult && hot.predResult.right.includes(viewer.player.id)); }
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
      songs: songs.map((x) => x.title),
      perf: perf ? {
        team,
        members: perf.team ? S.teamMembers(S.parseEntity(perf.team).id).map((m) => pinfo(m.id)) : null,
        song: perf.songIndex != null && live.phase !== 'spin' ? songs[perf.songIndex] : null,
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
  if (game.type === 'kbc') {
    if (live.phase === 'ff' && live.ff && t > live.ff.deadline + 300) kbc.ffClose(live, game);
    if (live.hot && live.hot.poll && live.hot.poll.open && t > live.hot.poll.deadline) live.hot.poll.open = false;
  }
  if (game.type === 'hookstep') {
    if (live.phase === 'perform' && t > live.until + 1500) live.phase = 'judge';
    if (live.phase === 'spin' && t > live.spinUntil) live.phase = 'ready';
  }
}

// Earliest upcoming deadline, so clients know when to ask the server to tick.
function nextDeadline(state) {
  const c = [];
  if (state.tv.announce) c.push(state.tv.announce.until + 1100);
  const live = state.live;
  if (live) {
    if (live.phase === 'question' && live.deadline) c.push(live.deadline + 400);
    if (live.phase === 'ff' && live.ff) c.push(live.ff.deadline + 400);
    if (live.hot && live.hot.poll && live.hot.poll.open) c.push(live.hot.poll.deadline + 100);
    if (live.phase === 'perform') c.push(live.until + 1600);
    if (live.phase === 'spin') c.push(live.spinUntil + 100);
  }
  if (state.demo && state.demo.plan && state.demo.plan.acts.length) c.push(state.demo.plan.acts[0].at + 50);
  const future = c.filter((x) => x > now() - 5000);
  return future.length ? Math.min(...future) : null;
}

module.exports = { engines, tick, nextDeadline };
