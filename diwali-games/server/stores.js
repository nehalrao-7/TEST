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
  };
}

function postgresStore() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  // A limited database login may not be allowed to create tables, so only create them when missing.
  const ready = pool.query(`SELECT to_regclass('public.dgn_room') AS a, to_regclass('public.dgn_room_private') AS b, to_regclass('public.dgn_book') AS c, to_regclass('public.dgn_seen') AS d`)
    .then((r) => { const x = r.rows[0] || {}; return x.a && x.b && x.c && x.d ? null : pool.query(`
    CREATE TABLE IF NOT EXISTS dgn_room (
      code text PRIMARY KEY,
      version integer NOT NULL,
      active_at bigint NOT NULL DEFAULT 0,
      created_at bigint NOT NULL DEFAULT 0,
      humans integer NOT NULL DEFAULT 0,
      has_live boolean NOT NULL DEFAULT false,
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dgn_room_private (
      code text PRIMARY KEY REFERENCES dgn_room(code) ON DELETE CASCADE,
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dgn_book (
      id boolean PRIMARY KEY DEFAULT true,
      version integer NOT NULL,
      data jsonb NOT NULL,
      CONSTRAINT dgn_book_one CHECK (id)
    );
    CREATE TABLE IF NOT EXISTS dgn_seen (
      player_id text PRIMARY KEY,
      seen_at bigint NOT NULL
    );
  `); }).then(() => migrateCombinedDocument(pool)).catch((err) => {
    console.error('[dgn] database setup failed');
    throw err;
  });
  const q = (text, params) => ready.then(() => pool.query(text, params));
  const withClient = async (fn) => {
    await ready;
    const client = await pool.connect();
    try { return await fn(client); } finally { client.release(); }
  };

  return {
    realtime: null,
    async listRooms() {
      const rows = await q('SELECT code, active_at, created_at, humans, has_live FROM dgn_room');
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
      const rows = await q('SELECT 1 FROM dgn_room WHERE code = $1', [id]);
      return rows.rowCount > 0;
    },
    async loadRoom(code) {
      const id = canon(code);
      const now = Date.now();
      await q('DELETE FROM dgn_seen WHERE seen_at < $1', [now - 25000]);
      const onlineRows = id
        ? await q('SELECT player_id FROM dgn_seen WHERE seen_at >= $1 AND player_id LIKE $2', [now - 25000, id + ':%'])
        : { rows: [] };
      const online = onlineRows.rows.map((r) => String(r.player_id).slice(id.length + 1));
      if (!id) return { version: 0, room: null, online };
      const found = await q(
        `SELECT r.version, r.data, p.data AS private
         FROM dgn_room r LEFT JOIN dgn_room_private p ON p.code = r.code
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
              `INSERT INTO dgn_room (code, version, active_at, created_at, humans, has_live, data)
               VALUES ($1, 1, $2, $3, $4, $5, $6::jsonb)
               ON CONFLICT (code) DO NOTHING RETURNING version`,
              [id, meta.activeAt, meta.createdAt, meta.humans, meta.hasLive, roomJson]
            );
          } else {
            saved = await client.query(
              `UPDATE dgn_room
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
            `INSERT INTO dgn_room_private (code, data) VALUES ($1, $2::jsonb)
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
      await q('DELETE FROM dgn_room WHERE code = $1', [id]);
    },
    async loadBook() {
      const found = await q('SELECT version, data FROM dgn_book WHERE id = true');
      const row = found.rows[0];
      if (!row) return { version: 0, book: emptyBook() };
      return { version: row.version, book: { ...emptyBook(), ...(row.data || {}) } };
    },
    async saveBook(version, book) {
      const body = JSON.stringify(book);
      if (!version) {
        const ins = await q(
          `INSERT INTO dgn_book (id, version, data) VALUES (true, 1, $1::jsonb)
           ON CONFLICT (id) DO NOTHING RETURNING version`,
          [body]
        );
        return ins.rowCount === 1 ? ins.rows[0].version : null;
      }
      const upd = await q(
        'UPDATE dgn_book SET version = version + 1, data = $2::jsonb WHERE id = true AND version = $1 RETURNING version',
        [version, body]
      );
      return upd.rowCount === 1 ? upd.rows[0].version : null;
    },
    async seen(id) {
      await q(
        `INSERT INTO dgn_seen (player_id, seen_at) VALUES ($1, $2)
         ON CONFLICT (player_id) DO UPDATE SET seen_at = EXCLUDED.seen_at`,
        [id, Date.now()]
      );
    },
  };
}

// Older databases kept every party in one JSON document. Copy each party into
// its own rows, then drop that document so the copy does not remain.
async function migrateCombinedDocument(pool) {
  const reg = await pool.query(`SELECT to_regclass('public.dgn_document') AS name`);
  if (!reg.rows[0] || !reg.rows[0].name) return;
  const doc = await pool.query('SELECT data FROM dgn_document WHERE id = true');
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
        `INSERT INTO dgn_room (code, version, active_at, created_at, humans, has_live, data)
         VALUES ($1, 1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (code) DO NOTHING RETURNING code`,
        [id, meta.activeAt, meta.createdAt, meta.humans, meta.hasLive, JSON.stringify(parts.room)]
      );
      if (ins.rowCount === 1) {
        await client.query(
          'INSERT INTO dgn_room_private (code, data) VALUES ($1, $2::jsonb) ON CONFLICT (code) DO NOTHING',
          [id, JSON.stringify(parts.private)]
        );
      }
    }
    await client.query(
      `INSERT INTO dgn_book (id, version, data) VALUES (true, 1, $1::jsonb) ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(packed.book)]
    );
    await client.query('DROP TABLE dgn_document');
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
