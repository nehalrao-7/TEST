// Party history and the facts behind the admin dashboard.
// A finished (or abandoned) party is boiled down to counts: no names, emails or answers.

const D = require('./director');
const T = require('./themes');

const byId = Object.fromEntries(D.CATALOG.map((g) => [g.id, g]));
const info = (id) => ({ id, title: (byId[id] || {}).title || id, emoji: (byId[id] || {}).emoji || '🎲' });

// One record per party. Only parties that got as far as a game are worth keeping.
function summarize(room, finished, code) {
  const players = Object.values((room && room.players) || {}).filter(Boolean);
  const bots = players.filter((p) => p.bot).length;
  const settings = (room && room.settings) || {};
  const createdAt = Number(room.createdAt) || 0;
  const id = (room.code || code || '????') + ':' + createdAt;
  return {
    id,
    code: room.code || code || '',
    createdAt,
    endedAt: finished ? Date.now() : Number(room.activeAt || room.createdAt) || Date.now(),
    humans: players.length - bots,
    bots,
    finished: Boolean(finished),
    stage: (room.flow && room.flow.stage) || 'lobby',
    games: (room.games || []).filter((g) => g.status === 'done').map((g) => g.id),
    theme: T.resolve(settings, new Date(createdAt || Date.now())),
    themeMode: T.valid(settings.theme) ? 'picked' : 'auto',
  };
}
const worthKeeping = (rec) => rec.finished || rec.games.length > 0;

// Facts about one live room -> what the dashboard shows. `f` comes straight from the store.
function liveInfo(f, now) {
  const order = Array.isArray(f.order) ? f.order : [];
  const idx = Number.isInteger(Number(f.idx)) ? Number(f.idx) : -1;
  const players = Number(f.players) || 0;
  const bots = Number(f.bots) || 0;
  const online = Number(f.online) || 0;
  const activeAt = Number(f.activeAt) || Number(f.createdAt) || 0;
  const stage = f.stage || 'lobby';
  return {
    code: f.code,
    createdAt: Number(f.createdAt) || 0,
    activeAt,
    stage,
    game: stage === 'game' && f.gameId ? info(f.gameId) : null,
    gameNo: Math.min(order.length, Math.max(0, idx + 1)),
    gamesTotal: order.length,
    players: players - bots,
    bots,
    online,
    theme: T.resolve({ theme: f.theme, south: f.south === 'true' || f.south === true }, new Date(Number(f.createdAt) || now)),
    // live = someone's phone is connected right now; recent = something happened in the last 10 minutes
    state: online > 0 ? 'live' : now - activeAt < 10 * 60 * 1000 ? 'recent' : 'idle',
  };
}

const DAY = 24 * 3600e3;
function aggregate(rows, now) {
  const midnight = Math.floor(now / DAY) * DAY;
  const days = Array.from({ length: 14 }, (_, i) => ({ day: midnight - (13 - i) * DAY, parties: 0, players: 0 }));
  const games = {}, themes = {};
  let humans = 0, finished = 0, mins = 0, last24 = { parties: 0, players: 0 };
  for (const r of rows) {
    humans += r.humans;
    if (r.finished) { finished++; mins += Math.max(0, r.endedAt - r.createdAt) / 60000; }
    const d = days.find((x) => r.endedAt >= x.day && r.endedAt < x.day + DAY);
    if (d) { d.parties++; d.players += r.humans; }
    if (now - r.endedAt < DAY) { last24.parties++; last24.players += r.humans; }
    for (const g of r.games) games[g] = (games[g] || 0) + 1;
    themes[r.theme] = (themes[r.theme] || 0) + 1;
  }
  const rank = (o) => Object.entries(o).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
  return {
    parties: rows.length, finished, humans,
    avgPlayers: rows.length ? Math.round((10 * humans) / rows.length) / 10 : 0,
    avgMins: finished ? Math.round(mins / finished) : 0,
    last24, days,
    games: rank(games).map((g) => ({ ...info(g.id), plays: g.n })),
    themes: rank(themes).map((t) => ({ id: t.id, name: (T.PACKS.find((p) => p.id === t.id) || {}).name || t.id, emoji: (T.PACKS.find((p) => p.id === t.id) || {}).emoji || '', n: t.n })),
  };
}

module.exports = { summarize, worthKeeping, liveInfo, aggregate, info };
