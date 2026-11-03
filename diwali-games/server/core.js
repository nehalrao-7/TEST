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

const st = () => S.state;
let ONLINE = new Set();
const token = () => crypto.randomBytes(24).toString('base64url');
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
  return { gameId: game.id, type: game.type, title: game.title, emoji: game.emoji, mode: game.mode, ...engines[game.type].view(live, game, viewer) };
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
      doublePending: p.doublePending, doubleActive: Boolean(st().live && p.doubleGameId === st().live.gameId),
      history: st().ledger.filter((e) => e.playerId === p.id).slice(-15).reverse(),
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
    playersDetail: Object.values(s.players).map((p) => ({ id: p.id, phone: maskPhone(p.phone), powerups: p.powerups, doublePending: p.doublePending, doubleGameId: p.doubleGameId })),
    powerupDefs: S.POWERUPS,
    questionnaire: s.questionnaire,
    answers: Object.values(s.players).map((p) => ({ id: p.id, answers: p.answers || {} })),
    personalPreview: P.preview(s, 6),
    personalCount: s.live ? s.live.personalCount || 0 : 0,
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
    if (p.doublePending) { p.doubleGameId = gid; p.doublePending = false; }
  }
  game.status = 'live';
  const { content, count } = P.personalize(game, s);
  s.live = { gameId: gid, ...engines[game.type].init(game), content, personalCount: count };
  s.tv.view = 'game';
  const base = game.mode === 'team' ? 'Team game — huddle up!' : 'Every player for themselves!';
  S.announce({ emoji: game.emoji, title: game.title, text: count ? `${base} ✨ ${count} ${count === 1 ? 'question is' : 'questions are'} about YOU!` : base, kind: 'start', ms: 5000 });
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
  S.announce({ emoji: '🏁', title: `${game.title} complete!`, text: top ? `${top.name} leads the party with ${top.score} points` : '', kind: 'end', ms: 4500 });
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
  if (game.type === 'hookstep' && live.perf && live.perf.songIndex != null && live.phase === 'perform') {
    const song = (c.songs || [])[live.perf.songIndex];
    return mk(song, `song${live.perf.songIndex}-${live.results.length}`, false, song ? song.title : '');
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
      const allowed = ['eventName', 'powerupsEnabled', 'stealAmount', 'swapCap', 'powerupsPerPlayer', 'personalPct', 'questionnaireOpen'];
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
    case 'tv': if (['lobby', 'game', 'leaderboard', 'podium', 'teams'].includes(a.view)) s.tv.view = a.view; break;
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
    case 'resetScores': s.ledger = []; s.rankSnapshots = {}; s.live = null; s.games.forEach((g) => { g.status = 'pending'; });
      Object.values(s.players).forEach((p) => { p.doubleGameId = null; p.doublePending = false; p.powerups = S.dealPowerups(s.settings.powerupsPerPlayer); });
      s.tv = { view: 'lobby', announce: null, compareGameId: null }; s.feed = []; break;
    case 'resetAll': { const fresh = S.freshState(); fresh.hostTokens = s.hostTokens; S.setState(fresh); break; }
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

function run(store, mutate) {
  return serial(async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const loaded = await store.load();
      const fresh = !loaded.data;
      S.setState(fresh ? S.freshState() : loaded.data);
      ONLINE = new Set(loaded.online || []);
      const before = fresh ? null : JSON.stringify(st());
      tick(st());
      const afterTick = JSON.stringify(st());
      let result;
      let error = null;
      try { result = await mutate(); } catch (e) { error = e; S.setState(JSON.parse(afterTick)); }
      const after = JSON.stringify(st());
      let version = loaded.version;
      if (after !== before) {
        const v = await store.save(loaded.version, st());
        if (v == null) { await sleep(20 + Math.random() * 60 * (attempt + 1)); continue; }
        version = v;
      }
      if (error) throw error;
      return { result, version };
    }
    throw new HttpError(503, 'The party is very busy — please tap again!');
  });
}

function baseFor() {
  return { ...S.basePublic(ONLINE), nextDeadline: nextDeadline(st()) };
}
function viewFor(role, tok) {
  if (role === 'host') {
    if (!isHostToken(tok)) throw new HttpError(401, 'Please log in again.');
    return { ...hostView(baseFor()), media: currentMedia() };
  }
  if (role === 'player') {
    const p = findPlayerByToken(tok);
    if (!p) throw new HttpError(401, 'Please log in again.');
    return playerView(p, baseFor());
  }
  return { ...baseFor(), role: 'tv', live: liveView({ tv: true }), media: currentMedia() };
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
      const { result } = await run(store, () => st().settings.eventName);
      return { json: { eventName: result, avatars: S.AVATARS, smsEnabled, realtime: store.realtime || null } };
    }
    if (method !== 'POST') return { status: 405, json: { error: 'Method not allowed' } };

    if (path === 'view' || path === 'tick') {
      const { result, version } = await run(store, () => viewFor(body.role, body.token));
      if (result.role === 'player' && store.seen) await store.seen(result.me.id).catch(() => {});
      return { json: { ...result, version } };
    }

    if (path === 'act') {
      const { result, version } = await run(store, () => {
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
      const { result } = await run(store, () => {
        if (String(body.pin || '').trim() !== st().hostPin) throw new HttpError(401, 'Wrong host PIN.');
        const t = token();
        st().hostTokens = [...st().hostTokens.slice(-9), t];
        return t;
      });
      return { json: { token: result } };
    }

    if (path === 'otp/request') {
      const phone = normalizePhone(body.cc, body.phone);
      const name = String(body.name || '').trim().slice(0, 20);
      if (!phone) throw new HttpError(400, 'Please enter a valid phone number.');
      const { result } = await run(store, () => {
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
          await run(store, () => { if (st().pending[phone]) st().pending[phone].via = 'host'; });
        }
      }
      return { json: { ok: true, via, returning: result.returning, name: result.name } };
    }

    if (path === 'otp/verify') {
      const phone = normalizePhone(body.cc, body.phone);
      const { result } = await run(store, () => {
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
          S.pushFeed({ emoji: p.avatar, text: `${p.name} joined the party!` });
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
