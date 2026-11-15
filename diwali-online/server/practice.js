// Practice questions: super easy, and completely different from the real set, so a practice
// run (with bots or with guests) never spoils the actual party questions.

const q = (text, options, answer, extra = {}) => ({ q: text, options, answer, time: 20, ...extra });

const movies = {
  questions: [
    q('Guess the movie!', ['The Lion King', 'Frozen', 'Cars', 'Up'], 0, { clue: '🦁 👑 🌅' }),
    q('Guess the movie!', ['Jaws', 'Titanic', 'Avatar', 'Shrek'], 1, { clue: '🚢 🧊 💔' }),
    q('Guess the movie!', ['Batman', 'Superman', 'Spider-Man', 'Iron Man'], 2, { clue: '🕷️ 🧑 🏙️' }),
    q('Guess the movie!', ['Toy Story', 'Finding Nemo', 'Moana', 'Coco'], 1, { clue: '🐠 🔍 🌊' }),
    q('Guess the movie!', ['Frozen', 'Tangled', 'Brave', 'Mulan'], 0, { clue: '❄️ 👸 ⛄' }),
    q('Guess the movie!', ['Star Wars', 'Harry Potter', 'Jurassic Park', 'Shrek'], 1, { clue: '🧙‍♂️ ⚡ 👓' }),
  ],
};

const general = {
  questions: [
    q('What is 2 + 2?', ['3', '4', '5', '22'], 1),
    q('What colour is the sky on a sunny day?', ['Green', 'Purple', 'Blue', 'Orange'], 2),
    q('How many days are in a week?', ['5', '7', '10', '12'], 1),
    q('Which animal says "moo"?', ['Cat', 'Dog', 'Cow', 'Duck'], 2),
    q('What do bees make?', ['Honey', 'Milk', 'Bread', 'Juice'], 0),
    q('Which of these is a fruit?', ['Carrot', 'Apple', 'Potato', 'Onion'], 1),
  ],
};

const jeopardy = {
  wrongPenalty: false,
  categories: [
    { name: 'Colours', clues: [
      { value: 100, q: 'The colour of a ripe banana', a: 'Yellow' },
      { value: 200, q: 'The colour of fresh grass', a: 'Green' },
      { value: 300, q: 'Mix red and white to get this colour', a: 'Pink' },
    ] },
    { name: 'Animals', clues: [
      { value: 100, q: 'This pet barks', a: 'Dog' },
      { value: 200, q: 'The animal with a long trunk', a: 'Elephant' },
      { value: 300, q: 'Called the king of the jungle', a: 'Lion' },
    ] },
    { name: 'Numbers', clues: [
      { value: 100, q: 'Legs on a dog', a: '4' },
      { value: 200, q: 'Fingers on one hand', a: '5' },
      { value: 300, q: '10 + 10', a: '20' },
    ] },
  ],
};

const kbc = {
  ladder: [
    { points: 100, questions: [q('Which of these is a colour?', ['Blue', 'Chair', 'Spoon', 'Shoe'], 0), q('Which of these can you drink?', ['Rock', 'Water', 'Paper', 'Sand'], 1)] },
    { points: 200, questions: [q('How many wheels does a bicycle have?', ['1', '2', '3', '4'], 1), q('Which animal can fly?', ['Fish', 'Bird', 'Cow', 'Snail'], 1)] },
    { points: 500, safe: true, questions: [q('What is frozen water called?', ['Steam', 'Ice', 'Sand', 'Glass'], 1), q('Which day comes after Monday?', ['Sunday', 'Friday', 'Tuesday', 'Saturday'], 2)] },
    { points: 1000, questions: [q('How many hours are in a day?', ['12', '20', '24', '30'], 2), q('Which planet do we live on?', ['Mars', 'Earth', 'Jupiter', 'Venus'], 1)] },
  ],
  fastestFinger: [
    q('What is 1 + 1?', ['1', '2', '3', '11'], 1, { time: 15 }),
    q('Which of these is a fruit?', ['Banana', 'Brick', 'Pencil', 'Sock'], 0, { time: 15 }),
    q('What colour is snow?', ['Black', 'Red', 'White', 'Blue'], 2, { time: 15 }),
  ],
};

// Practice content for a game; Hook Step songs and custom games keep their own content.
function practiceContent(game) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  if (game.type === 'quiz') return clone(/movie|film|bollywood/i.test(game.title) ? movies : general);
  if (game.type === 'jeopardy') return clone(jeopardy);
  if (game.type === 'kbc') return clone(kbc);
  return clone(game.content);
}

// 1 Warm uses the easy stand-in set. 2–5 use the real questions and only change the clock.
const LEVELS = [
  null,
  { name: 'Warm', factor: 1.4, easy: true },
  { name: 'Gentle', factor: 1.25, easy: false },
  { name: 'Party', factor: 1, easy: false },
  { name: 'Tricky', factor: 0.8, easy: false },
  { name: 'Spicy', factor: 0.65, easy: false },
];

function scaleTimes(node, factor) {
  if (factor === 1 || !node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((x) => scaleTimes(x, factor)); return; }
  if (typeof node.time === 'number') node.time = Math.max(8, Math.round(node.time * factor));
  if (typeof node.performSeconds === 'number') node.performSeconds = Math.max(20, Math.min(60, Math.round(node.performSeconds * factor)));
  Object.values(node).forEach((v) => { if (v && typeof v === 'object') scaleTimes(v, factor); });
}

function applyDifficulty(game, level) {
  const n = Math.max(1, Math.min(5, Math.round(Number(level) || 3)));
  const L = LEVELS[n];
  const content = JSON.parse(JSON.stringify(L.easy ? practiceContent(game) : game.content));
  scaleTimes(content, L.factor);
  return { content, level: n, name: L.name };
}

module.exports = { practiceContent, applyDifficulty, LEVELS };
