// Demo mode: bot guests that fill in the questionnaire and play along at human-ish speed.
// The app runs on serverless functions, so bots can't run on timers. Instead each phase gets
// a "plan" of timed actions; every request runs whatever is due, and nextDeadline() makes
// the TV/host ask the server to tick when the next bot action is due.

const crypto = require('crypto');
const S = require('./state');

const NAMES = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Anaya', 'Vihaan', 'Ishita', 'Arjun', 'Tara', 'Neel', 'Kiara', 'Dev', 'Zoya'];
const AVATARS = ['🐯', '🦚', '🌺', '🪷', '🍬', '🎇', '🥭', '🌶️', '🦁', '🐘', '👑', '🪁', '🌙', '⭐'];
const POOLS = {
  movie: ['Lagaan', '3 Idiots', 'Sholay', 'Queen', 'Dangal', 'Kahaani', 'Swades', 'Andhadhun', 'Barfi', 'Dil Chahta Hai', 'Jab We Met', 'Om Shanti Om'],
  star: ['Shah Rukh Khan', 'Deepika Padukone', 'Ranbir Kapoor', 'Alia Bhatt', 'Aamir Khan', 'Priyanka Chopra', 'Hrithik Roshan', 'Kajol', 'Ranveer Singh', 'Madhuri Dixit'],
  holiday: ['Bali', 'Santorini', 'Maldives', 'Japan', 'Iceland', 'Kerala', 'Ladakh', 'Peru', 'Switzerland', 'Goa', 'Banff', 'the Amalfi Coast'],
  sweet: ['Kaju katli', 'Gulab jamun', 'Jalebi', 'Rasmalai', 'Motichoor laddoo', 'Soan papdi', 'Rasgulla', 'Mysore pak', 'Shrikhand', 'Barfi'],
  dance: ['London Thumakda', 'Gallan Goodiyaan', 'Kala Chashma', 'Naatu Naatu', 'Tamma Tamma', 'Badtameez Dil', 'Desi Girl', 'Nagada Sang Dhol'],
  talent: ['I can juggle', 'A perfect Amitabh impression', 'I bake amazing cakes', 'I can solve a Rubik’s cube', 'I sing Hindustani classical', 'Origami', 'I can whistle any song', 'Speed typing'],
  fact: ['I once met Ranveer Singh', 'I have been to 20 countries', 'I was a child actor', 'I can’t swim', 'I don’t like chocolate', 'I won a dance competition', 'I have a twin', 'I ran a marathon'],
  garbaSong: ['Chogada', 'Dholida', 'Nagada Sang Dhol', 'Pankhida', 'Udi Udi Jaye', 'Shubhaarambh', 'Kamariya', 'Dholi Taro'],
  garbaEvent: ['Garba at the convention centre', 'Raas Garba in Mississauga', 'Navratri at the Hindu Sabha', 'The Brampton mega garba', 'Garba by the lake', 'Rang Navratri'],
  garbaMove: ['The double-spin three-taali', 'The dodhiyu', 'The two-step hinch', 'The sanedo jump', 'Six-step with a twirl', 'The backward dandiya flip'],
  generic: ['Definitely chai', 'Mumbai', 'Kishore Kumar', 'Pani puri', 'Cricket', 'Diwali, obviously', 'My grandmother', 'Dancing'],
};
const REACTS = ['🔥', '😂', '👏', '😱', '💃', '🪔'];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[crypto.randomInt(arr.length)];
const isBot = (p) => p && p.bot;
const botsOf = (state) => Object.values(state.players).filter(isBot);
const pendingReacts = [];

function create(state, count = 8) {
  const taken = new Set(Object.values(state.players).map((p) => p.name.toLowerCase()));
  const names = S.shuffle(NAMES).filter((n) => !taken.has(n.toLowerCase())).slice(0, count);
  const created = names.map((name, i) => {
    const p = S.createPlayer({ name, avatar: AVATARS[(i * 3) % AVATARS.length] });
    p.bot = true;
    p.skill = rnd(0.45, 0.85); // how often this bot knows the answer
    return p;
  });
  // Fill in the questionnaire for every bot.
  const everyone = Object.values(state.players);
  const bots = botsOf(state);
  const favourites = {};
  for (const q of state.questionnaire || []) if (q.type === 'vote') favourites[q.id] = pick(everyone).id;
  bots.forEach((b, i) => {
    b.answers = b.answers || {};
    for (const q of state.questionnaire || []) {
      if (b.answers[q.id]) continue;
      const others = everyone.filter((p) => p.id !== b.id);
      if (q.type === 'pick') {
        if (q.id === 'partner') { const mate = bots[i % 2 === 0 ? i + 1 : i - 1]; if (mate) b.answers[q.id] = mate.id; }
        else if (others.length) b.answers[q.id] = pick(others).id;
      } else if (q.type === 'vote') {
        const fav = favourites[q.id];
        b.answers[q.id] = fav && fav !== b.id && Math.random() < 0.6 ? fav : others.length ? pick(others).id : '';
      } else if (q.type === 'choice') {
        b.answers[q.id] = pick(q.options || ['Yes']);
      } else {
        const pool = POOLS[q.id] || POOLS.generic;
        b.answers[q.id] = pool[(i + crypto.randomInt(3)) % pool.length];
      }
    }
  });
  if (!Object.keys(state.teams).length) S.makeTeams(3);
  state.demo = { on: true, started: Date.now(), plan: null };
  S.pushFeed({ emoji: '🤖', text: `${created.length} demo bots joined the party` });
  return created.length;
}

