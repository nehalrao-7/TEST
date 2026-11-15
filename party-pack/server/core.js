// Request handling for the self-running party app (Vercel function and local server).
// Each request: load the room -> check who is calling -> run the director (deadlines,
// bot moves) -> apply the action -> save with a version check (retried on conflict) -> view.
//
// Anyone can create a room and becomes its host. The host plays too; host-only actions are
// choosing games, starting, pausing and skipping. Nobody needs to press "next".

const crypto = require('crypto');
const QRCode = require('qrcode');
const S = require('./state');
const { engines, nextDeadline: engineDeadline } = require('./games');
const D = require('./director');
const B = require('./bank');
const P = require('./personalize');
const { templates } = require('./content');
const { parseYouTube } = require('./youtube');
const { phoneHash } = require('./privacy');
const { mailEnabled, sendRejoinCode } = require('./mail');

const st = () => S.state;
let ONLINE = new Set();
let ROOM = '';
const REACT_EMOJI = new Set(['🔥', '😂', '👏', '😱', '💃', '🎉']);
const token = () => crypto.randomBytes(24).toString('base64url');
const findPlayerByToken = (t) => t && Object.values(st().players).find((p) => p.tokens.includes(t));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

const MAX_ROOMS = 60;
const EMPTY_ROOM_MS = 3 * 60 * 60 * 1000;
const LIVE_ROOM_MS = 12 * 60 * 60 * 1000;
const CREATES_PER_10_MIN = 40;
const PIN_TRIES = 5;
const PIN_LOCK_MS = 10 * 60 * 1000;
const MAX_PLAYERS = 40;

// Fun "about me" prompts asked in the profile; their answers become a few personal questions.
const PROFILE_PROMPTS = ['karaoke', 'everyday', 'dreamJob', 'voteMic']; // on by default
const MAX_PROMPTS = 8;
const LEVELS = Object.keys(B.DIFFICULTIES);
const promptOn = (q) => (q.on == null ? PROFILE_PROMPTS.includes(q.id) : Boolean(q.on));
const enabledPacks = (s) => (Array.isArray(s.settings.packs) ? s.settings.packs.filter((id) => B.BY_ID[id]) : B.ALL_IDS);
const levelFor = (s, gid) => ((s.settings.levels || {})[gid] in B.DIFFICULTIES ? s.settings.levels[gid] : 'ramp');
const GENRES = ['Comedy', 'Romance', 'Action', 'Drama', 'Family', 'Thriller & horror', 'Animation', 'Music & dance'];

// ---------------- small helpers ----------------
const emailHash = (email) => phoneHash('email:' + String(email).trim().toLowerCase());
const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(String(e || '').trim());
const cleanName = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 20);
const newPin = () => String(crypto.randomInt(1000, 10000));
const isHost = (p) => p && st().hostId === p.id;

function roomShouldExpire(meta, now) {
  if (!meta || typeof meta !== 'object') return true;
  const stamp = Number(meta.activeAt || meta.createdAt) || 0;
  const humans = Number(meta.humans) || 0;
  if (!stamp) return humans === 0;
  return now - stamp > (humans > 0 ? LIVE_ROOM_MS : EMPTY_ROOM_MS);
}
async function reapExpired(store, now) {
  for (const row of await store.listRooms()) if (roomShouldExpire(row, now)) await store.deleteRoom(row.code);
}
async function freeSlot(store) {
  let rows = await store.listRooms();
  while (rows.length >= MAX_ROOMS) {
    const empty = rows.filter((r) => !r.humans).sort((a, b) => (a.activeAt || a.createdAt) - (b.activeAt || b.createdAt));
    if (!empty.length) return false;
    await store.deleteRoom(empty[0].code);
    rows = rows.filter((r) => r.code !== empty[0].code);
  }
  return true;
}
function guardSize(room) {
  if (JSON.stringify(room).length > 1500000) throw new HttpError(503, 'This room is full.');
}

