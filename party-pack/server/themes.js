// Theme packs. A room's look is one pack: either picked by the host or "auto", which follows
// the season where the host is (the phone tells us which hemisphere when the room is made).
// The colours themselves live in public/css/ui.css under [data-pack="<id>"].

const PACKS = [
  { id: 'classic', name: 'Midnight', emoji: '🌌', kind: 'season', swatch: ['#14162E', '#FFB020'] },
  { id: 'spring', name: 'Blossom', emoji: '🌸', kind: 'season', swatch: ['#FFF1F4', '#EC4C8B'] },
  { id: 'summer', name: 'Sunshine', emoji: '☀️', kind: 'season', swatch: ['#FFF6DC', '#FF7A1A'] },
  { id: 'autumn', name: 'Harvest', emoji: '🍂', kind: 'season', swatch: ['#2B1810', '#FF9A3D'] },
  { id: 'winter', name: 'Frost', emoji: '❄️', kind: 'season', swatch: ['#0F1D36', '#7FD4FF'] },
  { id: 'newyear', name: 'New Year', emoji: '🥂', kind: 'festival', swatch: ['#111014', '#F2CB6B'] },
  { id: 'lunar', name: 'Lunar New Year', emoji: '🏮', kind: 'festival', swatch: ['#3A0B10', '#FFC94D'] },
  { id: 'spooky', name: 'Spooky Night', emoji: '🎃', kind: 'festival', swatch: ['#17111F', '#FF7A18'] },
  { id: 'lights', name: 'Festival of Lights', emoji: '🪔', kind: 'festival', swatch: ['#2A0E2E', '#FFB020'] },
  { id: 'festive', name: 'Winter Holidays', emoji: '🎄', kind: 'festival', swatch: ['#0F2A22', '#F5C451'] },
];
const IDS = PACKS.map((p) => p.id);
const valid = (id) => IDS.includes(id);

// Dates that move each year: [month, day].
const LUNAR = { 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3] };
const DIWALI = { 2026: [11, 8], 2027: [10, 29], 2028: [10, 17], 2029: [11, 5], 2030: [10, 26] };

const DAY = 24 * 3600e3;
const near = (date, md, before, after) => {
  if (!md) return false;
  const d = Date.UTC(date.getUTCFullYear(), md[0] - 1, md[1]);
  return date.getTime() >= d - before * DAY && date.getTime() < d + (after + 1) * DAY;
};

// Festival packs that are in season right now. They are offered first in the picker, never forced.
function inSeason(date = new Date()) {
  const m = date.getUTCMonth() + 1, d = date.getUTCDate(), y = date.getUTCFullYear();
  const out = [];
  if ((m === 12 && d >= 27) || (m === 1 && d <= 2)) out.push('newyear');
  if (near(date, LUNAR[y], 3, 7)) out.push('lunar');
  if (m === 10 && d >= 20) out.push('spooky');
  if (near(date, DIWALI[y], 6, 3)) out.push('lights');
  if (m === 12 && d >= 5 && d <= 26) out.push('festive');
  return out;
}

// "Auto" follows the four seasons, flipped south of the equator.
function autoPack(date = new Date(), south = false) {
  const m = date.getUTCMonth() + 1;
  const north = m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
  if (!south) return north;
  return { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' }[north];
}

const resolve = (settings, date = new Date()) => (valid(settings && settings.theme) ? settings.theme : autoPack(date, Boolean(settings && settings.south)));

module.exports = { PACKS, IDS, valid, inSeason, autoPack, resolve };
