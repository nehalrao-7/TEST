// Personalised questions: guests answer a short questionnaire on their phones, and when a
// game starts roughly N% (default 20%) of its questions are swapped for questions built
// from those answers ("Whose dream holiday is Bali?", "What is Priya's favourite movie?").
// The standard content is never modified; the mixed set is stored on the live game.

const crypto = require('crypto');
const S = require('./state');

// type: text (free answer) · pick (choose another guest) · vote (group superlative, choose a guest)
// · choice (fixed options). section groups them on the phone.
const DEFAULT_PROMPTS = [
  // ---- About you ----
  { id: 'movie', section: 'you', type: 'text', tag: 'movie', text: 'Your all-time favourite movie', ph: 'e.g. Kabhi Khushi Kabhie Gham',
    who: 'Whose all-time favourite movie is “{a}”?', what: "What is {n}'s all-time favourite movie?", clue: 'Their all-time favourite movie is “{a}”' },
  { id: 'star', section: 'you', type: 'text', tag: 'movie', text: 'Favourite actor or actress', ph: 'e.g. Shah Rukh Khan',
    who: 'Whose favourite star is {a}?', what: "Who is {n}'s favourite actor or actress?", clue: 'Their favourite star is {a}' },
  { id: 'holiday', section: 'you', type: 'text', tag: 'holiday', text: 'Dream holiday destination', ph: 'e.g. Bali',
    who: 'Whose dream holiday destination is {a}?', what: 'Where does {n} dream of going on holiday?', clue: 'Their dream holiday destination is {a}' },
  { id: 'sweet', section: 'you', type: 'text', tag: 'food', text: 'Favourite Diwali sweet', ph: 'e.g. Kaju katli',
    who: 'Whose favourite Diwali sweet is {a}?', what: "What is {n}'s favourite Diwali sweet?", clue: 'Their favourite Diwali sweet is {a}' },
  { id: 'dance', section: 'you', type: 'text', tag: 'music', text: 'A Bollywood song that always gets you dancing', ph: 'e.g. London Thumakda',
    who: 'Which guest can’t resist dancing to “{a}”?', what: 'Which song always gets {n} dancing?', clue: 'They can’t resist dancing to “{a}”' },
  { id: 'talent', section: 'you', type: 'text', tag: 'fun', text: 'A hidden talent', ph: 'e.g. I can solve a Rubik’s cube',
    who: 'Whose hidden talent is: {a}?', what: "What is {n}'s hidden talent?", clue: 'Their hidden talent: {a}' },
  { id: 'fact', section: 'you', type: 'text', tag: 'fun', text: 'A fun fact few people know about you', ph: 'e.g. I once met Amitabh Bachchan',
    who: 'Who is this? “{a}”', what: 'Which of these is a fun fact about {n}?', clue: 'Fun fact: “{a}”' },

  // ---- Garba time ----
  { id: 'garbaSong', section: 'garba', type: 'text', tag: 'garba', text: 'Favourite garba song', ph: 'e.g. Chogada Tara',
    who: 'Whose favourite garba song is “{a}”?', what: "What is {n}'s favourite garba song?", clue: 'Their favourite garba song is “{a}”' },
  { id: 'garbaEvent', section: 'garba', type: 'text', tag: 'garba', text: 'Favourite Toronto garba / Navratri event', ph: 'e.g. the big one at the convention centre',
    who: 'Whose favourite Toronto garba is “{a}”?', what: "Which is {n}'s favourite Toronto garba?", clue: 'Their favourite Toronto garba: “{a}”' },
  { id: 'garbaMove', section: 'garba', type: 'text', tag: 'garba', text: 'Your signature garba or dandiya move', ph: 'e.g. the double-spin three-taali',
    who: 'Whose signature garba move is “{a}”?', what: "What is {n}'s signature garba move?", clue: 'Their signature garba move: “{a}”' },
  { id: 'garbaOrDandiya', section: 'garba', type: 'choice', tag: 'garba', text: 'Garba or dandiya?', options: ['Garba', 'Dandiya', 'Both, all night!'],
    what: 'Garba or dandiya: what does {n} prefer?' },

  // ---- About the group (pick another guest) ----
  { id: 'partner', section: 'group', type: 'pick', tag: 'group', text: 'Your partner / spouse (if they’re here tonight)',
    who: "Who is {n}'s other half?", clue: "{n}'s other half" },
  { id: 'bestie', section: 'group', type: 'pick', tag: 'group', text: 'Your best friend in this group',
    who: 'Who did {n} name as their best friend in the group?', clue: '{n} named this guest as their best friend' },
  { id: 'dandiyaPartner', section: 'group', type: 'pick', tag: 'garba', text: 'Your go-to dandiya partner',
    who: "Who is {n}'s go-to dandiya partner?", clue: "{n}'s go-to dandiya partner" },
  { id: 'callFirst', section: 'group', type: 'pick', tag: 'group', text: 'Who would you call first if your car broke down on the way home from garba?',
    who: 'Who would {n} call first if their car broke down on the way home from garba?', clue: "{n}'s first call when the car breaks down after garba" },

  // ---- Group votes ----
  { id: 'voteDancer', section: 'vote', type: 'vote', tag: 'garba', text: 'Best garba dancer in the group',
    who: 'The group has voted! Who is the best garba dancer?', clue: 'The group voted this guest the best garba dancer' },
  { id: 'voteLast', section: 'vote', type: 'vote', tag: 'garba', text: 'Most likely to still be dancing when the garba ends',
    who: 'The group has voted! Who is most likely to still be dancing when the garba ends?', clue: 'Voted most likely to still be dancing when the garba ends' },
  { id: 'voteLate', section: 'vote', type: 'vote', tag: 'group', text: 'Most likely to show up late to garba',
    who: 'The group has voted! Who is most likely to show up late to garba?', clue: 'Voted most likely to show up late to garba' },
  { id: 'voteOutfit', section: 'vote', type: 'vote', tag: 'garba', text: 'Best Navratri outfits, every single year',
    who: 'The group has voted! Who has the best Navratri outfits every year?', clue: 'Voted best Navratri outfits, every single year' },
];
// Prompt ids from the first version, used to upgrade an unedited saved questionnaire.
const V1_IDS = ['movie', 'rewatch', 'star', 'holiday', 'trip', 'sweet', 'comfort', 'dance', 'talent', 'fact'];

