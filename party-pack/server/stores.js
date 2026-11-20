// Each party is stored on its own. The game record has no phone numbers and no
// questionnaire answers; those sit in a private record for that party only.
// A rate-limit book is separate and contains no phone numbers.
// File storage is for local development. Postgres is used when DATABASE_URL is set.

const fs = require('fs');
const path = require('path');
const { emptyBook, roomMeta, splitRoom, mergeRoom } = require('./privacy');

function canon(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{4}$/.test(s) ? s : '';
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function legacyRooms(data) {
  if (!data || typeof data !== 'object') return { rooms: {}, book: emptyBook() };
  if (data.rooms && typeof data.rooms === 'object' && !Array.isArray(data.rooms) && !data.players) {
    return {
      rooms: data.rooms,
      book: {
        otpAt: data.otpAt && typeof data.otpAt === 'object' ? data.otpAt : {},
        createFails: Array.isArray(data.createFails) ? data.createFails : [],
        creates: Array.isArray(data.creates) ? data.creates : [],
      },
    };
  }
  if (data.players || data.games) {
    const code = canon(data.code) || 'HOME';
    return { rooms: { [code]: { ...data, code } }, book: emptyBook() };
  }
  return { rooms: {}, book: emptyBook() };
}

function fileStore() {
  const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const roomsDir = path.join(dir, 'rooms');
  const indexFile = path.join(roomsDir, 'index.json');
  const bookFile = path.join(dir, 'book.json');
  const histFile = path.join(dir, 'qseen.json');
  const partyFile = path.join(dir, 'history.json');
  const seenAt = new Map();
  fs.mkdirSync(roomsDir, { recursive: true });

  const legacy = path.join(dir, 'state.json');
  const old = readJson(legacy);
  if (old) {
    const packed = legacyRooms(old.data || old);
    const index = readJson(indexFile) || {};
    for (const [code, room] of Object.entries(packed.rooms)) {
      const id = canon(code);
      if (!id || index[id]) continue;
      const parts = splitRoom(room);
      const meta = roomMeta(room);
      writeJson(path.join(roomsDir, id + '.json'), { version: 1, meta, room: parts.room });
      writeJson(path.join(roomsDir, id + '.private.json'), parts.private);
      index[id] = meta;
    }
    if (!readJson(bookFile)) writeJson(bookFile, { version: 1, book: packed.book });
    writeJson(indexFile, index);
    fs.rmSync(legacy, { force: true });
  }

  function onlineFor(code) {
    const prefix = code + ':';
    return [...seenAt].filter(([, t]) => t > Date.now() - 25000).map(([id]) => id).filter((id) => id.startsWith(prefix)).map((id) => id.slice(prefix.length));
  }
  function readIndex() {
    const index = readJson(indexFile);
    return index && typeof index === 'object' ? index : {};
  }

  return {
    realtime: null,
    async listRooms() {
      return Object.entries(readIndex()).map(([code, meta]) => ({ code, ...meta }));
    },
    async roomExists(code) {
      return Boolean(readIndex()[canon(code)]);
    },
    async loadRoom(code) {
      const id = canon(code);
      const rec = id && readJson(path.join(roomsDir, id + '.json'));
      if (!rec || !rec.room) return { version: 0, room: null, online: onlineFor(id) };
      const priv = readJson(path.join(roomsDir, id + '.private.json'));
      return { version: rec.version || 1, room: mergeRoom(rec.room, priv), online: onlineFor(id) };
    },
    async saveRoom(code, version, room) {
      const id = canon(code);
      if (!id) return null;
      const current = readJson(path.join(roomsDir, id + '.json'));
      const have = current && current.room ? current.version || 1 : 0;
      if (version !== have && !(version === 0 && have === 0)) return null;
      const next = have + 1;
      const meta = roomMeta(room);
      const parts = splitRoom(room);
      writeJson(path.join(roomsDir, id + '.json'), { version: next, meta, room: parts.room });
      writeJson(path.join(roomsDir, id + '.private.json'), parts.private);
      const index = readIndex();
      index[id] = meta;
      writeJson(indexFile, index);
      return next;
    },
    async deleteRoom(code) {
      const id = canon(code);
      if (!id) return;
      fs.rmSync(path.join(roomsDir, id + '.json'), { force: true });
      fs.rmSync(path.join(roomsDir, id + '.private.json'), { force: true });
      const index = readIndex();
      delete index[id];
      writeJson(indexFile, index);
    },
    async loadBook() {
      const rec = readJson(bookFile);
      if (!rec || !rec.book) return { version: 0, book: emptyBook() };
      return { version: rec.version || 1, book: { ...emptyBook(), ...rec.book } };
    },
    async saveBook(version, book) {
      const rec = readJson(bookFile);
      const have = rec && rec.book ? rec.version || 1 : 0;
      if (version !== have && !(version === 0 && have === 0)) return null;
      const next = have + 1;
      writeJson(bookFile, { version: next, book });
      return next;
    },
    async seen(id) { seenAt.set(id, Date.now()); },
    // Finished and abandoned parties, newest last in the file.
    async recordParty(rec) {
      const all = readJson(partyFile) || [];
      const i = all.findIndex((r) => r.id === rec.id);
      if (i >= 0) all[i] = rec; else all.push(rec);
      writeJson(partyFile, all.slice(-2000));
    },
    async listHistory(limit) {
      const all = readJson(partyFile) || [];
      return { enabled: true, rows: [...all].sort((x, y) => y.endedAt - x.endedAt).slice(0, limit) };
    },
    // Plain facts about every room, for the dashboard.
    async liveRooms() {
      const out = [];
      for (const code of Object.keys(readIndex())) {
        const rec = readJson(path.join(roomsDir, code + '.json'));
        const room = rec && rec.room;
        if (!room) continue;
        const ps = Object.values(room.players || {});
        out.push({ code, createdAt: room.createdAt, activeAt: room.activeAt, stage: room.flow && room.flow.stage, order: room.flow && room.flow.order, idx: room.flow && room.flow.idx,
          gameId: room.live && room.live.gameId, theme: room.settings && room.settings.theme, south: room.settings && room.settings.south,
          players: ps.length, bots: ps.filter((p) => p && p.bot).length, online: onlineFor(code).length });
      }
      return out.sort((a, b) => (Number(b.activeAt) || 0) - (Number(a.activeAt) || 0));
    },
    // Question history per email hash: { [hash]: { [qid]: seenAt } }
    async qHistory(hashes) {
      const all = readJson(histFile) || {};
      return hashes.flatMap((h) => Object.entries(all[h] || {}).map(([qid, seenAt]) => ({ qid, seenAt })));
    },
    async qMark(hashes, ids) {
      const all = readJson(histFile) || {};
      const now = Date.now();
      for (const h of hashes) { all[h] = all[h] || {}; for (const id of ids) all[h][id] = now; }
      writeJson(histFile, all);
    },
  };
}

// Table names come from DB_PREFIX (default dgn), so two apps can share one database safely.
const PFX = /^[a-z][a-z0-9_]{0,15}$/.test(process.env.DB_PREFIX || '') ? process.env.DB_PREFIX : 'dgn';

function postgresStore() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  // A limited database login may not be allowed to create tables, so only create them when missing.
  const ready = pool.query(`SELECT to_regclass('public.${PFX}_room') AS a, to_regclass('public.${PFX}_room_private') AS b, to_regclass('public.${PFX}_book') AS c, to_regclass('public.${PFX}_seen') AS d`)
    .then((r) => { const x = r.rows[0] || {}; return x.a && x.b && x.c && x.d ? null : pool.query(`
    CREATE TABLE IF NOT EXISTS ${PFX}_room (
      code text PRIMARY KEY,
      version integer NOT NULL,
      active_at bigint NOT NULL DEFAULT 0,
      created_at bigint NOT NULL DEFAULT 0,
      humans integer NOT NULL DEFAULT 0,
      has_live boolean NOT NULL DEFAULT false,
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ${PFX}_room_private (
      code text PRIMARY KEY REFERENCES ${PFX}_room(code) ON DELETE CASCADE,
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ${PFX}_book (
      id boolean PRIMARY KEY DEFAULT true,
      version integer NOT NULL,
      data jsonb NOT NULL,
      CONSTRAINT ${PFX}_book_one CHECK (id)
    );
    CREATE TABLE IF NOT EXISTS ${PFX}_seen (
      player_id text PRIMARY KEY,
      seen_at bigint NOT NULL
    );
  `); }).then(() => migrateCombinedDocument(pool)).catch((err) => {
    console.error('[dgn] database setup failed');
    throw err;
  });
  const q = (text, params) => ready.then(() => pool.query(text, params));
  // Party history is optional: if this login may not create tables, the app plays on without it.
  let histOk = null;
  const history = () => histOk || (histOk = q(`
    CREATE TABLE IF NOT EXISTS ${PFX}_history (id text PRIMARY KEY, ended_at bigint NOT NULL, data jsonb NOT NULL);
    CREATE INDEX IF NOT EXISTS ${PFX}_history_ended ON ${PFX}_history (ended_at DESC);
  `).then(() => true, () => false));
  const withClient = async (fn) => {
    await ready;
    const client = await pool.connect();
    try { return await fn(client); } finally { client.release(); }
  };

  return {
    realtime: null,
    async listRooms() {
      const rows = await q(`SELECT code, active_at, created_at, humans, has_live FROM ${PFX}_room`);
      return rows.rows.map((r) => ({
        code: r.code,
        activeAt: Number(r.active_at) || 0,
        createdAt: Number(r.created_at) || 0,
        humans: Number(r.humans) || 0,
        hasLive: Boolean(r.has_live),
      }));
    },
    async roomExists(code) {
      const id = canon(code);
      if (!id) return false;
      const rows = await q(`SELECT 1 FROM ${PFX}_room WHERE code = $1`, [id]);
      return rows.rowCount > 0;
    },
    async loadRoom(code) {
      const id = canon(code);
      const now = Date.now();
      await q(`DELETE FROM ${PFX}_seen WHERE seen_at < $1`, [now - 25000]);
      const onlineRows = id
        ? await q(`SELECT player_id FROM ${PFX}_seen WHERE seen_at >= $1 AND player_id LIKE $2`, [now - 25000, id + ':%'])
        : { rows: [] };
      const online = onlineRows.rows.map((r) => String(r.player_id).slice(id.length + 1));
      if (!id) return { version: 0, room: null, online };
      const found = await q(
        `SELECT r.version, r.data, p.data AS private
         FROM ${PFX}_room r LEFT JOIN ${PFX}_room_private p ON p.code = r.code
         WHERE r.code = $1`,
        [id]
      );
      const row = found.rows[0];
      if (!row) return { version: 0, room: null, online };
      return { version: row.version, room: mergeRoom(row.data, row.private), online };
    },
    async saveRoom(code, version, room) {
      const id = canon(code);
      if (!id) return null;
      const meta = roomMeta(room);
      const parts = splitRoom(room);
      const roomJson = JSON.stringify(parts.room);
      const privateJson = JSON.stringify(parts.private);
      return withClient(async (client) => {
        await client.query('BEGIN');
        try {
          let saved;
          if (!version) {
            saved = await client.query(
              `INSERT INTO ${PFX}_room (code, version, active_at, created_at, humans, has_live, data)
               VALUES ($1, 1, $2, $3, $4, $5, $6::jsonb)
               ON CONFLICT (code) DO NOTHING RETURNING version`,
              [id, meta.activeAt, meta.createdAt, meta.humans, meta.hasLive, roomJson]
            );
          } else {
            saved = await client.query(
              `UPDATE ${PFX}_room
               SET version = version + 1, active_at = $3, created_at = $4, humans = $5, has_live = $6, data = $7::jsonb
               WHERE code = $1 AND version = $2 RETURNING version`,
              [id, version, meta.activeAt, meta.createdAt, meta.humans, meta.hasLive, roomJson]
            );
          }
          if (saved.rowCount !== 1) {
            await client.query('ROLLBACK');
            return null;
          }
          await client.query(
            `INSERT INTO ${PFX}_room_private (code, data) VALUES ($1, $2::jsonb)
             ON CONFLICT (code) DO UPDATE SET data = EXCLUDED.data`,
            [id, privateJson]
          );
          await client.query('COMMIT');
          return saved.rows[0].version;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      });
    },
    async deleteRoom(code) {
      const id = canon(code);
      if (!id) return;
      await q(`DELETE FROM ${PFX}_room WHERE code = $1`, [id]);
    },
    async loadBook() {
      const found = await q(`SELECT version, data FROM ${PFX}_book WHERE id = true`);
      const row = found.rows[0];
      if (!row) return { version: 0, book: emptyBook() };
      return { version: row.version, book: { ...emptyBook(), ...(row.data || {}) } };
    },
    async saveBook(version, book) {
      const body = JSON.stringify(book);
      if (!version) {
        const ins = await q(
          `INSERT INTO ${PFX}_book (id, version, data) VALUES (true, 1, $1::jsonb)
           ON CONFLICT (id) DO NOTHING RETURNING version`,
          [body]
        );
        return ins.rowCount === 1 ? ins.rows[0].version : null;
      }
      const upd = await q(
        `UPDATE ${PFX}_book SET version = version + 1, data = $2::jsonb WHERE id = true AND version = $1 RETURNING version`,
        [version, body]
      );
      return upd.rowCount === 1 ? upd.rows[0].version : null;
    },
    // Question history per email hash (table created by migration; missing table = no history, never an error).
    async qHistory(hashes) {
      const r = await q(`SELECT qid, seen_at FROM ${PFX}_qseen WHERE email_hash = ANY($1::text[])`, [hashes]);
      return r.rows.map((x) => ({ qid: x.qid, seenAt: Number(x.seen_at) }));
    },
    async qMark(hashes, ids) {
      await q(
        `INSERT INTO ${PFX}_qseen (email_hash, qid, seen_at)
         SELECT h, i, $3 FROM unnest($1::text[]) AS h CROSS JOIN unnest($2::text[]) AS i
         ON CONFLICT (email_hash, qid) DO UPDATE SET seen_at = EXCLUDED.seen_at`,
        [hashes, ids, Date.now()]
      );
    },
    async recordParty(rec) {
      if (!(await history())) return;
      await q(
        `INSERT INTO ${PFX}_history (id, ended_at, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO UPDATE SET ended_at = EXCLUDED.ended_at, data = EXCLUDED.data`,
        [rec.id, rec.endedAt, JSON.stringify(rec)]
      );
    },
    async listHistory(limit) {
      if (!(await history())) return { enabled: false, rows: [] };
      const r = await q(`SELECT data FROM ${PFX}_history ORDER BY ended_at DESC LIMIT $1`, [limit]);
      return { enabled: true, rows: r.rows.map((x) => x.data) };
    },
    // Facts about every room, pulled out in SQL so we never download whole rooms.
    async liveRooms() {
      const players = `CASE WHEN jsonb_typeof(r.data->'players') = 'object' THEN r.data->'players' ELSE '{}'::jsonb END`;
      const [rooms, seen] = await Promise.all([
        q(`SELECT r.code, r.created_at, r.active_at,
             r.data #>> '{flow,stage}' AS stage, r.data #> '{flow,order}' AS ord, r.data #>> '{flow,idx}' AS idx,
             r.data #>> '{live,gameId}' AS game_id, r.data #>> '{settings,theme}' AS theme, r.data #>> '{settings,south}' AS south,
             (SELECT count(*) FROM jsonb_each(${players})) AS players,
             (SELECT count(*) FROM jsonb_each(${players}) e WHERE e.value->>'bot' = 'true') AS bots
           FROM ${PFX}_room r ORDER BY r.active_at DESC LIMIT 100`),
        q(`SELECT split_part(player_id, ':', 1) AS code, count(*) AS n FROM ${PFX}_seen WHERE seen_at >= $1 GROUP BY 1`, [Date.now() - 25000]),
      ]);
      const online = Object.fromEntries(seen.rows.map((x) => [x.code, Number(x.n)]));
      return rooms.rows.map((r) => ({ code: r.code, createdAt: Number(r.created_at), activeAt: Number(r.active_at), stage: r.stage, order: r.ord, idx: r.idx,
        gameId: r.game_id, theme: r.theme, south: r.south, players: Number(r.players), bots: Number(r.bots), online: online[r.code] || 0 }));
    },
    async seen(id) {
      await q(
        `INSERT INTO ${PFX}_seen (player_id, seen_at) VALUES ($1, $2)
         ON CONFLICT (player_id) DO UPDATE SET seen_at = EXCLUDED.seen_at`,
        [id, Date.now()]
      );
    },
  };
}

// Older databases kept every party in one JSON document. Copy each party into
// its own rows, then drop that document so the copy does not remain.
async function migrateCombinedDocument(pool) {
  const reg = await pool.query(`SELECT to_regclass('public.${PFX}_document') AS name`);
  if (!reg.rows[0] || !reg.rows[0].name) return;
  const doc = await pool.query(`SELECT data FROM ${PFX}_document WHERE id = true`);
  const packed = legacyRooms(doc.rows[0] && doc.rows[0].data);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [code, room] of Object.entries(packed.rooms)) {
      const id = canon(code);
      if (!id) continue;
      const meta = roomMeta(room);
      const parts = splitRoom(room);
      const ins = await client.query(
        `INSERT INTO ${PFX}_room (code, version, active_at, created_at, humans, has_live, data)
         VALUES ($1, 1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (code) DO NOTHING RETURNING code`,
        [id, meta.activeAt, meta.createdAt, meta.humans, meta.hasLive, JSON.stringify(parts.room)]
      );
      if (ins.rowCount === 1) {
        await client.query(
          `INSERT INTO ${PFX}_room_private (code, data) VALUES ($1, $2::jsonb) ON CONFLICT (code) DO NOTHING`,
          [id, JSON.stringify(parts.private)]
        );
      }
    }
    await client.query(
      `INSERT INTO ${PFX}_book (id, version, data) VALUES (true, 1, $1::jsonb) ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(packed.book)]
    );
    await client.query(`DROP TABLE ${PFX}_document`);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function realtimeExtras() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return {};
  return {
    realtime: { url, key, channel: 'dgn' },
    // Tell the room's screens to refetch. The payload is only a version number.
    async nudge(code, v) {
      await fetch(`${url}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ topic: 'dgn:' + code, event: 'state', payload: { v }, private: false }] }),
      });
    },
  };
}

let store = null;
function getStore() {
  if (!store) {
    const base = process.env.DATABASE_URL ? postgresStore() : fileStore();
    store = Object.assign(base, realtimeExtras());
  }
  return store;
}

module.exports = { getStore };
