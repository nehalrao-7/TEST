// Mini games: short rounds that need no question bank. Everything here is generated fresh
// for each room, and none of it depends on language, country or trivia knowledge.
//
// Each generator returns quiz-shaped content ({ questions: [...] }) so the quiz engine runs it.
// A question's `kind` tells the screens how to draw it:
//   spot  — a grid of look-alike emoji with one odd one out (options are the cells)
//   flash — a row of emoji shown briefly, then a question about it
//   poll  — a "this or that" with no right answer: the majority wins
//   (none) — an ordinary multiple-choice question (Number Crunch)

const crypto = require('crypto');
const S = require('./state');

const int = (lo, hi) => lo + crypto.randomInt(hi - lo + 1);
const pick = (list) => list[crypto.randomInt(list.length)];

const WINDOWS = { easy: [1, 2.5], medium: [2, 4], hard: [3.5, 5], ramp: [1, 5] };
// Difficulty (1–5) for each of n rounds, rising through the chosen window.
const tiers = (n, difficulty) => {
  const [lo, hi] = WINDOWS[difficulty] || WINDOWS.ramp;
  return Array.from({ length: n }, (_, i) => (n === 1 ? (lo + hi) / 2 : lo + ((hi - lo) * i) / (n - 1)));
};

// ---------------- Spot It ----------------
// [most of the grid, the odd one]. Harder pairs look more alike.
const SPOT = {
  easy: [['🐶', '🐱'], ['🍎', '🍋'], ['⚽', '🏀'], ['🌞', '🌙'], ['🚗', '🚲'], ['🐸', '🐧'], ['🍕', '🍩'], ['🌵', '🌻']],
  medium: [['🍎', '🍅'], ['🐯', '🦁'], ['🍋', '🍌'], ['🍓', '🍒'], ['🐭', '🐹'], ['🌲', '🌳'], ['🌷', '🌹'], ['🐻', '🐨'], ['🍪', '🥯'], ['🚕', '🚌']],
  hard: [['😀', '😃'], ['😄', '😁'], ['🙂', '😊'], ['🕐', '🕓'], ['🌖', '🌔'], ['🔒', '🔓'], ['😮', '😯'], ['🌕', '🌝'], ['🐵', '🙈'], ['📕', '📙']],
};
function spot(difficulty) {
  const used = new Set();
  return tiers(6, difficulty).map((t) => {
    const pool = t < 2.2 ? SPOT.easy : t < 3.8 ? SPOT.medium : SPOT.hard;
    let pair = pick(pool);
    for (let i = 0; i < 8 && used.has(pair[0]); i++) pair = pick(pool);
    used.add(pair[0]);
    const [base, odd] = crypto.randomInt(2) ? pair : [pair[1], pair[0]];
    const cols = Math.max(3, Math.min(6, Math.round(2.4 + t * 0.72)));
    const answer = crypto.randomInt(cols * cols);
    const options = Array.from({ length: cols * cols }, (_, i) => (i === answer ? odd : base));
    return { kind: 'spot', q: 'Find the odd one out', options, answer, cols, time: 15 };
  });
}

// ---------------- Memory Flash ----------------
const THINGS = ['🍎', '🚗', '🐶', '⭐', '🎈', '🌙', '⚽', '🎸', '🍕', '🌵', '🔑', '🐟', '🚀', '🌈', '🍩', '🎩', '🐢', '🔔', '🍉', '🦋', '☂️', '🧲', '🥁', '🪁'];
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
function flash(difficulty) {
  return tiers(6, difficulty).map((t) => {
    const n = Math.max(4, Math.min(8, Math.round(3 + t)));
    const all = S.shuffle(THINGS);
    const shown = all.slice(0, n);
    const hidden = all.slice(n);
    const kind = pick(['missing', 'after', 'place']);
    let q, right, wrong;
    if (kind === 'missing') {
      q = 'Which one was NOT there?';
      right = hidden[0];
      wrong = S.shuffle(shown).slice(0, 3);
    } else if (kind === 'after') {
      const i = int(0, n - 2);
      q = `Which came right after ${shown[i]}?`;
      right = shown[i + 1];
      wrong = [...S.shuffle(shown.filter((_, k) => k !== i && k !== i + 1)), ...hidden].slice(0, 3);
    } else {
      const i = int(0, n - 1);
      q = `Which one was ${i === n - 1 ? 'last' : ORDINAL[i]}?`;
      right = shown[i];
      wrong = S.shuffle(shown.filter((_, k) => k !== i)).slice(0, 3);
    }
    const options = S.shuffle([right, ...wrong]);
    return { kind: 'flash', q, options, answer: options.indexOf(right), flash: shown, flashMs: 700 * n + 900, time: 10 };
  });
}