function remove(state) {
  const ids = new Set(botsOf(state).map((b) => b.id));
  for (const id of ids) { delete state.players[id]; if (state.stats) delete state.stats[id]; }
  state.ledger = state.ledger.filter((e) => !ids.has(e.playerId));
  state.demo = null;
  return ids.size;
}

// ---------- planning: what each bot will do in the current phase ----------
function phaseKey(state, game) {
  const L = state.live;
  if (!L) return `break-${state.games.filter((g) => g.status === 'done').length}`;
  if (game.type === 'quiz') return L.phase === 'question' ? `q${L.qIndex}-${L.opensAt}` : L.phase === 'reveal' ? `r${L.qIndex}` : null;
  if (game.type === 'kbc') return L.phase === 'question' ? `k${L.qIndex}-${L.opensAt}` : L.phase === 'reveal' ? `kr${L.qIndex}` : null;
  if (game.type === 'jeopardy') return null;
  if (game.type === 'hookstep') return L.phase === 'perform' ? `p${L.results.length}-${L.startedAt}` : L.phase === 'scored' ? `s${L.results.length}` : null;
  return null;
}

function makePlan(state, game, key) {
  const L = state.live;
  const t = Date.now();
  const bots = botsOf(state);
  const acts = [];
  const react = (n, from, to) => S.shuffle(bots).slice(0, n).forEach((b) => acts.push({ pid: b.id, at: t + rnd(from, to), react: pick(REACTS) }));
  if (key.startsWith('break')) {
    bots.forEach((b) => {
      const pu = b.powerups.find((x) => !x.used && ['double', 'laddoo', 'steal', 'swap'].includes(x.type));
      if (pu && Math.random() < 0.4) acts.push({ pid: b.id, at: t + rnd(4000, 20000), powerup: pu.id });
    });
  } else if (game.type === 'quiz' && key.startsWith('q')) {
    const q = game.content.questions[L.qIndex];
    const window = Math.max(3000, L.deadline - L.opensAt - 1500);
    bots.forEach((b) => {
      const knows = Math.random() < b.skill;
      const wrong = q.options.map((_, i) => i).filter((i) => i !== q.answer);
      acts.push({ pid: b.id, at: L.opensAt + rnd(1200, Math.min(window, knows ? 9000 : 14000)), action: { type: 'answer', choice: knows ? q.answer : pick(wrong) } });
    });
  } else if (key.startsWith('r') || key.startsWith('s')) {
    react(crypto.randomInt(1, 4), 600, 3000);
  } else if (game.type === 'kbc' && key.startsWith('k') && !key.startsWith('kr')) {
    const q = require('./games').engines.kbc.list(game)[L.qIndex];
    const window = Math.max(2500, L.deadline - L.opensAt - 800);
    bots.forEach((b) => {
      const knows = Math.random() < b.skill;
      acts.push({ pid: b.id, at: L.opensAt + rnd(700, Math.min(window, knows ? 6000 : 12000)), action: { type: 'answer', choice: knows ? q.answer : (q.answer + 1 + crypto.randomInt(q.options.length - 1)) % q.options.length } });
    });
  } else if (key.startsWith('p')) {
    // The crowd cheers the dancers on.
    react(crypto.randomInt(3, 7), 2000, Math.max(4000, L.until - t - 2000));
  }
  return { key, acts: acts.sort((a, b) => a.at - b.at) };
}

// Run every due bot action. ctx: { engines, playGame, online, usePowerup }
function tick(state, ctx) {
  if (!state.demo || !state.demo.on || !botsOf(state).length) return;
  const game = state.live ? ctx.playGame(state.games.find((g) => g.id === state.live.gameId)) : null;
  const key = phaseKey(state, game);
  if (!key) { state.demo.plan = null; return; }
  if (!state.demo.plan || state.demo.plan.key !== key) state.demo.plan = makePlan(state, game, key);
  const now = Date.now();
  const plan = state.demo.plan;
  while (plan.acts.length && plan.acts[0].at <= now) {
    const a = plan.acts.shift();
    const p = state.players[a.pid];
    if (!p) continue;
    try {
      if (a.react) pendingReacts.push({ id: crypto.randomBytes(4).toString('hex'), at: now, emoji: a.react, name: p.name, avatar: p.avatar });
      else if (a.powerup) {
        const pu = p.powerups.find((x) => x.id === a.powerup);
        const leader = S.ranking().find((r) => r.id !== p.id);
        if (pu && !pu.used) ctx.usePowerup(p, pu.id, leader && leader.id, null);
      } else if (game && state.live) {
        ctx.engines[game.type].player(state.live, game, p, a.action, { online: ctx.online });
      }
    } catch { /* the phase may have moved on — ignore */ }
    // A bot action can end the phase (e.g. everyone answered); re-plan on the next tick.
    if (phaseKey(state, game) !== key) break;
  }
}

function takeReacts() { return pendingReacts.splice(0); }

module.exports = { create, remove, tick, takeReacts, isBot };
