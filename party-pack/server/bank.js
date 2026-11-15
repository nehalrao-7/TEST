// Question packs for Party Pack.
// The host turns packs on in the lobby; each player picks the packs they like in their profile.
// Every question is ranked 1 (very easy) – 5 (very hard). Each game has a difficulty
// (easy / medium / hard / ramp) and questions are drawn so that:
//   • players take turns "owning" a question slot, so everyone gets questions from their own picks;
//   • within a player's picks, packs more of the room picked come up more (the majority wins ties);
//   • questions nobody in the room has seen come first, then the ones seen longest ago.

const S = require('./state');

const GROUPS = [
  { id: 'everyone', label: 'For everyone' },
  { id: 'bolly', label: 'Bollywood' },
  { id: 'styles', label: 'Fun formats' },
  { id: 'indian', label: 'Indian' },
  { id: 'regional', label: 'Indian regions' },
  { id: 'canada', label: 'Canadian' },
  { id: 'newcomer', label: 'New to Canada' },
];
const FILES = ['general', 'fandom', 'bollywood', 'styles', 'indian', 'regional', 'canada', 'newcomer'];
const PACKS = FILES.flatMap((f) => require(`./packs/${f}`));
const BY_ID = Object.fromEntries(PACKS.map((p) => [p.id, p]));
const PACK_LIST = PACKS.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, group: p.group, count: p.questions.length + p.movies.length }));
const ALL_IDS = PACKS.map((p) => p.id);

const DIFFICULTIES = {
  easy: { label: 'Easy', lo: 1, hi: 2 },
  medium: { label: 'Medium', lo: 2, hi: 4 },
  hard: { label: 'Hard', lo: 4, hi: 5 },
  ramp: { label: 'Easy → hard', lo: 1, hi: 5 },
};

const AGE_BANDS = ['Under 13', '13–19', '20–29', '30–44', '45–59', '60+'];

// Slot targets, rising through the difficulty window.
const targets = (n, diff) => {
  const { lo, hi } = DIFFICULTIES[diff] || DIFFICULTIES.ramp;
  return Array.from({ length: n }, (_, i) => (n === 1 ? (lo + hi) / 2 : lo + ((hi - lo) * i) / (n - 1)));
};

function weighted(list, w, rand) {
  const total = list.reduce((a, x) => a + w(x), 0);
  let r = rand() * total;
  for (const x of list) { r -= w(x); if (r <= 0) return x; }
  return list[list.length - 1];
}

// Who gets a say, and how many players picked each pack.
function voices(players, enabled) {
  const on = new Set(enabled);
  const votes = {};
  const people = players.map((p) => {
    const picks = ((p.profile && p.profile.interests) || []).filter((id) => on.has(id));
    picks.forEach((id) => { votes[id] = (votes[id] || 0) + 1; });
    return picks;
  });
  return { people, votes };
}

// Lower is better: unseen first, then seen by fewer players, then longest ago; then closest to the target difficulty.
function score(item, target, hist, rand) {
  const h = hist[item.id];
  const seen = h ? h[0] : 0;
  const age = h ? Math.min(1, (Date.now() - h[1]) / (180 * 24 * 3600e3)) : 1;
  return seen * 10 + (h ? 3 - 3 * age : 0) + Math.abs(item.d - target) * 1.5 + rand() * 0.8;
}

function choosePack(person, avail, votes, rand) {
  const mine = person.filter((id) => avail.includes(id));
  const popular = avail.filter((id) => votes[id]);
  // Your own picks first; no picks (or none left) → follow the room's majority; nobody picked → anything on.
  const from = mine.length ? mine : popular.length ? popular : avail;
  return weighted(from, (id) => 1 + (votes[id] || 0) * 2, rand);
}