// ---------------- Number Crunch ----------------
function sum(t) {
  if (t < 1.8) { const a = int(6, 19), b = int(3, 9); return [`${a} + ${b}`, a + b]; }
  if (t < 2.6) {
    if (crypto.randomInt(2)) { const a = int(21, 79), b = int(12, 19); return [`${a} + ${b}`, a + b]; }
    const b = int(6, 19), a = b + int(7, 40); return [`${a} − ${b}`, a - b];
  }
  if (t < 3.4) {
    if (crypto.randomInt(2)) { const a = int(3, 12), b = int(4, 9); return [`${a} × ${b}`, a * b]; }
    const b = int(3, 9), ans = int(4, 12); return [`${b * ans} ÷ ${b}`, ans];
  }
  if (t < 4.3) {
    if (crypto.randomInt(2)) { const a = int(4, 9), b = int(6, 12), c = int(5, 19); return [`${a} × ${b} + ${c}`, a * b + c]; }
    const a = int(40, 90), b = int(11, 29), c = int(6, 19); return [`${a} − ${b} + ${c}`, a - b + c];
  }
  const kind = crypto.randomInt(3);
  if (kind === 0) { const a = int(12, 19), b = int(6, 9); return [`${a} × ${b}`, a * b]; }
  if (kind === 1) { const pct = pick([10, 20, 25, 50, 75]), base = pick([40, 80, 120, 160, 200, 240]); return [`${pct}% of ${base}`, (pct * base) / 100]; }
  const a = int(11, 15); return [`${a} × ${a}`, a * a];
}
function math(difficulty) {
  return tiers(8, difficulty).map((t) => {
    const [expr, ans] = sum(t);
    const wrong = new Set();
    const nudges = S.shuffle([-10, -3, -2, -1, 1, 2, 3, 10, ans > 30 ? 9 : 4, ans > 30 ? -11 : -4]);
    for (const d of nudges) { if (wrong.size >= 3) break; if (ans + d >= 0 && ans + d !== ans) wrong.add(ans + d); }
    const options = S.shuffle([ans, ...wrong]).map(String);
    return { clue: `${expr} = ?`, q: 'Quick — what’s the answer?', options, answer: options.indexOf(String(ans)), time: 12 };
  });
}

// ---------------- Hive Mind ----------------
// No right answers, and nothing that depends on where you live.
const POLLS = [
  ['Which would you rather have right now?', '🍕 Pizza', '🍔 Burger'],
  ['Pick a holiday', '🏖️ Beach', '⛰️ Mountains'],
  ['You are a…', '🌅 Morning person', '🦉 Night owl'],
  ['Team…', '🐶 Dogs', '🐱 Cats'],
  ['Snack time', '🍫 Sweet', '🧂 Salty'],
  ['Morning fuel', '☕ Coffee', '🍵 Tea'],
  ['Getting in touch', '💬 Text', '📞 Call'],
  ['Better season', '☀️ Summer', '❄️ Winter'],
  ['On a plane', '🪟 Window seat', '🚶 Aisle seat'],
  ['Tonight’s dinner', '🍳 Cook at home', '🍽️ Eat out'],
  ['The story is better as a…', '📖 Book', '🎬 Film'],
  ['Better view', '🌄 Sunrise', '🌇 Sunset'],
  ['Superpower', '🕊️ Flying', '🫥 Invisibility'],
  ['Time machine', '⏪ The past', '⏩ The future'],
  ['Perfect weekend', '🛋️ Stay in', '🎉 Go out'],
  ['Music at a party', '🎤 Sing along', '💃 Dance'],
  ['Dessert', '🍦 Ice cream', '🍰 Cake'],
  ['Getting there', '🚆 Train', '✈️ Plane'],
  ['Ideal pet', '🐠 Low effort', '🐕 Best friend'],
  ['You arrive…', '⏰ Early', '🏃 Just in time'],
  ['Pick a home', '🏙️ Big city', '🌳 Countryside'],
  ['Breakfast', '🥞 Sweet', '🍳 Savoury'],
  ['Movie night', '😂 Comedy', '😱 Thriller'],
  ['Rainy day', '🎮 Games', '😴 Nap'],
  ['Better sense', '🎧 Music all day', '🖼️ Art all day'],
  ['On your toast', '🧈 Butter', '🍓 Jam'],
  ['Phone at', '🔋 100% but no signal', '📶 Full signal at 5%'],
  ['Pick one forever', '🍝 Pasta', '🍚 Rice'],
  ['At the fair', '🎢 Rollercoaster', '🎡 Ferris wheel'],
  ['Working style', '📋 Plan it all', '🎲 Wing it'],
  ['Hot drink weather or…', '🧣 Cosy cold day', '😎 Hot sunny day'],
  ['Which would you give up?', '📺 TV shows', '🎵 Music'],
  ['Photos', '🤳 In front of the camera', '📷 Behind the camera'],
  ['Board game night', '🤝 Co-operative', '⚔️ Cut-throat'],
  ['Ideal seat at the cinema', '⬆️ Back row', '🎯 Dead centre'],
  ['Which is worse?', '🥶 Too cold', '🥵 Too hot'],
  ['Pick a pet', '🦜 Talking parrot', '🐒 Helpful monkey'],
  ['Bedtime', '📚 Read', '📱 Scroll'],
  ['Fries go with', '🍅 Ketchup', '🥛 Mayo'],
  ['Travelling', '🎒 Pack light', '🧳 Pack everything'],
];
function poll() {
  return S.shuffle(POLLS).slice(0, 7).map(([q, a, b]) => ({ kind: 'poll', q, options: [a, b], time: 12 }));
}

const GENERATORS = { spot, flash, math, poll };
function generate(gen, difficulty = 'ramp') {
  const fn = GENERATORS[gen];
  return fn ? { questions: fn(difficulty) } : null;
}

module.exports = { generate, GENERATORS };