const TAG_CLUE = { movie: '🎬 ✨ 🕵️', holiday: '🏝️ ✨ 🕵️', food: '🍬 ✨ 🕵️', music: '💃 ✨ 🕵️', fun: '🤫 ✨ 🕵️', garba: '🪔 💃 ✨', group: '👯 ✨ 🕵️' };

const shuffle = (a) => S.shuffle(a);
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim();
const fill = (t, v) => t.replace(/\{a\}/g, v.a || '').replace(/\{n\}/g, v.n || '').replace(/\{text\}/g, v.text || '');

function cleanAnswer(a) {
  a = String(a || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  return a ? a[0].toUpperCase() + a.slice(1) : '';
}

function promptTemplates(p) {
  if (p.type === 'pick') return { who: p.who || 'Who did {n} pick for “{text}”?', clue: p.clue || '{n} picked this guest for “{text}”' };
  if (p.type === 'vote') return { who: p.who || 'The group has voted! {text}?', clue: p.clue || 'The group’s pick for “{text}”' };
  if (p.type === 'choice') return { what: p.what || '“{text}” What did {n} answer?' };
  return {
    who: p.who || 'Who answered “{a}” to “{text}”?',
    what: p.what || 'What did {n} answer to “{text}”?',
    clue: p.clue || 'This guest answered “{a}” to “{text}”',
  };
}

// Every possible personal question from the current answers.
function buildPool(state) {
  const players = Object.values(state.players);
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const names = (exclude, n = 3, prefer = []) => {
    const ex = new Set(exclude);
    const pref = prefer.filter((id) => !ex.has(id) && byId[id]);
    const rest = shuffle(players.filter((p) => !ex.has(p.id) && !pref.includes(p.id)).map((p) => p.id));
    return [...pref, ...rest].slice(0, n).map((id) => byId[id].name);
  };
  const items = [];
  for (const prompt of state.questionnaire || []) {
    const t = promptTemplates(prompt);
    const type = prompt.type || 'text';
    const raw = players.map((p) => ({ p, v: (p.answers || {})[prompt.id] })).filter((x) => x.v);

    if (type === 'pick') {
      // "Who is Priya's other half?" — answer is the guest they picked.
      const seenPairs = new Set();
      for (const x of raw) {
        const y = byId[x.v];
        if (!y || y.id === x.p.id || players.length < 3) continue;
        const pair = [x.p.id, y.id].sort().join('|');
        if (prompt.id === 'partner' && seenPairs.has(pair)) continue; // couples answer for each other
        seenPairs.add(pair);
        const opts = shuffle([y.name, ...names([x.p.id, y.id])]);
        items.push({ kind: 'who', personal: true, promptId: prompt.id, tag: prompt.tag || 'group', about: x.p.id, aboutName: x.p.name, answerName: y.name, involves: [x.p.id, y.id],
          q: fill(t.who, { n: x.p.name, text: prompt.text }), options: opts, answer: opts.indexOf(y.name), clueText: fill(t.clue, { n: x.p.name, text: prompt.text }) });
      }
      continue;
    }
    if (type === 'vote') {
      // Group superlative — needs 3+ votes and a clear winner.
      const tally = {};
      raw.forEach((x) => { if (byId[x.v]) tally[x.v] = (tally[x.v] || 0) + 1; });
      const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
      const votes = ranked.reduce((n, [, c]) => n + c, 0);
      if (votes < 3 || !ranked.length || (ranked[1] && ranked[1][1] === ranked[0][1])) continue;
      const winner = byId[ranked[0][0]];
      const opts = shuffle([winner.name, ...names([winner.id], 3, ranked.slice(1).map(([id]) => id))]);
      items.push({ kind: 'who', personal: true, vote: true, promptId: prompt.id, tag: prompt.tag || 'group', about: winner.id, aboutName: winner.name, involves: [winner.id],
        q: fill(t.who, { text: prompt.text }), options: opts, answer: opts.indexOf(winner.name), clueText: fill(t.clue, { text: prompt.text }), votes: ranked[0][1] });
      continue;
    }
    if (type === 'choice') {
      const opts = prompt.options || [];
      for (const x of raw) {
        const ai = opts.indexOf(x.v);
        if (ai < 0 || opts.length < 2) continue;
        items.push({ kind: 'what', personal: true, promptId: prompt.id, tag: prompt.tag || 'fun', about: x.p.id, aboutName: x.p.name, involves: [x.p.id],
          q: fill(t.what, { n: x.p.name, text: prompt.text }), options: [...opts], answer: ai });
      }
      continue;
    }

    const answers = raw.map((x) => ({ p: x.p, a: cleanAnswer(x.v) })).filter((x) => x.a);
    if (!answers.length) continue;
    const counts = {};
    answers.forEach((x) => { counts[norm(x.a)] = (counts[norm(x.a)] || 0) + 1; });
    for (const x of answers) {
      const base = { about: x.p.id, aboutName: x.p.name, involves: [x.p.id], promptId: prompt.id, tag: prompt.tag || 'fun', answerText: x.a, personal: true };
      // "Whose favourite movie is X?" — needs a unique answer and at least one other guest.
      if (counts[norm(x.a)] === 1 && players.length >= 2) {
        const opts = shuffle([x.p.name, ...names([x.p.id])]);
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

const toMCQ = (it, extra = {}) => ({ q: it.q, options: it.options, answer: it.answer, personal: true, about: it.about, involves: it.involves, ...extra });
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
  const preferTags = /movie|film|bollywood/i.test(game.title) ? ['movie'] : /song|music|dance|hook|garba/i.test(game.title) ? ['music', 'garba'] : [];
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
      cats[c] = { name: '✨ Know Your Guests', personal: true, clues: items.map((it, i) => ({ value: values[i], q: it.clueText, a: it.answerName || it.aboutName, personal: true, about: it.about, involves: it.involves })) };
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
    const dance = shuffle(pool.filter((i) => ['dance', 'garbaSong'].includes(i.promptId) && i.kind !== 'what'));
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
  return { total: pool.length, sample: pick(pool, n).map((i) => ({ q: i.q, options: i.options, answer: i.answer, about: i.involves && i.involves.length > 1 ? i.involves.map((id) => (state.players[id] || {}).name).join(' & ') : i.aboutName })) };
}

module.exports = { DEFAULT_PROMPTS, V1_IDS, personalize, preview, cleanAnswer, buildPool };