function draw(kind, n, { players, enabled, difficulty, hist, rand, used }) {
  const key = kind === 'movie' ? 'movies' : 'questions';
  let avail = enabled.filter((id) => BY_ID[id] && BY_ID[id][key].length);
  if (!avail.length) avail = ALL_IDS.filter((id) => BY_ID[id][key].length);
  const { people, votes } = voices(players, avail);
  const order = S.shuffle(people.map((_, i) => i));
  const out = [];
  targets(n, difficulty).forEach((target, slot) => {
    const person = order.length ? people[order[slot % order.length]] : [];
    let packIds = [choosePack(person, avail, votes, rand)];
    for (let tries = 0; tries < 2; tries++) {
      const pool = packIds.flatMap((id) => BY_ID[id][key]).filter((x) => !used.has(x.id));
      if (pool.length) {
        const best = pool.map((x) => [x, score(x, target, hist, rand)]).sort((a, b) => a[1] - b[1])[0][0];
        used.add(best.id); out.push(best); return;
      }
      packIds = avail; // that pack ran dry — fall back to every enabled pack
    }
  });
  return out.sort((a, b) => a.d - b.d);
}

// Turn a stored question into what the game engines expect, options shuffled.
function render(x, time = 20) {
  const options = S.shuffle([x.right, ...x.wrong]);
  const out = { qid: x.id, pack: x.pack, d: x.d, q: x.q, options, answer: options.indexOf(x.right), time };
  if (x.clue) out.clue = x.clue;
  return out;
}

// Builds one game's content. opts: { enabled, difficulty, hist, rand, sizes }.
function buildContent(type, players, opts = {}) {
  const rand = opts.rand || Math.random;
  const enabled = Array.isArray(opts.enabled) && opts.enabled.length ? opts.enabled : ALL_IDS;
  const ctx = { players, enabled, difficulty: opts.difficulty || 'ramp', hist: opts.hist || {}, rand, used: new Set() };
  const sizes = opts.sizes || {};
  if (type === 'movie') return { questions: draw('movie', sizes.movie || 6, ctx).map((x) => render(x)) };
  if (type === 'quiz') return { questions: draw('q', sizes.quiz || 10, ctx).map((x) => render(x)) };
  if (type === 'kbc') {
    const ladder = [100, 150, 200, 250, 300, 400, 500, 600, 800, 1000];
    return { ladder: draw('q', sizes.kbc || 10, ctx).map((x, i) => ({ points: ladder[Math.min(i, ladder.length - 1)], questions: [render(x)] })) };
  }
  if (type === 'jeopardy') {
    // Category Clash: each category is a pack. Players take turns choosing which pack becomes a category.
    const per = sizes.clues || 3;
    let avail = enabled.filter((id) => BY_ID[id] && BY_ID[id].questions.length >= per);
    if (avail.length < 2) avail = ALL_IDS.filter((id) => BY_ID[id].questions.length >= per);
    const { people, votes } = voices(players, avail);
    const order = S.shuffle(people.map((_, i) => i));
    const cats = [];
    for (let i = 0; cats.length < Math.min(sizes.cats || 4, avail.length) && i < 50; i++) {
      const left = avail.filter((id) => !cats.includes(id));
      const person = order.length ? people[order[i % order.length]] : [];
      cats.push(choosePack(person, left, votes, rand));
    }
    return {
      categories: cats.map((id) => {
        const pk = BY_ID[id];
        const clues = targets(per, ctx.difficulty).map((t) => {
          const pool = pk.questions.filter((x) => !ctx.used.has(x.id));
          const best = pool.map((x) => [x, score(x, t, ctx.hist, rand)]).sort((a, b) => a[1] - b[1])[0][0];
          ctx.used.add(best.id);
          return best;
        }).sort((a, b) => a.d - b.d);
        return { name: `${pk.emoji} ${pk.name}`, clues: clues.map((x, n) => ({ ...render(x), value: (n + 1) * 100 })) };
      }),
    };
  }
  return null;
}

// Every stock question id in a built game (for the seen-history).
function questionIds(content) {
  if (!content) return [];
  const all = [...(content.questions || []), ...(content.ladder || []).flatMap((r) => r.questions || []), ...(content.categories || []).flatMap((c) => c.clues || [])];
  return all.map((x) => x.qid).filter(Boolean);
}

module.exports = { GROUPS, PACKS, PACK_LIST, ALL_IDS, DIFFICULTIES, AGE_BANDS, buildContent, questionIds, BY_ID };
