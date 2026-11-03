// Personalised questions: guests answer a short questionnaire on their phones, and when a
// game starts roughly N% (default 20%) of its questions are swapped for questions built
// from those answers ("Whose dream holiday is Bali?", "What is Priya's favourite movie?").
// The standard content is never modified; the mixed set is stored on the live game.

const crypto = require('crypto');
const S = require('./state');

const DEFAULT_PROMPTS = [
  { id: 'movie', tag: 'movie', text: 'Your all-time favourite movie', ph: 'e.g. Kabhi Khushi Kabhie Gham',
    who: 'Whose all-time favourite movie is “{a}”?', what: "What is {n}'s all-time favourite movie?", clue: 'Their all-time favourite movie is “{a}”' },
  { id: 'rewatch', tag: 'movie', text: 'A movie you can watch again and again', ph: 'e.g. 3 Idiots',
    who: 'Who can watch “{a}” again and again?', what: 'Which movie can {n} watch again and again?', clue: 'They can watch “{a}” again and again' },
  { id: 'star', tag: 'movie', text: 'Favourite actor or actress', ph: 'e.g. Shah Rukh Khan',
    who: 'Whose favourite star is {a}?', what: "Who is {n}'s favourite actor or actress?", clue: 'Their favourite star is {a}' },
  { id: 'holiday', tag: 'holiday', text: 'Dream holiday destination', ph: 'e.g. Bali',
    who: 'Whose dream holiday destination is {a}?', what: 'Where does {n} dream of going on holiday?', clue: 'Their dream holiday destination is {a}' },
  { id: 'trip', tag: 'holiday', text: 'Best trip you have ever taken (where?)', ph: 'e.g. Goa with college friends',
    who: 'Who says their best trip ever was: {a}?', what: "What was {n}'s best trip ever?", clue: 'Their best trip ever: {a}' },
  { id: 'sweet', tag: 'food', text: 'Favourite Diwali sweet', ph: 'e.g. Kaju katli',
    who: 'Whose favourite Diwali sweet is {a}?', what: "What is {n}'s favourite Diwali sweet?", clue: 'Their favourite Diwali sweet is {a}' },
  { id: 'comfort', tag: 'food', text: "Comfort food you'd never give up", ph: 'e.g. Rajma chawal',
    who: 'Who would never give up {a}?', what: 'Which comfort food would {n} never give up?', clue: 'They would never give up {a}' },
  { id: 'dance', tag: 'music', text: 'A song that always gets you dancing', ph: 'e.g. London Thumakda',
    who: 'Which guest can’t resist dancing to “{a}”?', what: 'Which song always gets {n} dancing?', clue: 'They can’t resist dancing to “{a}”' },
  { id: 'talent', tag: 'fun', text: 'A hidden talent', ph: 'e.g. I can solve a Rubik’s cube',
    who: 'Whose hidden talent is: {a}?', what: "What is {n}'s hidden talent?", clue: 'Their hidden talent: {a}' },
  { id: 'fact', tag: 'fun', text: 'A fun fact few people know about you', ph: 'e.g. I once met Amitabh Bachchan',
    who: 'Who is this? “{a}”', what: 'Which of these is a fun fact about {n}?', clue: 'Fun fact: “{a}”' },
];

const TAG_CLUE = { movie: '🎬 ✨ 🕵️', holiday: '🏝️ ✨ 🕵️', food: '🍬 ✨ 🕵️', music: '💃 ✨ 🕵️', fun: '🤫 ✨ 🕵️' };

const shuffle = (a) => S.shuffle(a);
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim();
const fill = (t, v) => t.replace(/\{a\}/g, v.a || '').replace(/\{n\}/g, v.n || '').replace(/\{text\}/g, v.text || '');

