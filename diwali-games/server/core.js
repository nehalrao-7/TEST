// Request handling shared by the Vercel function (api/main.js) and the local dev server.
// Each request: load state -> apply passed deadlines -> run the action -> save (with an
// optimistic version check, retried on conflict) -> return the caller's view.

const crypto = require('crypto');
const QRCode = require('qrcode');
const S = require('./state');
const { engines, tick, nextDeadline } = require('./games');
const { templates } = require('./content');
const { smsEnabled, sendSms } = require('./sms');
const { parseYouTube } = require('./youtube');
const P = require('./personalize');
const Bots = require('./bots');
const { applyDifficulty } = require('./practice');

const st = () => S.state;
let ONLINE = new Set();
const LOCAL_REACTS = [];
const token = () => crypto.randomBytes(24).toString('base64url');
// OPEN_ACCESS=true skips the host PIN and the phone code (for rehearsals). Turn it off for the party.
const OPEN = /^(1|true|yes|on)$/i.test(process.env.OPEN_ACCESS || '');
const findPlayerByToken = (t) => t && Object.values(st().players).find((p) => p.tokens.includes(t));
const isHostToken = (t) => t && st().hostTokens.includes(t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function normalizePhone(cc, number) {
  const c = String(cc || '').replace(/\D/g, '');
  let n = String(number || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = n.replace(/^0+/, '');
  const full = c + n;
  if (!c || n.length < 6 || full.length > 15) return null;
  return '+' + full;
}

function liveView(viewer) {
  const live = st().live;
  if (!live) return null;
  const found = st().games.find((g) => g.id === live.gameId);
  const game = found && playGame(found);
  if (!game) return null;
  return { gameId: game.id, type: game.type, title: game.title, emoji: game.emoji, mode: game.mode, practice: Boolean(live.practice), difficulty: live.difficulty || null, difficultyName: live.difficultyName || '', ...engines[game.type].view(live, game, viewer) };
}

function playerView(p, base) {
  const s = S.scores();
  const r = S.ranking();
  const me = r.find((x) => x.id === p.id);
  return {
    ...base,
    role: 'player',
    me: {
      id: p.id, name: p.name, avatar: p.avatar, color: p.color, teamId: p.teamId, score: s[p.id], rank: me ? me.rank : null,
      powerups: p.powerups.map((x) => ({ ...x, ...S.POWERUPS[x.type] })),
      doublePending: p.doublePending, doubleActive: Boolean(p.doubleArmed),
      history: st().ledger.filter((e) => e.playerId === p.id).slice(-15).reverse(),
      stats: S.stat(p.id),
      awards: computeAwards().filter((a) => a.winners.some((w) => w.id === p.id)).map(({ emoji, title, value }) => ({ emoji, title, value })),
    },
    questionnaire: { open: Boolean(st().settings.questionnaireOpen), prompts: st().questionnaire.map(({ id, text, ph, type, options, section }) => ({ id, text, ph, type: type || 'text', options, section: section || 'you' })), answers: p.answers || {} },
    live: liveView({ player: p }),
  };
}

function hostView(base) {
  const s = st();
  return {
    ...base,
    role: 'host',
    live: liveView({ host: true }),
    gamesFull: s.games,
    templates,
    settings: s.settings,
    smsEnabled,
    ledger: s.ledger.slice(-150).reverse(),
    pending: Object.entries(s.pending).filter(([, v]) => v.expires > Date.now()).map(([phone, v]) => ({ phone: maskPhone(phone), name: v.name, code: v.via === 'sms' ? null : v.code, via: v.via, at: v.at })),
    playersDetail: Object.values(s.players).map((p) => ({ id: p.id, bot: Boolean(p.bot), phone: p.bot ? '🤖 demo bot' : maskPhone(p.phone), powerups: p.powerups, doublePending: p.doublePending, doubleArmed: Boolean(p.doubleArmed) })),
    powerupDefs: S.POWERUPS,
    questionnaire: s.questionnaire,
    answers: Object.values(s.players).map((p) => ({ id: p.id, answers: p.answers || {} })),
    personalPreview: P.preview(s, 6),
    personalCount: s.live ? s.live.personalCount || 0 : 0,
    demo: s.demo && s.demo.on ? { bots: Object.values(s.players).filter((p) => p.bot).length } : null,
  };
}
const maskPhone = (ph) => (ph ? ph.slice(0, 3) + ' ••• ' + ph.slice(-4) : '');
// ---------------- game lifecycle ----------------

const gameById = (gid) => {
  const g = st().games.find((x) => x.id === gid);
  if (!g) throw new Error('Game not found.');
  return g;
};

// The game as it is being played: standard content with the personalised questions mixed in.
function playGame(g) {
  const live = st().live;
  return live && live.gameId === g.id && live.content ? { ...g, content: live.content } : g;
}

function startGame(gid) {
  const s = st();
  if (s.live) throw new Error('Another game is live — end it first.');
  const game = gameById(gid);
  if (game.mode === 'team' && !Object.keys(s.teams).length) throw new Error('This is a team game — create teams first (Players tab).');
  s.rankSnapshots[gid] = S.ranking().map((r) => ({ id: r.id, rank: r.rank, score: r.score }));
  for (const p of Object.values(s.players)) {
    if (p.doublePending) { p.doubleArmed = true; p.doublePending = false; }
  }
  game.status = 'live';
  // Difficulty is chosen on the host before Start and stays with the room.
  // Warm uses the easy set. Practice mode still keeps real guests' answers out of the questions.
  const level = Math.max(1, Math.min(5, Number(s.settings.difficulty) || (s.settings.practice ? 1 : 3)));
  const tuned = applyDifficulty(game, level);
  let content, count;
  if (level <= 1) {
    content = tuned.content;
    count = 0;
  } else if (s.settings.practice) {
    const bots = Object.fromEntries(Object.entries(s.players).filter(([, p]) => p.bot));
    ({ content, count } = P.personalize({ ...game, content: tuned.content }, { ...s, players: bots, personalUsed: [] }));
  } else ({ content, count } = P.personalize({ ...game, content: tuned.content }, s));
  s.live = { gameId: gid, ...engines[game.type].init(game), content, personalCount: count, practice: level <= 1 || Boolean(s.settings.practice), difficulty: tuned.level, difficultyName: tuned.name };
  s.tv.view = 'game';
  const base = game.mode === 'team' ? 'Team game — huddle up!' : 'Every player for themselves!';
  // The intro scene is the title card. This line sits under it, so the open stays readable.
  S.announce({ emoji: game.emoji, title: game.title, text: count ? `${base} ${count} ${count === 1 ? 'question is' : 'questions are'} about you.` : base, kind: 'start', style: 'lower', ms: 4200 });
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
}


// ---------------- Diwali Awards (end-of-night ceremony) ----------------
const AWARD_POINTS = 200;
// During the ceremony the award list is frozen, so the +200s it hands out can't reshuffle it.
function computeAwards() {
  const s = st();
  if (s.awardsFrozen) return s.awardsFrozen;
  return computeAwardsLive();
}
function computeAwardsLive() {
  const s = st();
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
  // Comeback: places climbed since the first snapshot taken after points were on the board.
  const ranking = S.ranking();
  const snaps = Object.values(s.rankSnapshots || {});
  const base = snaps.find((sn) => sn.some((x) => x.score > 0));
  const comeback = base ? top((p) => { const b = base.find((x) => x.id === p.id); const now = ranking.find((x) => x.id === p.id); return b && now ? b.rank - now.rank : null; }, 2) : null;
  const pct = (p) => (stat(p.id).answered >= 5 ? Math.round((100 * stat(p.id).correct) / stat(p.id).answered) : null);
  const list = [
    { id: 'bijli', emoji: '⚡', title: 'Bijli Fingers', desc: 'Fastest correct answer, again and again', r: top((p) => stat(p.id).fastest), fmt: (v) => `${v}× fastest on the buzzer` },
    { id: 'sharp', emoji: '🎯', title: 'Teer-Andaaz', desc: 'The sharpest accuracy of the night', r: top(pct, 50), fmt: (v) => `${v}% correct` },
    { id: 'fire', emoji: '🔥', title: 'Anaar on Fire', desc: 'Longest answer streak', r: top((p) => stat(p.id).bestStreak, 3), fmt: (v) => `${v} right in a row` },
    { id: 'chor', emoji: '🦹', title: 'Master Chor', desc: 'Pickpocketed the most points', r: top((p) => stat(p.id).steals), fmt: (v) => `${v} successful heist${v > 1 ? 's' : ''}` },
    { id: 'kavach', emoji: '🛡️', title: 'Raksha Kavach', desc: 'Survived an attack, untouched', r: top((p) => stat(p.id).blocks), fmt: (v) => `${v} attack${v > 1 ? 's' : ''} blocked` },
    { id: 'buzz', emoji: '🔔', title: 'Buzzer Baadshah', desc: 'Won the most Jeopardy clues', r: top((p) => stat(p.id).buzzWins, 2), fmt: (v) => `${v} clues won` },
    { id: 'dance', emoji: '💃', title: 'Hook Step Hero', desc: 'Highest-rated performance', r: top((p) => stat(p.id).hookBest), fmt: (v) => `${v} points on the dance floor` },
    { id: 'crore', emoji: '💰', title: 'Crorepati', desc: 'Biggest win in the hot seat', r: top((p) => stat(p.id).kbcBest), fmt: (v) => `${v.toLocaleString('en-IN')} points from the hot seat` },
    { id: 'comeback', emoji: '📈', title: 'Comeback Champ', desc: 'Climbed the most places', r: comeback, fmt: (v) => `up ${v} places` },
  ];
  return list.filter((a) => a.r).map((a) => ({
    id: a.id, emoji: a.emoji, title: a.title, desc: a.desc, value: a.fmt(a.r.value),
    winners: a.r.ids.map((id) => { const p = s.players[id]; return { id, name: p.name, avatar: p.avatar, color: p.color }; }),
  }));
}

// ---------------- music / video on the TV ----------------

// What the TV should be playing right now: the YouTube link on the current question, clue
// or song (derived from the live game), or a link the host pasted. Host overrides (replay,
// stop, show/hide video) apply while the same item is current.
function autoMedia() {
  const s = st();
  const live = s.live;
  if (!live) return null;
  const found = s.games.find((g) => g.id === live.gameId);
  if (!found) return null;
  const game = playGame(found);
  const c = game.content || {};
  const mk = (item, key, show, label) => {
    const yt = item && parseYouTube(item.youtube, item.clip);
    return yt ? { ...yt, key: `${game.id}:${key}`, show: Boolean(item.showVideo) || show, label } : null;
  };
  if (game.type === 'quiz' && ['question', 'reveal'].includes(live.phase)) {
    return mk((c.questions || [])[live.qIndex], `q${live.qIndex}`, live.phase === 'reveal', `${game.title} · Q${live.qIndex + 1}`);
  }
  if (game.type === 'jeopardy' && live.cur && ['clue', 'answer'].includes(live.phase)) {
    const cl = c.categories[live.cur.c].clues[live.cur.i];
    return mk(cl, `c${live.cur.c}-${live.cur.i}`, live.phase === 'answer', `${c.categories[live.cur.c].name} ${cl.value}`);
  }
  if (game.type === 'kbc') {
    if (['ff', 'ff-result'].includes(live.phase) && live.ff) return mk((c.fastestFinger || [])[live.ff.qi], `ff${live.ff.qi}`, live.phase === 'ff-result', 'Fastest Finger First');
    const h = live.hot;
    if (live.phase === 'hot' && h && h.qPhase !== 'over') {
      const q = engines.kbc.currentQ(game, h);
      return mk(q, `hot${h.seat}-${h.qLevel}`, h.qPhase === 'reveal', `KBC · Q${h.qLevel + 1}`);
    }
  }
  if (game.type === 'hookstep' && live.perf && live.perf.songIndex != null && (live.phase === 'perform' || live.phase === 'judge')) {
    const song = (c.songs || [])[live.perf.songIndex];
    // Visible the whole dance. The TV blurs it until the clock hits zero, then replays it sharp.
    return mk(song, `song${live.perf.songIndex}-${live.results.length}`, true, song ? song.title : '');
  }
  return null;
}

function currentMedia() {
  const s = st();
  const dj = s.dj && !s.dj.stopped ? { ...s.dj, key: `dj:${s.dj.id}` } : null;
  const m = dj || autoMedia();
  if (!m) return null;
  const ctl = s.mediaCtl && s.mediaCtl.key === m.key ? s.mediaCtl : {};
  if (ctl.stopped) return { key: m.key, stopped: true, label: m.label };
  return { ...m, show: ctl.show != null ? ctl.show : m.show, nonce: ctl.nonce || 0, stopped: false };
}

function mediaAction(a) {
  const s = st();
  if (a.op === 'dj') {
    const yt = parseYouTube(a.url, a.clip);
    if (!yt) throw new Error('That does not look like a YouTube link.');
    s.dj = { ...yt, id: S.id(5), show: a.show !== false, label: 'Host pick' };
    return;
  }
  const m = currentMedia() || (s.mediaCtl && s.mediaCtl.key ? { key: s.mediaCtl.key } : null);
  if (!m) throw new Error('Nothing to control — no clip on the current question.');
  if (a.op === 'stop' && s.dj && m.key === `dj:${s.dj.id}`) { s.dj = null; return; }
  const ctl = s.mediaCtl && s.mediaCtl.key === m.key ? s.mediaCtl : { key: m.key, nonce: 0 };
  if (a.op === 'replay') { ctl.nonce = (ctl.nonce || 0) + 1; ctl.stopped = false; }
  else if (a.op === 'stop') ctl.stopped = true;
  else if (a.op === 'show') ctl.show = true;
  else if (a.op === 'hide') ctl.show = false;
  s.mediaCtl = ctl;
}

function validateContent(type, c) {
  if (!c || typeof c !== 'object') throw new Error('Content must be a JSON object.');
  const checkQ = (q, where) => {
    if (!q || typeof q.q !== 'string' || !Array.isArray(q.options) || q.options.length < 2 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)
      throw new Error(`${where}: each question needs "q", "options" (2–4) and a valid "answer" index.`);
  };
  if (type === 'quiz') { if (!Array.isArray(c.questions) || !c.questions.length) throw new Error('Add at least one question.'); c.questions.forEach((q, i) => checkQ(q, `Question ${i + 1}`)); }
  if (type === 'jeopardy') { if (!Array.isArray(c.categories) || !c.categories.length) throw new Error('Add categories.'); c.categories.forEach((cat) => { if (!Array.isArray(cat.clues)) throw new Error(`Category ${cat.name}: clues missing.`); }); }
  if (type === 'kbc') {
    if (!Array.isArray(c.ladder) || !c.ladder.length) throw new Error('Add ladder levels.');
    c.ladder.forEach((l, i) => { if (!Array.isArray(l.questions) || !l.questions.length) throw new Error(`Level ${i + 1} needs questions.`); l.questions.forEach((q) => checkQ(q, `Level ${i + 1}`)); });
    (c.fastestFinger || []).forEach((q, i) => checkQ(q, `Fastest finger ${i + 1}`));
  }
  if (type === 'hookstep' && (!Array.isArray(c.songs) || !c.songs.length)) throw new Error('Add at least one song.');
}

function hostAction(a) {
  const s = st();
  switch (a.type) {
    case 'settings': {
      if (a.difficulty !== undefined) s.settings.difficulty = Math.max(1, Math.min(5, Math.round(Number(a.difficulty)) || 3));
      const allowed = ['eventName', 'powerupsEnabled', 'stealAmount', 'swapCap', 'powerupsPerPlayer', 'personalPct', 'questionnaireOpen', 'practice'];
      for (const k of allowed) if (a[k] !== undefined) s.settings[k] = typeof s.settings[k] === 'number' ? Number(a[k]) || 0 : a[k];
      break;
    }
    case 'makeTeams': S.makeTeams(a.count); S.announce({ emoji: '🎲', title: 'TEAMS ARE SET!', text: 'Check your phone to find your team.', ms: 4000 }); break;
    case 'clearTeams': s.teams = {}; Object.values(s.players).forEach((p) => { p.teamId = null; }); break;
    case 'setTeam': if (s.players[a.playerId]) s.players[a.playerId].teamId = s.teams[a.teamId] ? a.teamId : null; break;
    case 'renameTeam': if (s.teams[a.teamId]) s.teams[a.teamId].name = String(a.name).slice(0, 24); break;
    case 'startGame': startGame(a.gameId); break;
    case 'endGame': endGame(); break;
    case 'resetGame': { const g = gameById(a.gameId); if (g.status === 'live') endGame(); g.status = 'pending'; break; }
    case 'game': {
      if (!s.live) throw new Error('No game is live.');
      const game = playGame(gameById(s.live.gameId));
      engines[game.type].host(s.live, game, a.action, { online: ONLINE });
      break;
    }
    case 'award': {
      const amount = Math.round(Number(a.amount));
      if (!amount) throw new Error('Enter a number of points.');
      const reason = String(a.reason || (amount > 0 ? 'Host bonus' : 'Host penalty')).slice(0, 60);
      const gid = s.live ? s.live.gameId : null;
      S.awardEntity(a.target, amount, reason, gid);
      const info = S.entityInfo(a.target);
      if (info && a.announce !== false) S.pushFeed({ emoji: amount > 0 ? '🎁' : '⚠️', text: `${info.name} ${amount > 0 ? '+' : ''}${amount} — ${reason}` });
      break;
    }
    case 'undo': s.ledger = s.ledger.filter((e) => e.id !== a.entryId); break;
    case 'media': mediaAction(a); break;
    case 'demoStart': Bots.create(s, Math.max(2, Math.min(14, Number(a.count) || 8))); s.settings.practice = true; s.settings.difficulty = 1; break;
    case 'demoEnd': {
      Bots.remove(s);
      s.settings.practice = false;
      hostAction({ type: 'resetScores' });
      S.announce({ emoji: '🪔', title: 'Demo over!', text: 'Scores reset. The real party starts now ✨', ms: 5000 });
      break;
    }
    case 'questionnaire': {
      const types = ['text', 'pick', 'vote', 'choice'];
      const prompts = (a.prompts || []).map((q) => ({ ...q, id: String(q.id || S.id(6)).slice(0, 24), text: String(q.text || '').trim().slice(0, 100), ph: String(q.ph || '').slice(0, 60),
        type: types.includes(q.type) ? q.type : 'text', options: q.type === 'choice' ? (Array.isArray(q.options) ? q.options : String(q.options || '').split(',')).map((o) => String(o).trim()).filter(Boolean).slice(0, 4) : undefined }))
        .filter((q) => q.text && (q.type !== 'choice' || q.options.length >= 2));
      if (!prompts.length) throw new Error('Keep at least one question.');
      s.questionnaire = prompts;
      break;
    }
    case 'clearAnswer': { const p = s.players[a.playerId]; if (p && p.answers) delete p.answers[a.promptId]; break; }
    case 'tv': if (['lobby', 'game', 'leaderboard', 'podium', 'teams', 'awards'].includes(a.view)) {
      if (a.view === 'awards' && s.tv.view !== 'awards') { s.tv.awardIndex = 0; if (!s.awardsFrozen) s.awardsFrozen = computeAwardsLive(); }
      s.tv.view = a.view;
    } break;
    case 'award-step': {
      if (!s.awardsFrozen) s.awardsFrozen = computeAwardsLive();
      const list = s.awardsFrozen;
      s.tv.view = 'awards';
      s.tv.awardIndex = Math.max(0, Math.min(list.length + 1, (s.tv.awardIndex || 0) + (a.dir < 0 ? -1 : 1))); // 0 = intro, 1..n awards, n+1 champion
      // Awards are worth points (Mario Party bonus stars): the standings can flip during the ceremony.
      const aw = list[s.tv.awardIndex - 1];
      s.awardsGiven = s.awardsGiven || {};
      if (aw && !s.awardsGiven[aw.id]) {
        s.awardsGiven[aw.id] = true;
        aw.winners.forEach((w) => S.award(w.id, AWARD_POINTS, `🏆 ${aw.title}`, null, { kind: 'award', noDouble: true }));
      }
      break;
    }
    case 'announce': S.announce({ emoji: a.emoji || '📣', title: String(a.title || 'Announcement').slice(0, 40), text: String(a.text || '').slice(0, 140), ms: 8000 }); break;
    case 'dismiss': s.tv.announce = null; break;
    case 'editGame': {
      const g = gameById(a.gameId);
      if (a.title) g.title = String(a.title).slice(0, 40);
      if (a.emoji) g.emoji = String(a.emoji).slice(0, 8);
      if (a.mode && g.status !== 'live') g.mode = a.mode === 'team' ? 'team' : 'individual';
      if (a.personalize !== undefined) g.personalize = Boolean(a.personalize);
      if (a.content !== undefined) {
        if (g.status === 'live') throw new Error('End the game before editing its content.');
        const c = typeof a.content === 'string' ? JSON.parse(a.content) : a.content;
        validateContent(g.type, c);
        g.content = c;
      }
      break;
    }
    case 'addGame': {
      const type = engines[a.gameType] ? a.gameType : 'custom';
      const emojis = { quiz: '❓', jeopardy: '🧠', kbc: '💰', hookstep: '💃', custom: '🎯' };
      s.games.push({ id: 'g' + S.id(5), type, title: String(a.title || 'New Game').slice(0, 40), emoji: emojis[type], mode: a.mode === 'team' ? 'team' : 'individual', status: 'pending', content: JSON.parse(JSON.stringify(templates[type])) });
      break;
    }
    case 'deleteGame': { const g = gameById(a.gameId); if (g.status === 'live') throw new Error('End it first.'); s.games = s.games.filter((x) => x !== g); break; }
    case 'moveGame': {
      const i = s.games.findIndex((x) => x.id === a.gameId);
      const j = i + (a.dir < 0 ? -1 : 1);
      if (i >= 0 && j >= 0 && j < s.games.length) [s.games[i], s.games[j]] = [s.games[j], s.games[i]];
      break;
    }
    case 'renamePlayer': if (s.players[a.playerId]) s.players[a.playerId].name = String(a.name).trim().slice(0, 20) || s.players[a.playerId].name; break;
    case 'removePlayer': delete s.players[a.playerId]; s.ledger = s.ledger.filter((e) => e.playerId !== a.playerId); break;
    case 'redeal': {
      const targets = a.playerId ? [s.players[a.playerId]].filter(Boolean) : Object.values(s.players);
      targets.forEach((p) => { p.powerups = S.dealPowerups(s.settings.powerupsPerPlayer); });
      if (!a.playerId) S.announce({ emoji: '🎁', title: 'FRESH POWER-UPS!', text: 'Everyone got new secret power-ups — check your phone!', ms: 5000 });
      break;
    }
    case 'givePowerup': {
      const p = s.players[a.playerId];
      if (p && S.POWERUPS[a.powerup]) p.powerups.push({ id: S.id(), type: a.powerup, used: false });
      break;
    }
    case 'clearPending': s.pending = {}; break;
    case 'resetScores': s.ledger = []; s.rankSnapshots = {}; s.stats = {}; s.personalUsed = []; s.awardsFrozen = null; s.awardsGiven = {}; s.live = null; s.games.forEach((g) => { g.status = 'pending'; });
      Object.values(s.players).forEach((p) => { p.doubleGameId = null; p.doubleArmed = false; p.doublePending = false; p.powerups = S.dealPowerups(s.settings.powerupsPerPlayer); });
      s.tv = { view: 'lobby', announce: null, compareGameId: null }; s.feed = []; break;
    case 'resetAll': {
      const fresh = S.freshState();
      fresh.code = s.code;
      fresh.hostTokens = s.hostTokens;
      fresh.settings.eventName = s.settings.eventName;
      fresh.settings.difficulty = s.settings.difficulty || 3;
      S.setState(fresh);
      break;
    }
    default: throw new Error('Unknown action.');
  }
}

function playerAction(p, a) {
  const s = st();
  if (a.type === 'powerup') {
    let liveCtx = null;
    if (s.live) {
      const game = playGame(gameById(s.live.gameId));
      const eng = engines[game.type];
      if (eng.hint) liveCtx = { canHint: (pl) => eng.hint.can(s.live, pl), applyHint: (pl) => eng.hint.apply(s.live, game, pl) };
    }
    S.usePowerup(p, a.powerupId, a.targetId, liveCtx);
  } else if (a.type === 'answers') {
    if (!s.settings.questionnaireOpen) throw new Error('The questionnaire is closed.');
    const byId = Object.fromEntries(s.questionnaire.map((q) => [q.id, q]));
    p.answers = p.answers || {};
    for (const [k, v] of Object.entries(a.answers || {})) {
      const q = byId[k];
      if (!q) continue;
      if (q.type === 'pick' || q.type === 'vote') p.answers[k] = s.players[v] && v !== p.id ? v : '';
      else if (q.type === 'choice') p.answers[k] = (q.options || []).includes(v) ? v : '';
      else p.answers[k] = P.cleanAnswer(v);
    }
  } else if (a.type === 'avatar') {
    if (S.AVATARS.includes(a.avatar)) p.avatar = a.avatar;
  } else if (a.type === 'game') {
    if (!s.live) throw new Error('No game is live right now.');
    const game = playGame(gameById(s.live.gameId));
    engines[game.type].player(s.live, game, p, a.action, { online: ONLINE });
  }
}

// ---------------- request pipeline ----------------

// Requests in one server instance run one at a time, because the game engines work on
// the module-level state object.
let queue = Promise.resolve();
function serial(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let ROOM = '';

function canonRoom(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{4}$/.test(s) ? s : '';
}

function asEnvelope(data) {
  if (!data || typeof data !== 'object') return { rooms: {} };
  if (data.rooms && typeof data.rooms === 'object' && !Array.isArray(data.rooms) && !data.players) return data;
  if (!data.players && !data.games) return { rooms: {} };
  const code = canonRoom(data.code) || 'HOME';
  return { rooms: { [code]: { ...data, code } } };
}

function newRoomCode(rooms) {
  for (let n = 0; n < 40; n++) {
    let s = '';
    for (let i = 0; i < 4; i++) s += ROOM_ALPHABET[crypto.randomInt(ROOM_ALPHABET.length)];
    if (!rooms[s]) return s;
  }
  throw new HttpError(503, 'Could not make a room code. Try again.');
}

function needRoom(body) {
  const code = canonRoom(body && body.room);
  if (!code) throw new HttpError(400, 'Enter a 4-character room code.');
  return code;
}

// One saved document holds every room. Engines still see a single room as the game state.
function run(store, roomCode, mutate) {
  return serial(async () => {
    const code = canonRoom(roomCode);
    if (!code) throw new HttpError(400, 'Enter a 4-character room code.');
    for (let attempt = 0; attempt < 30; attempt++) {
      const loaded = await store.load();
      const env = asEnvelope(loaded.data);
      const room = env.rooms[code];
      if (!room) throw new HttpError(404, 'No room with that code. Check the letters and try again.');
      room.code = code;
      ROOM = code;
      S.setState(room);
      const prefix = code + ':';
      ONLINE = new Set([
        ...(loaded.online || []).filter((id) => String(id).startsWith(prefix)).map((id) => String(id).slice(prefix.length)),
        ...Object.values(st().players).filter((p) => p.bot).map((p) => p.id),
      ]);
      const before = JSON.stringify(env.rooms[code]);
      Bots.takeReacts();
      tick(st());
      Bots.tick(st(), { engines, playGame, online: ONLINE, usePowerup: S.usePowerup });
      const afterTick = JSON.stringify(st());
      let result;
      let error = null;
      try { result = await mutate(); } catch (e) { error = e; S.setState(JSON.parse(afterTick)); }
      st().code = code;
      const after = JSON.stringify(st());
      let version = loaded.version;
      if (after !== before) {
        env.rooms[code] = st();
        const v = await store.save(loaded.version, env);
        if (v == null) { await sleep(20 + Math.random() * 60 * (attempt + 1)); continue; }
        version = v;
      }
      const reacts = Bots.takeReacts();
      if (reacts.length) {
        if (store.broadcast) store.broadcast(reacts).catch(() => {});
        else { LOCAL_REACTS.push(...reacts); LOCAL_REACTS.splice(0, Math.max(0, LOCAL_REACTS.length - 30)); }
      }
      if (error) throw error;
      return { result, version };
    }
    throw new HttpError(503, 'The party is very busy — please tap again!');
  });
}

function createRoom(store, body) {
  return serial(async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const loaded = await store.load();
      const env = asEnvelope(loaded.data);
      const code = newRoomCode(env.rooms);
      const room = S.freshState();
      room.code = code;
      room.createdAt = Date.now();
      const name = String((body && body.eventName) || '').trim().slice(0, 40);
      if (name) room.settings.eventName = name;
      room.settings.difficulty = 3;
      const t = token();
      room.hostTokens = [t];
      env.rooms[code] = room;
      const v = await store.save(loaded.version, env);
      if (v == null) { await sleep(20 + Math.random() * 60 * (attempt + 1)); continue; }
      return { code, token: t };
    }
    throw new HttpError(503, 'The party is very busy — please tap again!');
  });
}

function joinPlayer(body) {
  const name = String(body.name || '').trim().slice(0, 20);
  const dev = String(body.deviceId || '').replace(/[^\w-]/g, '').slice(0, 40);
  const phone = normalizePhone(body.cc, body.phone);
  const ident = phone || (dev ? 'dev:' + dev : null);
  if (!ident) throw new HttpError(400, 'Please refresh and try again.');
  let p = Object.values(st().players).find((x) => x.phone === ident);
  const returning = Boolean(p);
  if (!p) {
    if (!name) throw new HttpError(400, 'Please tell us your name.');
    if (Object.values(st().players).some((x) => x.name.toLowerCase() === name.toLowerCase())) throw new HttpError(400, 'That name is taken — add an initial or a nickname!');
    p = S.createPlayer({ name, phone: ident, avatar: body.avatar });
    S.pushFeed({ emoji: p.avatar, text: `${p.name} joined the room!` });
  }
  const t = token();
  p.tokens = [...(p.tokens || []).slice(-4), t];
  return { token: t, returning, name: p.name, code: st().code };
}

function baseFor() {
  return { ...S.basePublic(ONLINE), nextDeadline: nextDeadline(st()) };
}
function viewFor(role, tok) {
  if (role === 'host') {
    if (!isHostToken(tok)) throw new HttpError(401, 'Please log in again.');
    return { ...hostView(baseFor()), media: currentMedia(), awardsCount: computeAwards().length };
  }
  if (role === 'player') {
    const p = findPlayerByToken(tok);
    if (!p) throw new HttpError(401, 'Please log in again.');
    return playerView(p, baseFor());
  }
  const tvExtra = st().tv.view === 'awards' ? { awards: computeAwards(), awardPoints: AWARD_POINTS } : {};
  const reactions = LOCAL_REACTS.filter((r) => !r.room || r.room === st().code);
  return { ...baseFor(), role: 'tv', live: liveView({ tv: true }), media: currentMedia(), ...tvExtra, reactions: reactions.length ? reactions : undefined };
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
      const code = canonRoom((query && query.room) || '');
      let roomExists = false;
      let eventName = 'Diwali Game Night';
      if (code) {
        const loaded = await store.load();
        const room = asEnvelope(loaded.data).rooms[code];
        roomExists = Boolean(room);
        if (room && room.settings && room.settings.eventName) eventName = room.settings.eventName;
      }
      return { json: { eventName, avatars: S.AVATARS, smsEnabled, realtime: store.realtime || null, openAccess: OPEN, room: code || null, roomExists } };
    }
    if (method !== 'POST') return { status: 405, json: { error: 'Method not allowed' } };

    if (path === 'room/create') {
      if (!OPEN && String(body.pin || '').trim() !== String(process.env.HOST_PIN || '')) throw new HttpError(401, 'Wrong host PIN.');
      return { json: await createRoom(store, body) };
    }

    if (path === 'join') {
      const { result } = await run(store, needRoom(body), () => joinPlayer(body));
      return { json: { ok: true, ...result } };
    }

    if (path === 'applause') {
      // The TV's microphone reports how loud the crowd cheered for a Hook Step dance.
      await run(store, needRoom(body), () => {
        const live = st().live;
        const game = live && st().games.find((g) => g.id === live.gameId);
        if (game && game.type === 'hookstep') engines.hookstep.applause(live, String(body.id || ''), body.level);
      });
      return { json: { ok: true } };
    }
    if (path === 'react') {
      // Local mode only — hosted mode sends reactions peer-to-peer over Supabase Realtime.
      const room = canonRoom(body.room);
      const r = { at: Date.now(), id: String(body.id || Math.random()).slice(0, 20), emoji: String(body.emoji || '').slice(0, 8), name: String(body.name || '').slice(0, 20), room };
      if (r.emoji) { LOCAL_REACTS.push(r); if (LOCAL_REACTS.length > 30) LOCAL_REACTS.shift(); }
      return { json: { ok: true } };
    }
    if (path === 'view' || path === 'tick') {
      const { result, version } = await run(store, needRoom(body), () => viewFor(body.role, body.token));
      if (result.role === 'player' && store.seen) await store.seen(ROOM + ':' + result.me.id).catch(() => {});
      return { json: { ...result, version } };
    }

    if (path === 'act') {
      const { result, version } = await run(store, needRoom(body), () => {
        if (body.role === 'host') {
          if (!isHostToken(body.token)) throw new HttpError(401, 'Please log in again.');
          hostAction(body.action || {});
        } else {
          const p = findPlayerByToken(body.token);
          if (!p) throw new HttpError(401, 'Please log in again.');
          playerAction(p, body.action || {});
        }
        return viewFor(body.role, body.token);
      });
      return { json: { ok: true, view: { ...result, version } } };
    }

    if (path === 'host/login') {
      const { result } = await run(store, needRoom(body), () => {
        if (!OPEN && String(body.pin || '').trim() !== String(st().hostPin)) throw new HttpError(401, 'Wrong host PIN.');
        const t = token();
        st().hostTokens = [...st().hostTokens.slice(-9), t];
        return { token: t, code: st().code };
      });
      return { json: result };
    }

    if (path === 'otp/request' && OPEN) {
      const { result } = await run(store, needRoom(body), () => joinPlayer(body));
      return { json: { ok: true, via: 'open', ...result } };
    }

    if (path === 'otp/request') {
      const phone = normalizePhone(body.cc, body.phone);
      const name = String(body.name || '').trim().slice(0, 20);
      const roomCode = needRoom(body);
      if (!phone) throw new HttpError(400, 'Please enter a valid phone number.');
      const { result } = await run(store, roomCode, () => {
        const existing = Object.values(st().players).find((p) => p.phone === phone);
        if (!existing && !name) throw new HttpError(400, 'Please tell us your name.');
        if (!existing && Object.values(st().players).some((p) => p.name.toLowerCase() === name.toLowerCase()))
          throw new HttpError(400, 'That name is taken — add an initial or a nickname!');
        const prev = st().pending[phone];
        if (prev && Date.now() - prev.at < 20000) throw new HttpError(429, 'Code just sent — wait a few seconds before asking again.');
        for (const [k, v] of Object.entries(st().pending)) if (v.expires < Date.now()) delete st().pending[k];
        const code = String(crypto.randomInt(smsEnabled ? 100000 : 1000, smsEnabled ? 1000000 : 10000));
        st().pending[phone] = { code, name: existing ? existing.name : name, avatar: body.avatar, expires: Date.now() + 10 * 60000, attempts: 0, at: Date.now(), via: smsEnabled ? 'sms' : 'host' };
        return { code, returning: Boolean(existing), name: existing ? existing.name : name };
      });
      let via = 'host';
      if (smsEnabled) {
        try { await sendSms(phone, `${result.code} is your Diwali Game Night code 🪔`); via = 'sms'; } catch (e) {
          console.error('[sms]', e.message);
          await run(store, roomCode, () => { if (st().pending[phone]) st().pending[phone].via = 'host'; });
        }
      }
      return { json: { ok: true, via, returning: result.returning, name: result.name } };
    }

    if (path === 'otp/verify') {
      const phone = normalizePhone(body.cc, body.phone);
      const { result } = await run(store, needRoom(body), () => {
        const pend = phone && st().pending[phone];
        if (!pend || pend.expires < Date.now()) throw new HttpError(400, 'Code expired — request a new one.');
        if (pend.attempts >= 5) throw new HttpError(429, 'Too many tries — request a new code.');
        if (String(body.code || '').trim() !== pend.code) {
          pend.attempts++;
          return { wrong: true };
        }
        delete st().pending[phone];
        let p = Object.values(st().players).find((x) => x.phone === phone);
        let isNew = false;
        if (!p) {
          p = S.createPlayer({ name: pend.name, phone, avatar: pend.avatar });
          isNew = true;
          S.pushFeed({ emoji: p.avatar, text: `${p.name} joined the room!` });
        }
        const t = token();
        p.tokens = [...p.tokens.slice(-4), t];
        return { token: t, isNew };
      });
      if (result.wrong) throw new HttpError(400, 'That code is not right. Try again!');
      return { json: result };
    }
    return { status: 404, json: { error: 'Not found' } };
  } catch (e) {
    const status = e.status || 400;
    if (!e.status && e.constructor !== Error) console.error(e);
    return { status, json: { error: e.message || 'Something went wrong.' } };
  }
}

module.exports = { handle };