let queue = Promise.resolve();
function serial(fn) {
  const r = queue.then(fn, fn);
  queue = r.catch(() => {});
  return r;
}
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function canonRoom(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{4}$/.test(s) ? s : '';
}
function newRoomCode(codes) {
  const taken = new Set(codes);
  for (let n = 0; n < 40; n++) {
    let s = '';
    for (let i = 0; i < 4; i++) s += ROOM_ALPHABET[crypto.randomInt(ROOM_ALPHABET.length)];
    if (!taken.has(s)) return s;
  }
  throw new HttpError(503, 'Could not make a room code. Try again.');
}
function needRoom(body) {
  const code = canonRoom(body && body.room);
  if (!code) throw new HttpError(400, 'Enter a 4-character room code.');
  return code;
}
function pinsEqual(given, expected) {
  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const a = crypto.createHash('sha256').update(norm(given)).digest();
  const b = crypto.createHash('sha256').update(norm(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---------------- room setup ----------------
function freshRoom(code) {
  const room = S.freshState();
  room.code = code;
  room.createdAt = room.activeAt = Date.now();
  room.settings.eventName = 'Party Pack';
  room.settings.difficulty = 3;
  room.settings.packs = [...B.ALL_IDS];
  room.settings.levels = {};
  room.qHist = {};
  room.qHistLoaded = {};
  room.settings.questionnaireOpen = true;
  room.questionnaireGate = 1;
  room.games = D.CATALOG.map((g) => ({ ...g, status: 'pending', content: null }));
  room.flow = { stage: 'lobby', order: D.CATALOG.map((g) => g.id), idx: -1, until: null, paused: null, ready: {} };
  room.hostTokens = [];
  return room;
}

function addPlayer({ name, avatar, email }) {
  const s = st();
  if (Object.keys(s.players).length >= MAX_PLAYERS) throw new HttpError(409, 'This room is full.');
  const nm = cleanName(name);
  if (!nm) throw new HttpError(400, 'Please tell us your name.');
  if (Object.values(s.players).some((p) => p.name.toLowerCase() === nm.toLowerCase())) throw new HttpError(409, 'That name is taken here — add an initial!');
  const p = S.createPlayer({ name: nm, avatar });
  p.emailHash = email ? emailHash(email) : '';
  p.pin = newPin();
  const t = token();
  p.tokens = [t];
  S.pushFeed({ emoji: p.avatar, text: `${p.name} joined the room!` });
  return { p, t };
}

// ---------------- game lifecycle ----------------
function playGame(g) {
  const live = st().live;
  return live && live.gameId === g.id && live.content ? { ...g, content: live.content } : g;
}
const gameById = (gid) => {
  const g = st().games.find((x) => x.id === gid);
  if (!g) throw new Error('Game not found.');
  return g;
};

// Teams for team games: 6+ humans split into teams of about four; smaller rooms play solo.
function ensureTeams() {
  const s = st();
  const n = Object.values(s.players).length;
  if (n >= 6 && !Object.keys(s.teams).length) S.makeTeams(Math.max(2, Math.min(4, Math.round(n / 4))));
  // Anyone who joined after teams were made goes to the smallest team.
  const teams = Object.values(s.teams);
  if (!teams.length) return;
  for (const p of Object.values(s.players)) {
    if (p.teamId && s.teams[p.teamId]) continue;
    const smallest = teams.map((t) => [t.id, S.teamMembers(t.id).length]).sort((a, b) => a[1] - b[1])[0][0];
    p.teamId = smallest;
  }
}

function startGame(gid) {
  const s = st();
  const game = gameById(gid);
  ensureTeams();
  const hasTeams = Object.keys(s.teams).length > 0;
  game.mode = hasTeams && D.CATALOG.find((c) => c.id === gid).mode === 'team' ? 'team' : 'individual';
  s.rankSnapshots[gid] = S.ranking().map((r) => ({ id: r.id, rank: r.rank, score: r.score }));
  for (const p of Object.values(s.players)) if (p.doublePending) { p.doubleArmed = true; p.doublePending = false; }
  game.status = 'live';
  const players = Object.values(s.players);
  let content;
  if (game.type === 'hookstep') content = { ...templates.hookstep, performSeconds: 25, rounds: hasTeams ? Object.keys(s.teams).length : Math.min(4, players.length) };
  else {
    content = B.buildContent(game.bank, players, { enabled: enabledPacks(s), difficulty: levelFor(s, gid), hist: s.qHist || {} });
    const ids = B.questionIds(content);
    const hashes = players.filter((p) => !p.bot && p.emailHash).map((p) => p.emailHash);
    s.qHist = s.qHist || {};
    for (const id of ids) s.qHist[id] = [((s.qHist[id] || [0])[0] || 0) + hashes.length, Date.now()];
    if (ids.length && hashes.length) (s.qHistPending = s.qHistPending || []).push({ hashes, ids });
  }
  let count = 0;
  if (game.type !== 'hookstep') {
    const humansWithAnswers = players.filter((p) => !p.bot && p.answers && Object.keys(p.answers).length);
    if (humansWithAnswers.length >= 2) ({ content, count } = P.personalize({ ...game, content }, s));
  }
  s.live = { gameId: gid, ...engines[game.type].init({ ...game, content }), content, personalCount: count };
  s.tv.view = 'game';
}

function endGame() {
  const s = st();
  if (!s.live) return;
  const game = gameById(s.live.gameId);
  game.status = 'done';
  s.live = null;
  s.tv.view = 'leaderboard';
  s.tv.compareGameId = game.id;
  const top = S.ranking()[0];
  S.announce({ emoji: '🏁', title: `${game.title} complete!`, text: top ? `${top.name} leads with ${top.score}` : '', kind: 'end', style: 'lower', ms: 3800 });
  D.afterGame(s);
}

// ---------------- awards ----------------
function computeAwards() {
  const s = st();
  if (s.awardsFrozen) return s.awardsFrozen;
  const players = Object.values(s.players);
  const stat = (id) => (s.stats || {})[id] || {};
  const top = (fn, min = 1) => {
    let best = null, ids = [];
    for (const p of players) {
      const v = fn(p);
      if (v == null || v < min) continue;
      if (best === null || v > best) { best = v; ids = [p.id]; } else if (v === best) ids.push(p.id);
    }
    return best === null || ids.length > 3 ? null : { ids, value: best };
  };
  const pct = (p) => (stat(p.id).answered >= 5 ? Math.round((100 * stat(p.id).correct) / stat(p.id).answered) : null);
  const list = [
    { id: 'bijli', emoji: '⚡', title: 'Lightning Fingers', desc: 'Fastest correct answer, again and again', r: top((p) => stat(p.id).fastest), fmt: (v) => `${v}× first to the answer` },
    { id: 'sharp', emoji: '🎯', title: 'Sharpshooter', desc: 'The sharpest accuracy', r: top(pct, 50), fmt: (v) => `${v}% correct` },
    { id: 'fire', emoji: '🔥', title: 'On Fire', desc: 'Longest answer streak', r: top((p) => stat(p.id).bestStreak, 3), fmt: (v) => `${v} right in a row` },
    { id: 'buzz', emoji: '🔔', title: 'Clue Champ', desc: 'First right answer on the most Category Clash clues', r: top((p) => stat(p.id).buzzWins, 2), fmt: (v) => `${v} clues won` },
    { id: 'dance', emoji: '💃', title: 'Dance-Off Hero', desc: 'Highest-rated performance', r: top((p) => stat(p.id).hookBest), fmt: (v) => `${v} points on the dance floor` },
    { id: 'crore', emoji: '💰', title: 'High Roller', desc: 'Biggest single Money Ladder score', r: top((p) => stat(p.id).kbcBest), fmt: (v) => `${v.toLocaleString('en-US')} points on one question` },
  ];
  return list.filter((a) => a.r).map((a) => ({
    id: a.id, emoji: a.emoji, title: a.title, desc: a.desc, value: a.fmt(a.r.value),
    winners: a.r.ids.map((id) => { const p = s.players[id]; return { id, name: p.name, avatar: p.avatar, color: p.color }; }),
  }));
}

// ---------------- media (YouTube on the TV and phones) ----------------
function currentMedia() {
  const s = st();
  const live = s.live;
  if (!live) return null;
  const game = playGame(gameById(live.gameId));
  if (game.type === 'hookstep' && live.perf && live.perf.songIndex != null && ['perform', 'judge'].includes(live.phase)) {
    const song = (game.content.songs || [])[live.perf.songIndex];
    const yt = song && parseYouTube(song.youtube, song.clip);
    if (!yt) return null;
    delete yt.end;
    return { ...yt, key: `${game.id}:song${live.perf.songIndex}-${live.results.length}`, show: true, label: '', nonce: 0, stopped: false };
  }
  return null;
}

// ---------------- demo bots ----------------
// Bots ready up, fill in a profile, answer about two-thirds right, pick clues and vote.
function botDrive(state) {
  const bots = Object.values(state.players).filter((p) => p.bot);
  if (!bots.length) return;
  const t = Date.now();
  const f = D.flow(state);
  const rnd = (a, b) => a + Math.random() * (b - a);
  bots.forEach((b) => { f.ready[b.id] = true; });
  if (f.stage === 'profile') {
    bots.forEach((b) => {
      if (b.profile) return;
      b.profile = { age: B.AGE_BANDS[Math.floor(rnd(1, 6))], interests: S.shuffle(enabledPacks(state)).slice(0, 4), genres: S.shuffle(GENRES).slice(0, 2) };
      b.answers = { karaoke: S.shuffle(['Mr. Brightside', 'Tum Hi Ho', 'Bohemian Rhapsody', 'Wannabe'])[0], everyday: S.shuffle(['Pizza', 'Pav bhaji', 'Poutine', 'Sushi'])[0] };
    });
  }
  const live = state.live;
  if (!live || f.stage !== 'game') return;
  const game = playGame(state.games.find((g) => g.id === live.gameId));
  const eng = engines[game.type];
  live.bot = live.bot || {};
  const speed = require('./games').SPEED;
  const plan = (key, from) => { if (!live.bot[key]) live.bot[key] = from + rnd(2000, 9000) / speed; return t >= live.bot[key]; };
  const answer = (q, key) => {
    bots.forEach((b) => {
      if (!q || (live.answers || {})[b.id] || !plan(key + b.id, live.opensAt)) return;
      const right = Math.random() < 0.65;
      const wrong = q.options.map((_, i) => i).filter((i) => i !== q.answer);
      try { eng.player(live, game, b, { type: 'answer', choice: right ? q.answer : wrong[Math.floor(rnd(0, wrong.length))] }, { online: ONLINE }); } catch { /* too late */ }
    });
  };
  if (game.type === 'quiz' && live.phase === 'question') answer(game.content.questions[live.qIndex], 'q' + live.qIndex);
  if (game.type === 'kbc' && live.phase === 'question') answer(eng.list(game)[live.qIndex], 'k' + live.qIndex);
  if (game.type === 'jeopardy') {
    if (live.phase === 'clue') answer(eng.clue(game, live.cur), `c${live.cur.c}-${live.cur.i}`);
    if (live.phase === 'board') {
      const up = eng.at(live, game);
      const picker = bots.find((b) => S.entityKeyFor(b, game) === up);
      if (picker && plan('pick' + Object.keys(live.used).length, t - 1000)) eng.autoPick(live, game);
    }
  }
  if (game.type === 'hookstep' && live.perf) {
    const onStage = (b) => eng.members(live.perf.team).some((m) => m.id === b.id);
    if (live.phase === 'perform') bots.filter(onStage).forEach((b) => { if (!live.perf.dancers.includes(b.id) && Math.random() < 0.6) live.perf.dancers.push(b.id); });
    if (live.phase === 'judge') bots.filter((b) => !onStage(b)).forEach((b) => { if (!live.perf.votes[b.id] && plan('v' + live.results.length + b.id, live.until - 15000 / speed)) live.perf.votes[b.id] = Math.floor(rnd(3, 6)); });
  }
}

function addBots(count) {
  const names = ['Alex', 'Sam', 'Maya', 'Leo', 'Priya', 'Noah', 'Zoe', 'Kai', 'Ava', 'Omar', 'Lucy', 'Max'];
  const s = st();
  const taken = new Set(Object.values(s.players).map((p) => p.name));
  let added = 0;
  for (const n of names) {
    if (added >= count) break;
    if (taken.has(n)) continue;
    const p = S.createPlayer({ name: n });
    p.bot = true;
    p.tokens = [];
    added++;
  }
}

// ---------------- actions ----------------
function playerAction(p, a) {
  const s = st();
  const f = D.flow(s);
  const hostOnly = () => { if (!isHost(p)) throw new HttpError(403, 'Only the host can do that.'); };
  switch (a.type) {
    case 'ready':
      if (f.stage !== 'lobby') return;
      f.ready[p.id] = a.on !== false;
      return;
    case 'profile': {
      const age = B.AGE_BANDS.includes(a.age) ? a.age : null;
      if (!age) throw new HttpError(400, 'Pick your age range.');
      const topicIds = enabledPacks(s);
      p.profile = {
        age,
        interests: [...new Set((Array.isArray(a.interests) ? a.interests : []).filter((x) => topicIds.includes(x)))].slice(0, 20),
        genres: (Array.isArray(a.genres) ? a.genres : []).filter((x) => GENRES.includes(x)).slice(0, 8),
      };
      const byId = Object.fromEntries(s.questionnaire.map((q) => [q.id, q]));
      p.answers = p.answers || {};
      for (const [k, v] of Object.entries(a.answers || {})) {
        const q = byId[k];
        if (!q || !promptOn(q)) continue;
        if (q.type === 'pick' || q.type === 'vote') p.answers[k] = s.players[v] && v !== p.id ? v : '';
        else p.answers[k] = P.cleanAnswer(v);
      }
      return;
    }
    case 'game': {
      if (!s.live || f.paused) throw new Error('Hang on — nothing to answer right now.');
      const game = playGame(gameById(s.live.gameId));
      engines[game.type].player(s.live, game, p, a.action || {}, { online: ONLINE });
      return;
    }
    case 'powerup': {
      let liveCtx = null;
      if (s.live) {
        const game = playGame(gameById(s.live.gameId));
        const eng = engines[game.type];
        if (eng.hint) liveCtx = { canHint: (pl) => eng.hint.can(s.live, pl), applyHint: (pl) => eng.hint.apply(s.live, game, pl) };
      }
      S.usePowerup(p, a.powerupId, a.targetId, liveCtx);
      return;
    }
    case 'avatar':
      if (S.AVATARS.includes(a.avatar)) p.avatar = a.avatar;
      return;
    // ----- host only -----
    case 'setGames': {
      hostOnly();
      if (f.stage !== 'lobby') throw new Error('Games are locked once you start.');
      const ids = (Array.isArray(a.order) ? a.order : []).filter((id) => D.CATALOG.some((g) => g.id === id));
      if (!ids.length) throw new Error('Pick at least one game.');
      f.order = [...new Set(ids)];
      return;
    }
    case 'setPacks': {
      hostOnly();
      if (f.stage !== 'lobby') throw new Error('Packs are locked once you start.');
      const ids = [...new Set((Array.isArray(a.ids) ? a.ids : []).filter((id) => B.BY_ID[id]))];
      if (!ids.length) throw new Error('Turn on at least one pack.');
      s.settings.packs = ids;
      for (const pl of Object.values(s.players)) if (pl.profile) pl.profile.interests = (pl.profile.interests || []).filter((id) => ids.includes(id));
      return;
    }
    case 'setLevel': {
      hostOnly();
      if (f.stage !== 'lobby') throw new Error('Difficulty is locked once you start.');
      if (!D.CATALOG.some((g) => g.id === a.gameId) || !LEVELS.includes(a.level)) throw new Error('Pick a difficulty.');
      s.settings.levels = { ...(s.settings.levels || {}), [a.gameId]: a.level };
      return;
    }
    case 'prompt': {
      hostOnly();
      if (!['lobby', 'profile'].includes(f.stage)) throw new Error('Questions are locked once the games begin.');
      const text = String(a.text || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      if (a.op === 'add') {
        if (!text) throw new Error('Type a question first.');
        if (s.questionnaire.filter(promptOn).length >= MAX_PROMPTS) throw new Error(`Up to ${MAX_PROMPTS} questions.`);
        const type = a.kind === 'vote' ? 'vote' : 'text';
        s.questionnaire.push({ id: 'c' + crypto.randomBytes(4).toString('hex'), section: type === 'vote' ? 'vote' : 'you', type, tag: 'group', text, on: true, custom: true });
        return;
      }
      const q = s.questionnaire.find((x) => x.id === a.id);
      if (!q) throw new Error('That question is gone.');
      if (a.op === 'remove') {
        if (q.custom) s.questionnaire = s.questionnaire.filter((x) => x !== q); else q.on = false;
        for (const pl of Object.values(s.players)) if (pl.answers) delete pl.answers[q.id];
        return;
      }
      if (a.op === 'toggle') {
        if (!promptOn(q) && s.questionnaire.filter(promptOn).length >= MAX_PROMPTS) throw new Error(`Up to ${MAX_PROMPTS} questions.`);
        q.on = !promptOn(q);
        if (!q.on) for (const pl of Object.values(s.players)) if (pl.answers) delete pl.answers[q.id];
        return;
      }
      if (a.op === 'edit') {
        if (!text) throw new Error('Type a question first.');
        if (text !== q.text) {
          q.text = text;
          // Custom wording: use the generic templates so every generated question matches what was asked.
          delete q.who; delete q.what; delete q.clue; delete q.ph;
          for (const pl of Object.values(s.players)) if (pl.answers) delete pl.answers[q.id];
        }
        return;
      }
      throw new Error('Unknown change.');
    }
    case 'start': {
      hostOnly();
      if (f.stage !== 'lobby') return;
      const people = Object.values(s.players);
      if (people.length < 2) throw new Error('You need at least 2 players.');
      const waiting = people.filter((x) => !x.bot && x.id !== p.id && !f.ready[x.id]);
      if (waiting.length) throw new Error(`Waiting on ${waiting.map((x) => x.name).join(', ')} to tap Ready.`);
      f.stage = 'profile';
      f.until = Date.now() + D.PROFILE_MS;
      s.tv.view = 'lobby';
      S.announce({ emoji: '📝', title: 'Quick profile!', text: 'A few taps so the game knows what you love.', kind: 'info', ms: 4500 });
      return;
    }
    case 'pause': hostOnly(); D.pause(s); return;
    case 'resume': hostOnly(); D.resume(s); return;
    case 'skip':
      hostOnly();
      if (f.stage === 'profile') { D.nextGame(s, ctx()); return; }
      if (f.stage === 'standings') { f.until = Date.now(); return; }
      if (s.live) { D.resume(s); endGame(); }
      return;
    case 'kick': {
      hostOnly();
      const victim = s.players[a.pid];
      if (!victim || victim.id === p.id) return;
      delete s.players[victim.id];
      delete f.ready[victim.id];
      return;
    }
    case 'addBots': hostOnly(); if (f.stage === 'lobby') addBots(Math.max(1, Math.min(10, Number(a.count) || 4))); return;
    case 'removeBots': hostOnly(); if (f.stage === 'lobby') for (const x of Object.values(s.players)) if (x.bot) delete s.players[x.id]; return;
    default:
      throw new Error('Unknown action.');
  }
}

const ctx = () => ({ startGame, endGame, computeAwards });

// ---------------- views ----------------
function liveView(viewer) {
  const live = st().live;
  if (!live) return null;
  const game = playGame(gameById(live.gameId));
  return { gameId: game.id, type: game.type, title: game.title, emoji: game.emoji, mode: game.mode, personalCount: live.personalCount || 0, ...engines[game.type].view(live, game, viewer) };
}

function flowView() {
  const s = st();
  const f = D.flow(s);
  return {
    stage: f.stage, order: f.order, idx: f.idx, until: f.until, paused: Boolean(f.paused),
    ready: Object.keys(f.ready).filter((id) => f.ready[id]),
    profiled: Object.values(s.players).filter((p) => p.profile).map((p) => p.id),
    hostId: s.hostId,
    catalog: D.CATALOG.map(({ id, title, emoji, type }) => ({ id, title, emoji, type })),
    packs: enabledPacks(s),
    levels: Object.fromEntries(D.CATALOG.map((g) => [g.id, levelFor(s, g.id)])),
  };
}

function baseFor() {
  const s = st();
  const deadlines = [engineDeadline(s), D.nextDeadline(s)].filter(Boolean);
  return { ...S.basePublic(ONLINE), eventName: s.settings.eventName, nextDeadline: deadlines.length ? Math.min(...deadlines) : null, flow: flowView(), media: currentMedia() };
}

function viewFor(role, tok, tvSecret) {
  const s = st();
  if (role === 'player') {
    const p = findPlayerByToken(tok);
    if (!p) throw new HttpError(401, 'Please rejoin the room.');
    const r = S.ranking();
    const me = r.find((x) => x.id === p.id);
    const sc = S.scores();
    const prompts = s.questionnaire.filter(promptOn).map(({ id, text, ph, type, options }) => ({ id, text, ph, type: type || 'text', options }));
    const hostSetup = isHost(p) ? {
      allPacks: B.PACK_LIST, groups: B.GROUPS, levels: Object.entries(B.DIFFICULTIES).map(([id, d]) => ({ id, label: d.label })),
      prompts: s.questionnaire.filter((q) => ['text', 'vote'].includes(q.type || 'text')).map((q) => ({ id: q.id, text: q.text, type: q.type || 'text', on: promptOn(q), custom: Boolean(q.custom) })),
      maxPrompts: MAX_PROMPTS,
    } : undefined;
    const on = new Set(enabledPacks(s));
    return {
      ...baseFor(), role: 'player',
      me: {
        id: p.id, name: p.name, avatar: p.avatar, color: p.color, teamId: p.teamId, score: sc[p.id], rank: me ? me.rank : null,
        host: isHost(p), pin: p.pin, profiled: Boolean(p.profile),
        powerups: p.powerups.map((x) => ({ ...x, ...S.POWERUPS[x.type] })),
        history: s.ledger.filter((e) => e.playerId === p.id).slice(-10).reverse(),
        stats: S.stat(p.id),
      },
      profile: { ageBands: B.AGE_BANDS, groups: B.GROUPS, topics: B.PACK_LIST.filter((x) => on.has(x.id)).map(({ id, name, emoji, group }) => ({ id, label: name, emoji, group })), genres: GENRES, prompts },
      hostSetup,
      tvSecret: s.tvSecret,
      awards: ['awards', 'podium'].includes(D.flow(s).stage) ? computeAwards() : undefined,
      live: liveView({ player: p }),
    };
  }
  if (!s.tvSecret || !pinsEqual(tvSecret, s.tvSecret)) throw new HttpError(401, 'Open the TV from a player’s phone.');
  const reactions = (Array.isArray(s.reacts) ? s.reacts : []).filter((r) => Date.now() - r.at < 8000).map(({ at, id, emoji, name }) => ({ at, id, emoji, name }));
  const tvExtra = ['awards', 'podium'].includes(s.tv.view) ? { awards: computeAwards(), awardPoints: 0 } : {};
  return { ...baseFor(), role: 'tv', live: liveView({ tv: true }), ...tvExtra, reactions: reactions.length ? reactions : undefined };
}

// ---------------- question history (no repeats across parties) ----------------
// Each human's seen questions are loaded once into the room as counts: qHist[qid] = [players who saw it, last seen].
async function syncHistory(store) {
  const s = st();
  if (!store.qHistory) return;
  s.qHist = s.qHist || {};
  s.qHistLoaded = s.qHistLoaded || {};
  const fresh = [...new Set(Object.values(s.players).filter((p) => !p.bot && p.emailHash && !s.qHistLoaded[p.emailHash]).map((p) => p.emailHash))];
  if (!fresh.length) return;
  const rows = await store.qHistory(fresh).catch(() => []);
  for (const r of rows) {
    const h = s.qHist[r.qid] || [0, 0];
    s.qHist[r.qid] = [h[0] + 1, Math.max(h[1], Number(r.seenAt) || 0)];
  }
  for (const h of fresh) s.qHistLoaded[h] = 1;
}
async function flushHistory(store) {
  const s = st();
  if (!s.qHistPending || !s.qHistPending.length) return;
  if (store.qMark) for (const batch of s.qHistPending) await store.qMark(batch.hashes, batch.ids).catch(() => {});
  delete s.qHistPending;
}

// ---------------- request pipeline ----------------
function callerGate(body) {
  if (body && body.role === 'player') { if (!findPlayerByToken(body.token)) throw new HttpError(401, 'Please rejoin the room.'); return; }
  if (!st().tvSecret || !pinsEqual(body && body.tvSecret, st().tvSecret)) throw new HttpError(401, 'Open the TV from a player’s phone.');
}

function run(store, roomCode, mutate, opts = {}) {
  return serial(async () => {
    const code = canonRoom(roomCode);
    if (!code) throw new HttpError(400, 'Enter a 4-character room code.');
    for (let attempt = 0; attempt < 30; attempt++) {
      await reapExpired(store, Date.now());
      const loaded = await store.loadRoom(code);
      if (!loaded.room) throw new HttpError(404, 'No room with that code. Check the letters and try again.');
      loaded.room.code = code;
      ROOM = code;
      S.setState(loaded.room);
      ONLINE = new Set([...(loaded.online || []), ...Object.values(st().players).filter((p) => p.bot).map((p) => p.id)]);
      if (opts.gate) opts.gate();
      await syncHistory(store);
      const before = JSON.stringify(st());
      if (!opts.skipTick) {
        if (st().tv.announce && st().tv.announce.until < Date.now() - 1000) st().tv.announce = null;
        if (!D.flow(st()).paused) botDrive(st());
        D.drive(st(), ctx());
      }
      const afterTick = JSON.stringify(st());
      let result, error = null;
      try { result = await mutate(); } catch (e) { error = e; S.setState(JSON.parse(afterTick)); }
      st().code = code;
      if (opts.touch) st().activeAt = Date.now();
      await flushHistory(store);
      const after = JSON.stringify(st());
      let version = loaded.version;
      if (after !== before) {
        guardSize(st());
        const v = await store.saveRoom(code, loaded.version, st());
        if (v == null) { await sleep(20 + Math.random() * 60 * (attempt + 1)); continue; }
        version = v;
        if (store.nudge) await store.nudge(code, v).catch(() => {});
      }
      if (error) throw error;
      return { result, version };
    }
    throw new HttpError(503, 'The room is very busy — please tap again!');
  });
}

async function createRoom(store, body) {
  const name = cleanName(body.name);
  const email = String(body.email || '').trim();
  if (!name) throw new HttpError(400, 'Please tell us your name.');
  if (email && !validEmail(email)) throw new HttpError(400, 'That email doesn’t look right.');
  return serial(async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const loaded = await store.loadBook();
      const book = loaded.book;
      const now = Date.now();
      await reapExpired(store, now);
      book.creates = (Array.isArray(book.creates) ? book.creates : []).filter((t) => now - t < 10 * 60 * 1000);
      if (book.creates.length >= CREATES_PER_10_MIN) throw new HttpError(429, 'Lots of rooms are being made right now. Try again in a few minutes.');
      if (!(await freeSlot(store))) throw new HttpError(429, 'All rooms are busy right now. Try again soon.');
      book.creates.push(now);
      if ((await store.saveBook(loaded.version, book)) == null) { await sleep(20 + Math.random() * 60); continue; }
      const code = newRoomCode((await store.listRooms()).map((r) => r.code));
      S.setState(freshRoom(code));
      const { p, t } = addPlayer({ name, avatar: body.avatar, email });
      st().hostId = p.id;
      D.flow(st()).ready[p.id] = true;
      const pin = p.pin;
      if ((await store.saveRoom(code, 0, st())) == null) continue;
      return { code, token: t, pin, name: p.name };
    }
    throw new HttpError(503, 'Please try again.');
  });
}

async function handle(store, method, path, body = {}, query = {}) {
  path = String(path || '').replace(/^\/+|\/+$/g, '');
  try {
    if (path === 'healthz') return { text: 'ok' };
    if (path === 'qr.svg') {
      const text = String(query.u || '').slice(0, 300);
      if (!/^https?:\/\//.test(text)) return { status: 400, text: 'bad url' };
      return { svg: await QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#2a0845', light: '#ffffff' } }) };
    }
    if (path === 'meta') {
      return { json: { eventName: 'Party Pack', avatars: S.AVATARS, mail: mailEnabled, realtime: store.realtime || null } };
    }
    if (method !== 'POST') return { status: 405, json: { error: 'Method not allowed' } };
    const origin = String(body.origin || '').replace(/[^a-zA-Z0-9:/._-]/g, '').slice(0, 100);

    if (path === 'room/create') {
      const out = await createRoom(store, body);
      if (body.email) sendRejoinCode(String(body.email).trim(), { name: out.name, room: out.code, pin: out.pin, link: `${origin}/?room=${out.code}` }).catch(() => {});
      return { json: { code: out.code, token: out.token, pin: out.pin, emailed: mailEnabled && Boolean(body.email) } };
    }

    if (path === 'join') {
      const email = String(body.email || '').trim();
      if (email && !validEmail(email)) throw new HttpError(400, 'That email doesn’t look right.');
      const { result } = await run(store, needRoom(body), () => {
        if (email) {
          const h = emailHash(email);
          if (Object.values(st().players).some((x) => x.emailHash === h)) throw new HttpError(409, 'You’re already in this room — use “Rejoin” with your code.');
        }
        const { p, t } = addPlayer({ name: body.name, avatar: body.avatar, email });
        return { token: t, pin: p.pin, name: p.name };
      }, { touch: true, skipTick: true });
      if (email) sendRejoinCode(email, { name: result.name, room: needRoom(body), pin: result.pin, link: `${origin}/?room=${needRoom(body)}` }).catch(() => {});
      return { json: { token: result.token, pin: result.pin, emailed: mailEnabled && Boolean(email) } };
    }

    if (path === 'rejoin') {
      const email = String(body.email || '').trim();
      if (!validEmail(email)) throw new HttpError(400, 'Enter the email you joined with.');
      const { result } = await run(store, needRoom(body), () => {
        const h = emailHash(email);
        const p = Object.values(st().players).find((x) => x.emailHash === h);
        if (!p) return { bad: true };
        if ((p.pinLockUntil || 0) > Date.now()) return { locked: true };
        if (!pinsEqual(body.pin, p.pin)) {
          p.pinFails = (p.pinFails || 0) + 1;
          if (p.pinFails >= PIN_TRIES) { p.pinFails = 0; p.pinLockUntil = Date.now() + PIN_LOCK_MS; }
          return { bad: true };
        }
        p.pinFails = 0;
        const t = token();
        p.tokens = [...p.tokens.slice(-4), t];
        return { token: t };
      }, { touch: true, skipTick: true });
      if (result.locked) throw new HttpError(429, 'Too many tries — wait 10 minutes.');
      if (result.bad) throw new HttpError(401, 'That email and code don’t match a player in this room.');
      return { json: result };
    }

    if (path === 'react') {
      const emoji = String(body.emoji || '');
      if (!REACT_EMOJI.has(emoji)) throw new HttpError(400, 'Unknown reaction.');
      await run(store, needRoom(body), () => {
        const p = findPlayerByToken(body.token);
        const now = Date.now();
        const list = (Array.isArray(st().reacts) ? st().reacts : []).filter((r) => now - r.at < 8000);
        const last = list.filter((r) => r.pid === p.id).pop();
        if (last && now - last.at < 700) { st().reacts = list; return; }
        list.push({ at: now, id: crypto.randomBytes(6).toString('hex'), emoji, name: p.name, pid: p.id });
        st().reacts = list.slice(-30);
      }, { gate: () => { if (!findPlayerByToken(body.token)) throw new HttpError(401, 'Please rejoin the room.'); }, skipTick: true });
      return { json: { ok: true } };
    }

    if (path === 'view' || path === 'tick') {
      const { result, version } = await run(store, needRoom(body), () => viewFor(body.role, body.token, body.tvSecret), { gate: () => callerGate(body) });
      if (result.role === 'player' && store.seen) await store.seen(ROOM + ':' + result.me.id).catch(() => {});
      return { json: { ...result, version } };
    }

    if (path === 'act') {
      const { result, version } = await run(store, needRoom(body), () => {
        playerAction(findPlayerByToken(body.token), body.action || {});
        return viewFor('player', body.token);
      }, { touch: true, gate: () => { if (!findPlayerByToken(body.token)) throw new HttpError(401, 'Please rejoin the room.'); } });
      return { json: { ok: true, view: { ...result, version } } };
    }

    return { status: 404, json: { error: 'Not found' } };
  } catch (e) {
    const status = e.status || 400;
    if (!e.status && e.constructor !== Error) console.error(e);
    return { status, json: { error: e.message || 'Something went wrong.' } };
  }
}

module.exports = { handle, _test: { playerAction, viewFor } };
