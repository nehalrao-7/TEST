// Central game state: players, teams, games, the points ledger, power-ups,
// persistence and the per-role views sent to clients.

const crypto = require('crypto');
const { defaultGames } = require('./content');


const AVATARS = ['🪔', '🎆', '🐘', '🦚', '🐯', '🌺', '🪷', '🍬', '🎇', '🥭', '🌶️', '🦁', '🐒', '👑', '🪁', '🍵', '🌙', '⭐'];
const COLORS = ['#FF6B1A', '#E6007E', '#FFC300', '#00B3A4', '#7C3AED', '#FF3D5A', '#2BB24C', '#1E88E5', '#F59E0B', '#C026D3', '#14B8A6', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16'];

const TEAM_PRESETS = [
  { name: 'Team Anaar', emoji: '🎇', color: '#FF6B1A' },
  { name: 'Team Chakri', emoji: '🌀', color: '#E6007E' },
  { name: 'Team Phuljhari', emoji: '✨', color: '#FFC300' },
  { name: 'Team Rocket', emoji: '🚀', color: '#00B3A4' },
  { name: 'Team Diya', emoji: '🪔', color: '#7C3AED' },
  { name: 'Team Laddoo', emoji: '🍬', color: '#2BB24C' },
];

const POWERUPS = {
  double: { name: 'Double Dhamaka', emoji: '💥', desc: 'Double your next score, once. The extra is capped at 400 points.' },
  steal: { name: 'Chor Bazaar', emoji: '🦹', desc: 'Steal points from any player of your choice.', target: true },
  shield: { name: 'Raksha Kavach', emoji: '🛡️', desc: 'Passive: automatically blocks the first steal or swap aimed at you.', passive: true },
  laddoo: { name: 'Lucky Laddoo', emoji: '🍬', desc: 'Open a mystery box worth 50 to 300 points!' },
  swap: { name: 'Ulta Pulta', emoji: '🔄', desc: 'Swap scores with the player ranked just above you (capped swing).' },
  hint: { name: 'Phuljhari Hint', emoji: '✨', desc: 'Use during a quiz question to knock out two wrong answers.' },
};
// Weighted pool used when dealing power-ups.
const POWERUP_POOL = ['double', 'double', 'steal', 'steal', 'shield', 'shield', 'laddoo', 'laddoo', 'swap', 'hint', 'hint'];

const id = (n = 8) => crypto.randomBytes(n).toString('base64url').slice(0, n);
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function freshState() {
  return {
    version: 1,
    settings: {
      eventName: 'Diwali Game Night',
      powerupsEnabled: true,
      powerupsPerPlayer: 2,
      personalPct: 20,
      questionnaireOpen: true,
      stealAmount: 150,
      swapCap: 300,
    },
    hostPin: process.env.HOST_PIN || String(crypto.randomInt(100000, 1000000)),
    hostTokens: [],
    players: {},
    teams: {},
    games: defaultGames(),
    live: null,
    ledger: [],
    rankSnapshots: {},
    stats: {},
    hookV2: true,
    tv: { view: 'lobby', announce: null, compareGameId: null },
    feed: [],
    pending: {},
    questionnaire: require('./personalize').DEFAULT_PROMPTS.map((x) => ({ ...x })),
    questionnaireVersion: 3,
    personalUsed: [],
  };
}

let state = null;
// The state object for the request being handled (requests are serialised by server/core.js).
function setState(s) {
  state = s;
  if (process.env.HOST_PIN) state.hostPin = process.env.HOST_PIN;
  // Fill in fields added after a saved game was created.
  const PZ = require('./personalize');
  if (!state.questionnaire) state.questionnaire = PZ.DEFAULT_PROMPTS.map((x) => ({ ...x }));
  const QV = 3;
  if ((state.questionnaireVersion || 1) < QV) {
    // v2 added garba + "about the group" questions, v3 more group votes. Replace an unedited v1
    // list; otherwise append only the questions that are new since the saved version.
    const ids = state.questionnaire.map((q) => q.id);
    const unedited = ids.length === PZ.V1_IDS.length && ids.every((id, i) => id === PZ.V1_IDS[i]);
    const from = state.questionnaireVersion || 1;
    if (unedited) state.questionnaire = PZ.DEFAULT_PROMPTS.map((x) => ({ ...x }));
    else PZ.DEFAULT_PROMPTS.filter((p) => (PZ.ADDED_IN[p.id] || 1) > from && !ids.includes(p.id)).forEach((p) => state.questionnaire.push({ ...p }));
    state.questionnaireVersion = QV;
  }
  if (state.settings.personalPct == null) state.settings.personalPct = 20;
  if (state.settings.questionnaireOpen == null) state.settings.questionnaireOpen = true;
  if (!state.personalUsed) state.personalUsed = [];
  if (!state.stats) state.stats = {};
  if (!state.hookV2) {
    // v2 Hook Step: phone-free team dance-off; dancers earn a personal Himmat bonus.
    state.games.forEach((g) => { if (g.type === 'hookstep' && g.status !== 'live') { g.mode = 'team'; g.content.himmatBonus = g.content.himmatBonus || 100; delete g.content.votingSeconds; } });
    state.hookV2 = true;
  }
  // Double Dhamaka used to double every award in a game. It is now one charge.
  Object.values(state.players || {}).forEach((p) => {
    if (p.doubleArmed == null) p.doubleArmed = Boolean(p.doubleGameId || p.doublePending);
    if (p.doubleGameId) p.doubleArmed = true;
    p.doubleGameId = null;
  });
  return state;
}

// ---------- players, teams and scores ----------

function dealPowerups(n) {
  const picked = [];
  for (const type of shuffle(POWERUP_POOL)) {
    if (picked.length >= n) break;
    if (!picked.includes(type)) picked.push(type);
  }
  return picked.map((type) => ({ id: id(), type, used: false }));
}

function createPlayer({ name, phone, avatar }) {
  const used = new Set(Object.values(state.players).map((p) => p.color));
  const color = COLORS.find((c) => !used.has(c)) || COLORS[crypto.randomInt(COLORS.length)];
  const p = {
    id: id(),
    name,
    phone,
    avatar: AVATARS.includes(avatar) ? avatar : AVATARS[crypto.randomInt(AVATARS.length)],
    color,
    joinedAt: Date.now(),
    tokens: [],
    powerups: dealPowerups(state.settings.powerupsPerPlayer),
    teamId: null,
    doublePending: false,
    doubleArmed: false,
    doubleGameId: null,
    answers: {},
  };
  state.players[p.id] = p;
  // Late joiners slot into the smallest team.
  const teams = Object.values(state.teams);
  if (teams.length) {
    teams.sort((a, b) => teamMembers(a.id).length - teamMembers(b.id).length);
    p.teamId = teams[0].id;
  }
  return p;
}

const teamMembers = (tid) => Object.values(state.players).filter((p) => p.teamId === tid);

function makeTeams(count) {
  count = Math.max(2, Math.min(TEAM_PRESETS.length, Number(count) || 2));
  state.teams = {};
  const ids = [];
  for (let i = 0; i < count; i++) {
    const t = { id: 't' + (i + 1), ...TEAM_PRESETS[i] };
    state.teams[t.id] = t;
    ids.push(t.id);
  }
  // Balanced shuffle: deal players in snake order by current score so teams are fair.
  const ranked = ranking().map((r) => r.id);
  const order = [];
  for (let i = 0; i < ranked.length; i += count) {
    const chunk = shuffle(ranked.slice(i, i + count));
    order.push(...chunk);
  }
  order.forEach((pid, i) => {
    const round = Math.floor(i / count);
    const idx = round % 2 === 0 ? i % count : count - 1 - (i % count);
    state.players[pid].teamId = ids[idx];
  });
}

function scores() {
  const s = {};
  for (const pid of Object.keys(state.players)) s[pid] = 0;
  for (const e of state.ledger) if (s[e.playerId] !== undefined) s[e.playerId] += e.amount;
  return s;
}

function ranking() {
  const s = scores();
  const list = Object.values(state.players)
    .map((p) => ({ id: p.id, name: p.name, score: s[p.id] }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  let rank = 0;
  let prev = null;
  list.forEach((r, i) => {
    if (r.score !== prev) rank = i + 1;
    prev = r.score;
    r.rank = rank;
  });
  return list;
}

function pushFeed(item) {
  state.feed.unshift({ id: id(), ts: Date.now(), ...item });
  state.feed = state.feed.slice(0, 40);
}

// Award points to one player. Double Dhamaka doubles the next positive award once.
const DOUBLE_EXTRA_CAP = 400;
function award(playerId, amount, reason, gameId = null, opts = {}) {
  const p = state.players[playerId];
  if (!p || !Number.isFinite(amount) || amount === 0) return 0;
  amount = Math.round(amount);
  let note = reason;
  if (amount > 0 && gameId && p.doubleArmed && !opts.noDouble) {
    amount += Math.min(amount, DOUBLE_EXTRA_CAP);
    note += ' ×2';
    p.doubleArmed = false;
  }
  const entry = { id: id(), ts: Date.now(), playerId, amount, reason: note, gameId, teamId: p.teamId, kind: opts.kind || 'game' };
  state.ledger.push(entry);
  return amount;
}

// Award to a player or a whole team ('p:<id>' / 't:<id>' keys or {kind,id}).
function awardEntity(entity, amount, reason, gameId) {
  const e = typeof entity === 'string' ? parseEntity(entity) : entity;
  if (!e) return;
  if (e.kind === 'team') teamMembers(e.id).forEach((p) => award(p.id, amount, reason, gameId));
  else award(e.id, amount, reason, gameId);
}

function parseEntity(key) {
  if (!key) return null;
  const [k, i] = key.split(':');
  return { kind: k === 't' ? 'team' : 'player', id: i };
}
function entityKeyFor(player, game) {
  if (game && game.mode === 'team') return player.teamId ? 't:' + player.teamId : null;
  return 'p:' + player.id;
}
function entityInfo(key) {
  const e = parseEntity(key);
  if (!e) return null;
  if (e.kind === 'team') {
    const t = state.teams[e.id];
    return t ? { key, kind: 'team', name: t.name, emoji: t.emoji, color: t.color } : null;
  }
  const p = state.players[e.id];
  return p ? { key, kind: 'player', name: p.name, emoji: p.avatar, color: p.color } : null;
}

// ---------- per-player stats (for streaks, awards and the "My Night" card) ----------
function stat(pid) {
  state.stats = state.stats || {};
  return (state.stats[pid] = state.stats[pid] || { answered: 0, correct: 0, fastest: 0, bestStreak: 0, steals: 0, blocks: 0, powerups: 0, buzzWins: 0, hookBest: 0, kbcBest: 0, ffWins: 0 });
}

// ---------- announcements ----------

function announce(a) {
  // Bumpers own the picture (a game starting). Everything else is a lower-third
  // so the leaderboard, clue, or podium stays readable.
  const lower = new Set(['powerup', 'end', 'dd', 'kbc', 'jump']);
  const style = a.style || (lower.has(a.kind) ? 'lower' : 'bumper');
  const ms = a.ms != null ? a.ms : (style === 'lower' ? 4200 : 3400);
  state.tv.announce = { id: id(), at: Date.now(), until: Date.now() + ms, ...a, style };
  pushFeed({ emoji: a.emoji, text: a.feed || `${a.title}${a.text ? ' — ' + a.text : ''}` });
}

// ---------- power-ups ----------

function usePowerup(player, puId, targetId, liveCtx) {
  if (!state.settings.powerupsEnabled) throw new Error('Power-ups are paused by the host right now.');
  if (state.tv && (state.tv.view === 'awards' || state.tv.view === 'podium')) throw new Error('The ceremony is on — power-ups open again after the crowns.');
  const pu = player.powerups.find((x) => x.id === puId);
  if (!pu || pu.used) throw new Error('That power-up is not available.');
  const def = POWERUPS[pu.type];
  if (def.passive) throw new Error('This one works automatically — just keep it!');
  const s = scores();

  const tryShield = (victim) => {
    const sh = victim.powerups.find((x) => x.type === 'shield' && !x.used);
    if (!sh) return false;
    stat(victim.id).blocks++;
    sh.used = true;
    sh.usedAt = Date.now();
    return true;
  };

  switch (pu.type) {
    case 'double': {
      if (player.doubleArmed || player.doublePending) throw new Error('Double Dhamaka is already lined up.');
      player.doubleArmed = true;
      player.doublePending = false;
      announce({ emoji: '💥', title: 'DOUBLE DHAMAKA!', text: `${player.name} doubles their next score.`, kind: 'powerup', ms: 3800 });
      break;
    }
    case 'steal': {
      const victim = state.players[targetId];
      if (!victim || victim.id === player.id) throw new Error('Pick another player to steal from.');
      if (tryShield(victim)) {
        announce({ emoji: '🛡️', title: 'BLOCKED!', text: `${player.name} tried to rob ${victim.name}, but Raksha Kavach saved them!`, kind: 'powerup' });
        break;
      }
      const amt = Math.max(0, Math.min(state.settings.stealAmount, s[victim.id]));
      if (amt > 0) {
        stat(player.id).steals++;
        award(victim.id, -amt, `Robbed by ${player.name} 🦹`, null, { kind: 'powerup' });
        award(player.id, amt, `Chor Bazaar on ${victim.name}`, null, { kind: 'powerup', noDouble: true });
      }
      announce({ emoji: '🦹', title: 'CHOR BAZAAR!', text: amt > 0 ? `${player.name} stole ${amt} points from ${victim.name}!` : `${player.name} tried to rob ${victim.name}… but their pockets were empty!`, kind: 'powerup' });
      break;
    }
    case 'laddoo': {
      const prizes = [50, 75, 100, 100, 150, 150, 200, 250, 300];
      const amt = prizes[crypto.randomInt(prizes.length)];
      award(player.id, amt, 'Lucky Laddoo 🍬', null, { kind: 'powerup', noDouble: true });
      announce({ emoji: '🍬', title: 'LUCKY LADDOO!', text: `${player.name} opened a mystery laddoo worth ${amt} points!`, kind: 'powerup' });
      pu.result = amt;
      break;
    }
    case 'swap': {
      const r = ranking();
      const me = r.findIndex((x) => x.id === player.id);
      const above = r.slice(0, me).reverse().find((x) => x.score > s[player.id]);
      if (!above) throw new Error('Nobody is above you — you are already on top! 👑');
      const victim = state.players[above.id];
      if (tryShield(victim)) {
        announce({ emoji: '🛡️', title: 'BLOCKED!', text: `${player.name} tried to swap with ${victim.name}, but Raksha Kavach held strong!`, kind: 'powerup' });
        break;
      }
      const diff = Math.min(state.settings.swapCap, above.score - s[player.id]);
      award(victim.id, -diff, `Ulta Pulta by ${player.name} 🔄`, null, { kind: 'powerup' });
      award(player.id, diff, `Ulta Pulta with ${victim.name}`, null, { kind: 'powerup', noDouble: true });
      announce({ emoji: '🔄', title: 'ULTA PULTA!', text: `${player.name} swapped fortunes with ${victim.name} (${diff} point swing)!`, kind: 'powerup' });
      break;
    }
    case 'hint': {
      if (!liveCtx || !liveCtx.canHint(player)) throw new Error('Save this for when a quiz question is on screen!');
      liveCtx.applyHint(player);
      pushFeed({ emoji: '✨', text: `${player.name} lit a Phuljhari Hint` });
      break;
    }
    default:
      throw new Error('Unknown power-up.');
  }
  pu.used = true;
  pu.usedAt = Date.now();
  stat(player.id).powerups++;
}

// ---------- views ----------

function publicPlayers(onlineSet) {
  const r = ranking();
  const byId = Object.fromEntries(r.map((x) => [x.id, x]));
  return r.map((x) => {
    const p = state.players[x.id];
    return {
      id: p.id, name: p.name, avatar: p.avatar, color: p.color, teamId: p.teamId,
      score: x.score, rank: byId[p.id].rank, online: onlineSet.has(p.id),
      double: Boolean(p.doubleArmed),
    };
  });
}

function teamsView() {
  const s = scores();
  const gameId = state.live ? state.live.gameId : null;
  return Object.values(state.teams).map((t) => {
    const members = teamMembers(t.id);
    const gamePoints = gameId
      ? state.ledger.filter((e) => e.gameId === gameId && e.teamId === t.id && e.kind === 'game').reduce((a, e) => a + e.amount, 0)
      : 0;
    return {
      ...t,
      members: members.map((m) => m.id),
      // Average per member so teams of different sizes compare fairly.
      total: members.length ? Math.round(members.reduce((a, m) => a + s[m.id], 0) / members.length) : 0,
      gamePoints: members.length ? Math.round(gamePoints / members.length) : 0,
    };
  });
}

function gamesList() {
  return state.games.map(({ id: gid, type, title, emoji, mode, status }) => ({ id: gid, type, title, emoji, mode, status }));
}

function basePublic(onlineSet) {
  return {
    serverNow: Date.now(),
    eventName: state.settings.eventName,
    powerupsEnabled: state.settings.powerupsEnabled,
    players: publicPlayers(onlineSet),
    teams: teamsView(),
    games: gamesList(),
    tv: state.tv,
    feed: state.feed.slice(0, 12),
    questionnaire: {
      open: Boolean(state.settings.questionnaireOpen),
      done: Object.values(state.players).filter((p) => Object.values(p.answers || {}).filter(Boolean).length >= Math.min(3, (state.questionnaire || []).length)).length,
    },
    snapshot: state.tv.compareGameId ? state.rankSnapshots[state.tv.compareGameId] || null : null,
  };
}

module.exports = {
  get state() { return state; },
  setState, freshState, id, shuffle,
  AVATARS, POWERUPS, TEAM_PRESETS,
  stat, createPlayer, dealPowerups, makeTeams, teamMembers, scores, ranking,
  award, awardEntity, parseEntity, entityKeyFor, entityInfo,
  announce, pushFeed, usePowerup, basePublic, teamsView,
};
