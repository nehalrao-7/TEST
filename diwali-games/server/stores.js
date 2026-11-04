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

let store = null;
function getStore() {
  if (!store) store = process.env.SUPABASE_URL && process.env.DGN_SECRET ? supabaseStore() : fileStore();
  return store;
}

module.exports = { getStore };
