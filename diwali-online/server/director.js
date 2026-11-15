// The director runs the room so nobody has to press "next".
// Everything is a timestamp in state.flow / state.live; drive() runs on every request (and
// clients call /api/tick when the next deadline arrives), so it works on serverless.
//
// Stages: lobby → profile → game (one per chosen game) → standings → … → awards → podium.

const S = require('./state');
const { engines } = require('./games');

const now = () => Date.now();
const { SPEED } = require('./games');
const INTRO_MS = 6000 / SPEED;     // title card before the first question
const REVEAL_MS = 5500 / SPEED;    // how long the answer stays up
const FINAL_MS = 3500 / SPEED;     // "round complete" card
const STANDINGS_MS = 10000 / SPEED;
const PROFILE_MS = 120000;         // most people finish in under a minute
const AWARD_MS = 7000 / SPEED;

// Which bank each catalog game draws from.
const CATALOG = [
  { id: 'g1', type: 'quiz', bank: 'movie', title: 'Guess the Movie', emoji: '🎬', mode: 'team' },
  { id: 'g4', type: 'quiz', bank: 'quiz', title: 'Desi Kahoot', emoji: '⚡', mode: 'individual' },
  { id: 'g3', type: 'jeopardy', bank: 'jeopardy', title: 'Desi Jeopardy', emoji: '🧠', mode: 'team' },
  { id: 'g5', type: 'kbc', bank: 'kbc', title: 'Kaun Banega Crorepati', emoji: '💰', mode: 'individual' },
  { id: 'g2', type: 'hookstep', bank: null, title: 'Hook Step Challenge', emoji: '💃', mode: 'team' },
];

function flow(state) {
  if (!state.flow) state.flow = { stage: 'lobby', order: CATALOG.map((g) => g.id), idx: -1, until: null, paused: null, ready: {} };
  return state.flow;
}

const humans = (state) => Object.values(state.players).filter((p) => !p.bot);

// ---------- pause / resume ----------
// Pausing freezes every clock; resuming shifts them all forward by the paused time.
const CLOCKS = ['opensAt', 'deadline', 'until', 'pickUntil', 'spinUntil', 'autoAt', 'startedAt'];
function pause(state) {
  const f = flow(state);
  if (f.paused || f.stage === 'lobby') return;
  f.paused = now();
}
function resume(state) {
  const f = flow(state);
  if (!f.paused) return;
  const d = now() - f.paused;
  f.paused = null;
  if (f.until) f.until += d;
  const live = state.live;
  if (live) CLOCKS.forEach((k) => { if (typeof live[k] === 'number') live[k] += d; });
  if (state.tv.announce) state.tv.announce.until += d;
}

// ---------- driving ----------
function drive(state, ctx) {
  const f = flow(state);
  if (f.paused) return;
  const t = now();
  if (f.stage === 'profile') {
    const everyone = humans(state);
    const done = everyone.length && everyone.every((p) => p.profile);
    if (done || t >= f.until) nextGame(state, ctx);
    return;
  }
  if (f.stage === 'standings' && t >= f.until) { nextGame(state, ctx); return; }
  if (f.stage === 'awards') {
    if (t < f.until) return;
    const total = (state.awardsFrozen || []).length;
    if ((state.tv.awardStep || 0) < total) { state.tv.awardStep = (state.tv.awardStep || 0) + 1; f.until = t + AWARD_MS; return; }
    f.stage = 'podium';
    state.tv.view = 'podium';
    f.until = null;
    return;
  }
  if (f.stage === 'game' && state.live) driveGame(state, ctx);
}

function driveGame(state, ctx) {
  const live = state.live;
  const entry = state.games.find((g) => g.id === live.gameId);
  const game = { ...entry, content: live.content || entry.content };
  const eng = engines[game.type];
  const t = now();
  const later = (ms) => { if (!live.autoAt) live.autoAt = t + ms; return t >= live.autoAt; };
  const done = () => { live.autoAt = null; };

  if (game.type === 'quiz') {
    if (live.phase === 'intro' && later(INTRO_MS)) { done(); eng.host(live, game, { type: 'next' }, ctx); }
    else if (live.phase === 'question' && t > live.deadline + 300) eng.reveal(live, game);
    else if (live.phase === 'reveal' && later(REVEAL_MS)) { done(); eng.host(live, game, { type: 'next' }, ctx); }
    else if (live.phase === 'final' && later(FINAL_MS)) { done(); ctx.endGame(); }
  } else if (game.type === 'kbc') {
    if (live.phase === 'idle' && later(INTRO_MS)) { done(); eng.host(live, game, { type: 'next' }); }
    else if (live.phase === 'question' && t > live.deadline + 300) eng.close(live, game);
    else if (live.phase === 'reveal' && later(REVEAL_MS)) { done(); eng.host(live, game, { type: 'next' }); }
    else if (live.phase === 'done' && later(FINAL_MS)) { done(); ctx.endGame(); }
  } else if (game.type === 'jeopardy') {
    if (live.phase === 'board' && t >= live.pickUntil) eng.autoPick(live, game);
    else if (live.phase === 'clue' && t > live.deadline + 300) eng.close(live, game);
    else if (live.phase === 'answer' && t >= live.until) eng.next(live, game);
    else if (live.phase === 'done' && later(FINAL_MS)) { done(); ctx.endGame(); }
  } else if (game.type === 'hookstep') {
    if (live.phase === 'done') { if (later(FINAL_MS)) { done(); ctx.endGame(); } }
    else eng.step(live, game);
  }
}

// Starts the next chosen game, or the awards when the list is done.
function nextGame(state, ctx) {
  const f = flow(state);
  f.idx++;
  const gid = f.order[f.idx];
  if (!gid) {
    f.stage = 'awards';
    state.awardsFrozen = ctx.computeAwards();
    state.tv.view = 'awards';
    state.tv.awardStep = 0;
    f.until = now() + 1500;
    return;
  }
  f.stage = 'game';
  f.until = null;
  ctx.startGame(gid);
}

// Called by endGame: show the standings, then carry on.
function afterGame(state) {
  const f = flow(state);
  f.stage = 'standings';
  f.until = now() + STANDINGS_MS;
}

function nextDeadline(state) {
  const f = state.flow;
  if (!f || f.paused) return null;
  const c = [];
  if (f.until) c.push(f.until + 100);
  const live = state.live;
  if (live) {
    ['autoAt', 'pickUntil', 'until'].forEach((k) => { if (typeof live[k] === 'number') c.push(live[k] + 100); });
    if (typeof live.deadline === 'number' && ['question', 'clue'].includes(live.phase)) c.push(live.deadline + 400);
    // Phases that wait for a clock that has not been set yet: come back soon.
    if (['intro', 'reveal', 'final', 'idle', 'done'].includes(live.phase) && !live.autoAt) c.push(now() + 400);
  }
  const future = c.filter((x) => x > now() - 5000);
  return future.length ? Math.min(...future) : null;
}

module.exports = { CATALOG, flow, drive, nextGame, afterGame, pause, resume, nextDeadline, PROFILE_MS };
