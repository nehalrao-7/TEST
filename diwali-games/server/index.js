// HTTP + Socket.IO server: auth (phone OTP / host PIN), actions and broadcasts.

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const S = require('./state');
const { engines, clearAll, setTickHandler } = require('./games');
const { templates } = require('./content');
const { smsEnabled, sendSms } = require('./sms');

S.load();
const st = () => S.state;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 8000 });

const token = () => crypto.randomBytes(24).toString('base64url');
const findPlayerByToken = (t) => t && Object.values(st().players).find((p) => p.tokens.includes(t));
const isHostToken = (t) => t && st().hostTokens.includes(t);

// ---------------- REST: auth ----------------

function normalizePhone(cc, number) {
  const c = String(cc || '').replace(/\D/g, '');
  let n = String(number || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = n.replace(/^0+/, '');
  const full = c + n;
  if (!c || n.length < 6 || full.length > 15) return null;
  return '+' + full;
}

const lastRequest = new Map();

app.post('/api/otp/request', async (req, res) => {
  const phone = normalizePhone(req.body.cc, req.body.phone);
  const name = String(req.body.name || '').trim().slice(0, 20);
  if (!phone) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  const existing = Object.values(st().players).find((p) => p.phone === phone);
  if (!existing && !name) return res.status(400).json({ error: 'Please tell us your name.' });
  if (!existing && Object.values(st().players).some((p) => p.name.toLowerCase() === name.toLowerCase()))
    return res.status(400).json({ error: 'That name is taken — add an initial or a nickname!' });
  const last = lastRequest.get(phone) || 0;
  if (Date.now() - last < 20000) return res.status(429).json({ error: 'Code just sent — wait a few seconds before asking again.' });
  lastRequest.set(phone, Date.now());

  const code = String(crypto.randomInt(smsEnabled ? 100000 : 1000, smsEnabled ? 1000000 : 10000));
  st().pending[phone] = { code, name: existing ? existing.name : name, avatar: req.body.avatar, expires: Date.now() + 10 * 60000, attempts: 0, at: Date.now(), via: 'host' };
  let via = 'host';
  if (smsEnabled) {
    try {
      await sendSms(phone, `${code} is your ${st().settings.eventName} code 🪔`);
      via = 'sms';
    } catch (e) {
      console.error('[sms]', e.message);
    }
  }
  st().pending[phone].via = via;
  console.log(`[otp] ${phone} (${st().pending[phone].name}) → ${via === 'sms' ? 'sent by SMS' : 'code ' + code}`);
  S.save();
  broadcast();
  res.json({ ok: true, via, returning: Boolean(existing), name: existing ? existing.name : name });
});

app.post('/api/otp/verify', (req, res) => {
  const phone = normalizePhone(req.body.cc, req.body.phone);
  const pend = phone && st().pending[phone];
  if (!pend || pend.expires < Date.now()) return res.status(400).json({ error: 'Code expired — request a new one.' });
  if (pend.attempts >= 5) return res.status(429).json({ error: 'Too many tries — request a new code.' });
  if (String(req.body.code || '').trim() !== pend.code) {
    pend.attempts++;
    S.save();
    return res.status(400).json({ error: 'That code is not right. Try again!' });
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
  S.save();
  broadcast();
  res.json({ token: t, isNew });
});

app.post('/api/host/login', (req, res) => {
  if (String(req.body.pin || '').trim() !== st().hostPin) return res.status(401).json({ error: 'Wrong host PIN.' });
  const t = token();
  st().hostTokens = [...st().hostTokens.slice(-9), t];
  S.save();
  res.json({ token: t });
});

app.get('/api/qr.svg', async (req, res) => {
  const text = String(req.query.u || '').slice(0, 300);
  if (!/^https?:\/\//.test(text)) return res.status(400).end();
  const svg = await QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#2a0845', light: '#ffffff' } });
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600').send(svg);
});

app.get('/api/meta', (req, res) => res.json({ eventName: st().settings.eventName, avatars: S.AVATARS, smsEnabled }));
app.get('/healthz', (req, res) => res.send('ok'));

// ---------------- views ----------------

const online = () => {
  const set = new Set();
  for (const s of io.sockets.sockets.values()) if (s.data.role === 'player') set.add(s.data.pid);
  return set;
};

function liveView(viewer) {
  const live = st().live;
  if (!live) return null;
  const game = st().games.find((g) => g.id === live.gameId);
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
  };
}
const maskPhone = (ph) => (ph ? ph.slice(0, 3) + ' ••• ' + ph.slice(-4) : '');

let pendingBroadcast = null;
function broadcast() {
  if (pendingBroadcast) return;
  pendingBroadcast = setImmediate(() => {
    pendingBroadcast = null;
    const on = online();
    const base = S.basePublic(on);
    const tvView = { ...base, role: 'tv', live: liveView({ tv: true }) };
    let host = null;
    for (const sock of io.sockets.sockets.values()) {
      const role = sock.data.role;
      if (role === 'tv') sock.emit('state', tvView);
      else if (role === 'host') sock.emit('state', host || (host = hostView(base)));
      else if (role === 'player') {
        const p = st().players[sock.data.pid];
        if (p) sock.emit('state', playerView(p, base));
        else { sock.emit('kicked'); sock.disconnect(true); }
      }
    }
    S.save();
  });
}
setTickHandler(broadcast);

// Clear expired announcements so a reconnecting TV doesn't replay them.
setInterval(() => {
  const a = st().tv.announce;
  if (a && a.until < Date.now() - 1000) { st().tv.announce = null; broadcast(); }
}, 2000);

// ---------------- game lifecycle ----------------

const gameById = (gid) => {
  const g = st().games.find((x) => x.id === gid);
  if (!g) throw new Error('Game not found.');
  return g;
};

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
  s.live = { gameId: gid, ...engines[game.type].init(game) };
  s.tv.view = 'game';
  S.announce({ emoji: game.emoji, title: game.title, text: game.mode === 'team' ? 'Team game — huddle up!' : 'Every player for themselves!', kind: 'start', ms: 4500 });
}

function endGame() {
  const s = st();
  if (!s.live) return;
  const game = gameById(s.live.gameId);
  game.status = 'done';
  s.live = null;
  clearAll();
  s.tv.view = 'leaderboard';
  s.tv.compareGameId = game.id;
  const top = S.ranking()[0];
  S.announce({ emoji: '🏁', title: `${game.title} complete!`, text: top ? `${top.name} leads the party with ${top.score} points` : '', kind: 'end', ms: 4500 });
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
      const allowed = ['eventName', 'powerupsEnabled', 'stealAmount', 'swapCap', 'powerupsPerPlayer'];
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
      const game = gameById(s.live.gameId);
      engines[game.type].host(s.live, game, a.action, { online: online() });
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
    case 'tv': if (['lobby', 'game', 'leaderboard', 'podium', 'teams'].includes(a.view)) s.tv.view = a.view; break;
    case 'announce': S.announce({ emoji: a.emoji || '📣', title: String(a.title || 'Announcement').slice(0, 40), text: String(a.text || '').slice(0, 140), ms: 8000 }); break;
    case 'dismiss': s.tv.announce = null; break;
    case 'editGame': {
      const g = gameById(a.gameId);
      if (a.title) g.title = String(a.title).slice(0, 40);
      if (a.emoji) g.emoji = String(a.emoji).slice(0, 8);
      if (a.mode && g.status !== 'live') g.mode = a.mode === 'team' ? 'team' : 'individual';
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
    case 'resetScores': s.ledger = []; s.rankSnapshots = {}; s.live = null; clearAll(); s.games.forEach((g) => { g.status = 'pending'; });
      Object.values(s.players).forEach((p) => { p.doubleGameId = null; p.doublePending = false; p.powerups = S.dealPowerups(s.settings.powerupsPerPlayer); });
      s.tv = { view: 'lobby', announce: null, compareGameId: null }; s.feed = []; break;
    case 'resetAll': clearAll(); S.resetAll(); break;
    default: throw new Error('Unknown action.');
  }
}

function playerAction(p, a) {
  const s = st();
  if (a.type === 'powerup') {
    let liveCtx = null;
    if (s.live) {
      const game = gameById(s.live.gameId);
      const eng = engines[game.type];
      if (eng.hint) liveCtx = { canHint: (pl) => eng.hint.can(s.live, pl), applyHint: (pl) => eng.hint.apply(s.live, game, pl) };
    }
    S.usePowerup(p, a.powerupId, a.targetId, liveCtx);
  } else if (a.type === 'avatar') {
    if (S.AVATARS.includes(a.avatar)) p.avatar = a.avatar;
  } else if (a.type === 'game') {
    if (!s.live) throw new Error('No game is live right now.');
    const game = gameById(s.live.gameId);
    engines[game.type].player(s.live, game, p, a.action, { online: online() });
  }
}

// ---------------- sockets ----------------

io.on('connection', (sock) => {
  const auth = sock.handshake.auth || {};
  if (auth.role === 'host') {
    if (!isHostToken(auth.token)) { sock.emit('auth_error', 'Please log in again.'); return sock.disconnect(true); }
    sock.data.role = 'host';
  } else if (auth.role === 'player') {
    const p = findPlayerByToken(auth.token);
    if (!p) { sock.emit('auth_error', 'Please log in again.'); return sock.disconnect(true); }
    sock.data.role = 'player';
    sock.data.pid = p.id;
  } else {
    sock.data.role = 'tv';
  }

  const wrap = (fn) => (a, cb) => {
    try {
      fn(a || {});
      broadcast();
      if (typeof cb === 'function') cb({ ok: true });
    } catch (e) {
      if (typeof cb === 'function') cb({ error: e.message });
    }
  };

  if (sock.data.role === 'host') sock.on('host', wrap(hostAction));
  if (sock.data.role === 'player') sock.on('player', wrap((a) => playerAction(st().players[sock.data.pid], a)));
  sock.on('disconnect', broadcast);
  broadcast();
});

// Re-arm timers for a game that was live when the server restarted.
if (st().live) {
  const g = st().games.find((x) => x.id === st().live.gameId);
  if (g && engines[g.type].resume) engines[g.type].resume(st().live, g, { online: online() });
}

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  console.log(`\n🪔  Diwali Game Night running on http://localhost:${PORT}`);
  console.log(`   Players: /play   Host: /host   TV: /tv`);
  console.log(`   Host PIN: ${st().hostPin}${process.env.HOST_PIN ? ' (from HOST_PIN)' : '  (set HOST_PIN to choose your own)'}`);
  console.log(`   Phone codes: ${smsEnabled ? 'sent by SMS via Twilio' : 'shown on the host dashboard (no Twilio configured)'}\n`);
});
