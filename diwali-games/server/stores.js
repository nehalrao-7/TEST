// Storage backends. Supabase (production): one JSON row with a version number, updated with
// a compare-and-swap RPC that also broadcasts the new version over Supabase Realtime.
// File (local dev): in-memory with a JSON file on disk.

const fs = require('fs');
const path = require('path');

function supabaseStore() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  const secret = process.env.DGN_SECRET;
  const rpc = async (fn, args) => {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: secret, ...args }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Database error (${res.status}): ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
  return {
    realtime: { url, key, channel: 'dgn' },
    async load() { return rpc('dgn_load', {}); },
    async save(version, data) { return rpc('dgn_save', { p_version: version, p_data: data }); },
    async seen(playerId) { await rpc('dgn_seen', { p_player: playerId }); },
    // Server-side reactions (demo bots) go out on the same Realtime channel as phone reactions.
    async broadcast(reacts) {
      await fetch(`${url}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: reacts.map((r) => ({ topic: 'dgn', event: 'react', payload: r, private: false })) }),
      });
    },
  };
}

function fileStore() {
  const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const file = path.join(dir, 'state.json');
  let version = 0;
  let data = null;
  try { ({ version, data } = JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { /* fresh start */ }
  const seenAt = new Map();
  return {
    realtime: null,
    async load() {
      const online = [...seenAt].filter(([, t]) => t > Date.now() - 25000).map(([id]) => id);
      return { version, data: data && JSON.parse(JSON.stringify(data)), online };
    },
    async save(v, d) {
      if (v !== version) return null;
      version++;
      data = JSON.parse(JSON.stringify(d));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file + '.tmp', JSON.stringify({ version, data }));
      fs.renameSync(file + '.tmp', file);
      return version;
    },
    async seen(id) { seenAt.set(id, Date.now()); },
  };
}

function postgresStore() {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
  });
  const ready = pool.query(`
    CREATE TABLE IF NOT EXISTS dgn_document (
      id boolean PRIMARY KEY DEFAULT true,
      version integer NOT NULL,
      data jsonb NOT NULL,
      CONSTRAINT dgn_document_one CHECK (id)
    );
    CREATE TABLE IF NOT EXISTS dgn_seen (
      player_id text PRIMARY KEY,
      seen_at bigint NOT NULL
    );
  `);
  const q = (text, params) => ready.then(() => pool.query(text, params));
  return {
    realtime: null,
    async load() {
      const now = Date.now();
      await q('DELETE FROM dgn_seen WHERE seen_at < $1', [now - 25000]);
      const onlineRows = await q('SELECT player_id FROM dgn_seen WHERE seen_at >= $1', [now - 25000]);
      const doc = await q('SELECT version, data FROM dgn_document WHERE id = true');
      const row = doc.rows[0];
      return {
        version: row ? row.version : 0,
        data: row ? row.data : null,
        online: onlineRows.rows.map((r) => r.player_id),
      };
    },
    async save(v, d) {
      const body = JSON.stringify(d);
      if (v === 0) {
        const ins = await q(
          `INSERT INTO dgn_document (id, version, data) VALUES (true, 1, $1::jsonb)
           ON CONFLICT (id) DO NOTHING RETURNING version`,
          [body]
        );
        if (ins.rowCount === 1) return ins.rows[0].version;
      }
      const upd = await q(
        'UPDATE dgn_document SET version = version + 1, data = $2::jsonb WHERE id = true AND version = $1 RETURNING version',
        [v, body]
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

let store = null;
function getStore() {
  if (!store) {
    if (process.env.DATABASE_URL) store = postgresStore();
    else if (process.env.SUPABASE_URL && process.env.DGN_SECRET) store = supabaseStore();
    else store = fileStore();
  }
  return store;
}

module.exports = { getStore };