function cleanAnswer(a) {
  a = String(a || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  return a ? a[0].toUpperCase() + a.slice(1) : '';
}

function promptTemplates(p) {
  return {
    who: p.who || 'Who answered “{a}” to “{text}”?',
    what: p.what || 'What did {n} answer to “{text}”?',
    clue: p.clue || 'This guest answered “{a}” to “{text}”',
  };
}

// Every possible personal question from the current answers.
function buildPool(state) {
  const players = Object.values(state.players);
  const items = [];
  for (const prompt of state.questionnaire || []) {
    const t = promptTemplates(prompt);
    const answers = players.map((p) => ({ p, a: cleanAnswer((p.answers || {})[prompt.id]) })).filter((x) => x.a);
    if (!answers.length) continue;
    const counts = {};
    answers.forEach((x) => { counts[norm(x.a)] = (counts[norm(x.a)] || 0) + 1; });
    for (const x of answers) {
      const base = { about: x.p.id, aboutName: x.p.name, promptId: prompt.id, tag: prompt.tag || 'fun', answerText: x.a, personal: true };
      // "Whose favourite movie is X?" — needs a unique answer and at least one other guest.
      if (counts[norm(x.a)] === 1 && players.length >= 2) {
        const opts = shuffle([x.p.name, ...shuffle(players.filter((p) => p.id !== x.p.id)).slice(0, 3).map((p) => p.name)]);
        items.push({ ...base, kind: 'who', q: fill(t.who, { a: x.a, text: prompt.text }), options: opts, answer: opts.indexOf(x.p.name), clueText: fill(t.clue, { a: x.a, text: prompt.text }) });
      }
      // "What is Priya's favourite movie?" — needs two other distinct answers to the same prompt.
      const others = [...new Map(answers.filter((y) => norm(y.a) !== norm(x.a)).map((y) => [norm(y.a), y.a])).values()];
      if (others.length >= 2) {
        const opts = shuffle([x.a, ...shuffle(others).slice(0, 3)]);
        items.push({ ...base, kind: 'what', q: fill(t.what, { n: x.p.name, text: prompt.text }), options: opts, answer: opts.indexOf(x.a) });
      }
    }
  }
  return items;
}

// Choose k items, preferring a tag, spreading across guests and avoiding repeats tonight.
function pick(pool, k, { preferTags = [], kinds = ['who', 'what'], used = new Set() } = {}) {
  let cands = shuffle(pool.filter((i) => kinds.includes(i.kind) && !used.has(`${i.promptId}:${i.about}`)));
  if (cands.length < k) cands = cands.concat(shuffle(pool.filter((i) => kinds.includes(i.kind) && !cands.includes(i))));
  cands.sort((a, b) => (preferTags.includes(b.tag) ? 1 : 0) - (preferTags.includes(a.tag) ? 1 : 0));
  const chosen = [];
  const perGuest = {};
  const seen = new Set();
  // Round-robin: first pass allows 1 per guest, then 2, ... so everyone gets featured.
  for (let cap = 1; chosen.length < k && cap <= 10; cap++) {
    for (const it of cands) {
      if (chosen.length >= k) break;
      const key = `${it.promptId}:${it.about}`;
      if (seen.has(key) || (perGuest[it.about] || 0) >= cap) continue;
      chosen.push(it);
      seen.add(key);
      perGuest[it.about] = (perGuest[it.about] || 0) + 1;
    }
  }
  return chosen;
}

const toMCQ = (it, extra = {}) => ({ q: it.q, options: it.options, answer: it.answer, personal: true, about: it.about, ...extra });
const spread = (n, k) => [...new Set(Array.from({ length: k }, (_, j) => Math.min(n - 1, Math.floor(((j + 1) * n) / (k + 1)))))];
const countFor = (n, pct) => (n <= 0 || pct <= 0 ? 0 : Math.max(1, Math.round(n * pct)));

// Returns { content, count } for a game about to start.
function personalize(game, state) {
  const pct = Math.max(0, Math.min(100, Number(state.settings.personalPct ?? 20))) / 100;
  const content = JSON.parse(JSON.stringify(game.content));
  if (game.personalize === false || !pct) return { content, count: 0 };
  const pool = buildPool(state);
  if (!pool.length) return { content, count: 0 };
  const used = new Set(state.personalUsed || []);
  const mark = (items) => items.forEach((i) => used.add(`${i.promptId}:${i.about}`));
  const preferTags = /movie|film|bollywood/i.test(game.title) ? ['movie'] : /song|music|dance|hook/i.test(game.title) ? ['music'] : [];
  let count = 0;

  if (game.type === 'quiz') {
    const qs = content.questions || [];
    const items = pick(pool, countFor(qs.length, pct), { preferTags, used });
    spread(qs.length, items.length).forEach((pos, j) => {
      const it = items[j];
      qs[pos] = toMCQ(it, { time: qs[pos].time || 20, clue: qs[pos].clue ? TAG_CLUE[it.tag] || '✨ 🕵️' : undefined });
    });
    mark(items);
    count = items.length;
  } else if (game.type === 'jeopardy') {
    const cats = content.categories || [];
    const k = countFor(cats.length, pct);
    for (let c = cats.length - k; c < cats.length; c++) {
      const values = cats[c].clues.map((cl) => cl.value);
      const items = pick(pool, values.length, { kinds: ['who'], used });
      if (!items.length) continue;
      cats[c] = { name: '✨ Know Your Guests', personal: true, clues: items.map((it, i) => ({ value: values[i], q: it.clueText, a: it.aboutName, personal: true, about: it.about })) };
      mark(items);
      count += items.length;
    }
  } else if (game.type === 'kbc') {
    const ff = content.fastestFinger || [];
    const ffItems = pick(pool, ff.length > 1 ? countFor(ff.length, pct) : 0, { used });
    spread(ff.length, ffItems.length).forEach((pos, j) => { ff[pos] = toMCQ(ffItems[j], { time: ff[pos].time || 15 }); });
    mark(ffItems);
    count += ffItems.length;
    const ladder = content.ladder || [];
    const levels = spread(ladder.length, countFor(ladder.length, pct)).filter((l) => l > 0);
    for (const l of levels) {
      // Several per level so a hot-seat guest never gets a question about themselves.
      const items = pick(pool, 3, { used });
      if (!items.length) continue;
      ladder[l].questions = [...items.map((it) => toMCQ(it)), ...ladder[l].questions];
      ladder[l].personal = true;
      mark(items);
      count += 1;
    }
  } else if (game.type === 'hookstep') {
    const songs = content.songs || [];
    const dance = shuffle(pool.filter((i) => i.promptId === 'dance' && i.kind !== 'what'));
    const uniq = [...new Map(dance.map((i) => [norm(i.answerText), i])).values()];
    const k = Math.min(uniq.length, countFor(songs.length, pct));
    const slots = songs.map((s, i) => ({ s, i })).sort((a, b) => (a.s.youtube ? 1 : 0) - (b.s.youtube ? 1 : 0)).slice(0, k).map((x) => x.i);
    slots.forEach((pos, j) => { songs[pos] = { title: `${uniq[j].answerText} (${uniq[j].aboutName}'s pick)`, step: 'Guest’s choice — freestyle your best hook step!', personal: true }; });
    count = k;
  }
  state.personalUsed = [...used];
  return { content, count };
}

function preview(state, n = 8) {
  const pool = buildPool(state);
  return { total: pool.length, sample: pick(pool, n).map((i) => ({ q: i.q, options: i.options, answer: i.answer, about: i.aboutName })) };
}

module.exports = { DEFAULT_PROMPTS, personalize, preview, cleanAnswer, buildPool };
