// What is allowed to sit with the game, and what is kept per room beside it.
// A full phone number is never written. The hash is peppered with the host key,
// so a database copy cannot be turned back into numbers on its own.

const crypto = require('crypto');

function pepper() {
  const env = String(process.env.HOST_CREATE_KEY || process.env.PHONE_PEPPER || '');
  return env.length >= 8 ? env : '';
}

function phoneHash(phone) {
  return crypto.createHash('sha256').update(pepper() + '\0' + String(phone || ''), 'utf8').digest('hex');
}

function phoneTail(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-4);
}

function maskTail(tail) {
  return tail ? '••• ' + String(tail).slice(-4) : '';
}

function emptyBook() {
  return { otpAt: {}, createFails: [], creates: [] };
}

function roomMeta(room) {
  const players = room && room.players;
  const humans = players && typeof players === 'object'
    ? Object.values(players).filter((p) => p && !p.bot).length
    : 0;
  return {
    activeAt: Number(room && (room.activeAt || room.createdAt)) || 0,
    createdAt: Number(room && room.createdAt) || 0,
    humans,
    hasLive: Boolean(room && room.live),
  };
}

// Split one room into the game record and that room's private record.
// The game record has no phone numbers and no questionnaire answers.
function splitRoom(room) {
  const copy = JSON.parse(JSON.stringify(room || {}));
  const priv = { players: {}, pending: {} };
  for (const [id, p] of Object.entries(copy.players || {})) {
    if (!p || typeof p !== 'object') continue;
    if (typeof p.phone === 'string' && p.phone.startsWith('+')) {
      p.phoneHash = phoneHash(p.phone);
      p.phoneTail = phoneTail(p.phone);
    }
    if (p.bot) {
      delete p.phoneHash;
      delete p.phoneTail;
    }
    const secret = {};
    if (p.phoneHash) secret.phoneHash = p.phoneHash;
    if (p.phoneTail) secret.phoneTail = p.phoneTail;
    if (p.answers && typeof p.answers === 'object' && Object.keys(p.answers).length) secret.answers = p.answers;
    if (Object.keys(secret).length) priv.players[id] = secret;
    delete p.phone;
    delete p.phoneHash;
    delete p.phoneTail;
    delete p.answers;
  }
  const pending = {};
  for (const [key, value] of Object.entries(copy.pending || {})) {
    if (!value || typeof value !== 'object') continue;
    const id = typeof key === 'string' && key.startsWith('+') ? phoneHash(key) : key;
    const slot = { ...value };
    if (typeof slot.phone === 'string') {
      slot.phoneTail = slot.phoneTail || phoneTail(slot.phone);
      delete slot.phone;
    }
    delete slot.phoneHash;
    pending[id] = slot;
  }
  priv.pending = pending;
  copy.pending = {};
  return { room: scrubPhones(copy), private: scrubPhones(priv) };
}

function mergeRoom(room, priv) {
  const copy = JSON.parse(JSON.stringify(room || {}));
  const secret = priv && typeof priv === 'object' ? priv : {};
  copy.players = copy.players || {};
  for (const [id, extra] of Object.entries(secret.players || {})) {
    if (!copy.players[id] || !extra) continue;
    if (extra.phoneHash) copy.players[id].phoneHash = extra.phoneHash;
    if (extra.phoneTail) copy.players[id].phoneTail = extra.phoneTail;
    if (extra.answers) copy.players[id].answers = extra.answers;
  }
  copy.pending = secret.pending && typeof secret.pending === 'object' ? secret.pending : {};
  return copy;
}

function scrubPhones(value) {
  if (Array.isArray(value)) return value.map(scrubPhones);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'phone' && typeof child === 'string') continue;
    out[key] = scrubPhones(child);
  }
  return out;
}

module.exports = { phoneHash, phoneTail, maskTail, emptyBook, roomMeta, splitRoom, mergeRoom, scrubPhones };
