// Tagged question bank for Party Pack.
// Every question has: topic tags (matched to players' interests), an age fit
// ('all', 'grown' for 30+ nostalgia, 'young' for under-30 culture) and a difficulty d (1 easy – 3 hard).
// Each question has exactly one defensible answer among its options.

const Q = (q, options, answer, tags, age, d, extra = {}) => ({ q, options, answer, tags, age, d, ...extra });
const M = (clue, options, answer, tags, age, d) => Q('Guess the movie!', options, answer, ['movies', ...tags], age, d, { clue });

const TOPICS = [
  { id: 'movies', label: 'Movies & TV', emoji: '🎬' },
  { id: 'music', label: 'Music', emoji: '🎶' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'food', label: 'Food & drink', emoji: '🍕' },
  { id: 'science', label: 'Science & nature', emoji: '🔬' },
  { id: 'world', label: 'Places & history', emoji: '🌍' },
  { id: 'games', label: 'Games & internet', emoji: '🎮' },
];

const movie = [
  M('🦁 👑 🌅', ['The Lion King', 'Madagascar', 'The Jungle Book', 'Tarzan'], 0, [], 'all', 1),
  M('🚢 🧊 💔', ['Poseidon', 'Titanic', 'Life of Pi', 'Waterworld'], 1, [], 'all', 1),
  M('🧸 🤠 🚀', ['Cars', 'Monsters, Inc.', 'Toy Story', 'Up'], 2, [], 'all', 1),
  M('🦖 🏝️ 🧬', ['King Kong', 'Godzilla', 'Avatar', 'Jurassic Park'], 3, [], 'all', 1),
  M('❄️ 👸 👭 ⛄', ['Frozen', 'Tangled', 'Brave', 'Moana'], 0, [], 'all', 1),
  M('🎈 🏠 👴 👦', ['Coco', 'Up', 'Inside Out', 'Soul'], 1, [], 'all', 1),
  M('🐠 🔍 🌊', ['Shark Tale', 'The Little Mermaid', 'Finding Nemo', 'Moana'], 2, [], 'all', 1),
  M('🕷️ 🧑 🏙️', ['Ant-Man', 'Venom', 'Spider-Man', 'Batman Begins'], 2, [], 'all', 1),
  M('🐀 👨‍🍳 🇫🇷', ['Flushed Away', 'Ratatouille', 'Chef', 'Julie & Julia'], 1, ['food'], 'all', 1),
  M('👦 🏠 🎄 🪤', ['Elf', 'The Grinch', 'Home Alone', 'Jingle All the Way'], 2, [], 'all', 1),
  M('🐼 🥋 🥟', ['Kung Fu Panda', 'Mulan', 'The Karate Kid', 'Big Hero 6'], 0, [], 'all', 1),
  M('🟩 👹 👸 🫏', ['Shrek', 'Hotel Transylvania', 'Monsters, Inc.', 'Trolls'], 0, [], 'all', 1),
  M('🏰 🥀 🫖 🕯️', ['Cinderella', 'Beauty and the Beast', 'Sleeping Beauty', 'Tangled'], 1, [], 'all', 1),
  M('🍫 🏭 🎫', ['Matilda', 'Chocolat', 'Charlie and the Chocolate Factory', 'Paddington'], 2, ['food'], 'all', 1),
  M('🏎️ ⚡ 🏆', ['Turbo', 'Planes', 'Speed Racer', 'Cars'], 3, ['sports'], 'all', 1),
  M('🧙‍♂️ 💍 🌋', ['The Lord of the Rings', 'Harry Potter', 'Willow', 'Merlin'], 0, [], 'all', 2),
  M('🤖 🌱 🗑️', ['Big Hero 6', 'Robots', 'The Iron Giant', 'WALL-E'], 3, ['science'], 'all', 2),
  M('🧠 😢 😡 😄', ['Inside Out', 'Soul', 'Encanto', 'Turning Red'], 0, [], 'all', 2),
  M('💊 🕶️ 🐇', ['Inception', 'Tron', 'The Matrix', 'Total Recall'], 2, [], 'all', 2),
  M('👠 📰 ☕ 😈', ['Legally Blonde', 'The Devil Wears Prada', 'Mean Girls', 'Clueless'], 1, [], 'all', 2),
  M('🏃 🍫 🦐 🪶', ['Big', 'Cast Away', 'Forrest Gump', 'The Terminal'], 2, [], 'all', 2),
  M('🏐 🏝️ 📦', ['Cast Away', 'Life of Pi', 'The Beach', 'Moana'], 0, [], 'all', 2),
  M('🎤 🐨 🐷 🦍', ['Zootopia', 'Sing', 'Madagascar', 'The Secret Life of Pets'], 1, ['music'], 'young', 2),
  M('🥔 🧑‍🚀 🔴', ['Gravity', 'Apollo 13', 'Interstellar', 'The Martian'], 3, ['science'], 'all', 2),
  M('🎹 👑 🎤 🏟️', ['Rocketman', 'Bohemian Rhapsody', 'Elvis', 'A Star Is Born'], 1, ['music'], 'all', 2),
  M('👸 🐸 🎺 🍲', ['The Princess and the Frog', 'Enchanted', 'Shrek', 'Tangled'], 0, [], 'all', 2),
  M('🦍 🏢 ✈️', ['Planet of the Apes', 'Godzilla', 'King Kong', 'Mighty Joe Young'], 2, [], 'grown', 2),
  M('⏰ 🚗 ⚡ 🔙', ['Cars', 'Back to the Future', 'The Terminator', 'Timecop'], 1, [], 'grown', 2),
  M('👻 🚫 📞', ['Casper', 'Beetlejuice', 'Poltergeist', 'Ghostbusters'], 3, [], 'grown', 2),
  M('🌀 💤 🏙️ 🔝', ['Interstellar', 'Tenet', 'Memento', 'Inception'], 3, [], 'all', 3),
  M('🧑‍🚀 🌽 🕳️ ⏳', ['Gravity', 'The Martian', 'Interstellar', 'Ad Astra'], 2, ['science'], 'all', 3),
  M('💃 🎹 🌌 🌴', ['La La Land', 'Chicago', 'Whiplash', 'The Greatest Showman'], 0, ['music'], 'all', 3),
  M('🦸 💎 🧤 🫰', ['Thor', 'Avengers: Infinity War', 'Guardians of the Galaxy', 'Doctor Strange'], 1, [], 'all', 3),
  M('🦈 🏖️ 🚤', ['Piranha', 'Deep Blue Sea', 'The Shallows', 'Jaws'], 3, [], 'grown', 1),
  M('👽 🚲 🌕', ['Close Encounters of the Third Kind', 'E.T. the Extra-Terrestrial', 'Super 8', 'Men in Black'], 1, [], 'grown', 1),
];

const quiz = [
  Q('How many legs does a spider have?', ['6', '8', '10', '12'], 1, ['science'], 'all', 1),
  Q('Which planet is known as the Red Planet?', ['Venus', 'Jupiter', 'Mars', 'Mercury'], 2, ['science'], 'all', 1),
  Q('What is the largest ocean on Earth?', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3, ['world'], 'all', 1),
  Q('Mixing blue and yellow paint makes…', ['Green', 'Purple', 'Orange', 'Brown'], 0, ['science'], 'all', 1),
  Q('How long is a soccer match, not counting stoppage time?', ['80 minutes', '90 minutes', '100 minutes', '120 minutes'], 1, ['sports'], 'all', 1),
  Q('Which fruit wears its seeds on the outside?', ['Kiwi', 'Fig', 'Strawberry', 'Blueberry'], 2, ['food'], 'all', 1),
  Q('Mario’s brother is…', ['Wario', 'Toad', 'Yoshi', 'Luigi'], 3, ['games'], 'all', 1),
  Q('What is the tallest animal in the world?', ['Giraffe', 'Elephant', 'Ostrich', 'Moose'], 0, ['science'], 'all', 1),
  Q('How many players per team are on a basketball court?', ['4', '5', '6', '7'], 1, ['sports'], 'all', 1),
  Q('What gas do plants take in from the air?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], 2, ['science'], 'all', 1),
  Q('Guacamole is mostly made from…', ['Peas', 'Lime', 'Cucumber', 'Avocado'], 3, ['food'], 'all', 1),
  Q('In Minecraft, the green mob that explodes is the…', ['Creeper', 'Zombie', 'Enderman', 'Slime'], 0, ['games'], 'young', 1),
  Q('Who painted the Mona Lisa?', ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Vincent van Gogh'], 1, ['world'], 'all', 1),
  Q('How many sides does a hexagon have?', ['5', '7', '6', '8'], 2, ['science'], 'all', 1),
  Q('Ash Ketchum’s best Pokémon buddy is…', ['Charmander', 'Squirtle', 'Eevee', 'Pikachu'], 3, ['games'], 'all', 1),
  Q('Who released the album “Thriller”?', ['Michael Jackson', 'Prince', 'Stevie Wonder', 'Lionel Richie'], 0, ['music'], 'all', 1),
  Q('How many rings are on the Olympic flag?', ['4', '5', '6', '7'], 1, ['sports'], 'all', 1),
  Q('What is the fastest land animal?', ['Lion', 'Greyhound', 'Cheetah', 'Horse'], 2, ['science'], 'all', 1),
  Q('How many strings does a standard guitar have?', ['4', '5', '7', '6'], 3, ['music'], 'all', 1),
  Q('Machu Picchu is in which country?', ['Peru', 'Mexico', 'Chile', 'Bolivia'], 0, ['world'], 'all', 2),
  Q('What is the capital of Australia?', ['Sydney', 'Canberra', 'Melbourne', 'Perth'], 1, ['world'], 'all', 2),
  Q('What is the hardest natural substance?', ['Gold', 'Iron', 'Diamond', 'Quartz'], 2, ['science'], 'all', 2),
  Q('Which country gave the Statue of Liberty to the USA?', ['Britain', 'Spain', 'Italy', 'France'], 3, ['world'], 'all', 2),
  Q('Which band sang “Hey Jude”?', ['The Beatles', 'The Rolling Stones', 'Queen', 'The Beach Boys'], 0, ['music'], 'all', 2),
  Q('What is the smallest planet in our solar system?', ['Mars', 'Mercury', 'Venus', 'Neptune'], 1, ['science'], 'all', 2),
  Q('In which sport does “love” mean zero?', ['Golf', 'Bowling', 'Tennis', 'Volleyball'], 2, ['sports'], 'all', 2),
  Q('Hummus is mostly made from…', ['Lentils', 'Black beans', 'Peas', 'Chickpeas'], 3, ['food'], 'all', 2),
  Q('Master Chief is the hero of which video game series?', ['Halo', 'Call of Duty', 'Destiny', 'Gears of War'], 0, ['games'], 'all', 2),
  Q('What is the longest river in South America?', ['Orinoco', 'Amazon', 'Paraná', 'Magdalena'], 1, ['world'], 'all', 2),
  Q('Marzipan is made from which nut?', ['Cashew', 'Walnut', 'Almond', 'Hazelnut'], 2, ['food'], 'all', 2),
  Q('A baby kangaroo is called a…', ['Kit', 'Cub', 'Pup', 'Joey'], 3, ['science'], 'all', 2),
  Q('Which artist released the album “1989”?', ['Taylor Swift', 'Katy Perry', 'Adele', 'Lady Gaga'], 0, ['music'], 'young', 2),
  Q('Paella comes from which country?', ['Mexico', 'Spain', 'Portugal', 'Italy'], 1, ['food'], 'all', 2),
  Q('In chess, which piece only moves diagonally?', ['Rook', 'Knight', 'Bishop', 'King'], 2, ['games'], 'all', 2),
  Q('The Bermuda Triangle is in which ocean?', ['Pacific', 'Indian', 'Arctic', 'Atlantic'], 3, ['world'], 'all', 2),
  Q('How many hearts does an octopus have?', ['3', '1', '2', '4'], 0, ['science'], 'all', 3),
  Q('How many bones are in an adult human body?', ['186', '206', '226', '256'], 1, ['science'], 'all', 3),
  Q('Since 2023, which country has the most people?', ['China', 'USA', 'India', 'Indonesia'], 2, ['world'], 'all', 3),
  Q('Which planet spins on its side?', ['Neptune', 'Venus', 'Mars', 'Uranus'], 3, ['science'], 'all', 3),
  Q('Which metal is liquid at room temperature?', ['Mercury', 'Lead', 'Tin', 'Aluminium'], 0, ['science'], 'all', 3),
];

const kbc = [
  Q('What do bees make?', ['Milk', 'Honey', 'Silk', 'Butter'], 1, ['science'], 'all', 1),
  Q('How many days are in a leap year?', ['364', '365', '366', '367'], 2, ['science'], 'all', 1),
  Q('Which animal is called the “King of the Jungle”?', ['Tiger', 'Lion', 'Elephant', 'Gorilla'], 1, ['science'], 'all', 1),
  Q('What is the capital of Canada?', ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'], 2, ['world'], 'all', 1),
  Q('Which organ pumps blood around your body?', ['Lungs', 'Liver', 'Kidneys', 'Heart'], 3, ['science'], 'all', 1),
  Q('How many players does a soccer team have on the field?', ['11', '9', '10', '12'], 0, ['sports'], 'all', 1),
  Q('Which country is home to the kangaroo?', ['New Zealand', 'South Africa', 'Australia', 'Brazil'], 2, ['world'], 'all', 1),
  Q('“Bohemian Rhapsody” was a hit for…', ['Queen', 'ABBA', 'The Who', 'Led Zeppelin'], 0, ['music'], 'all', 2),
  Q('In what year did people first walk on the Moon?', ['1965', '1969', '1972', '1975'], 1, ['science', 'world'], 'all', 2),
  Q('What is the largest planet in our solar system?', ['Saturn', 'Neptune', 'Jupiter', 'Earth'], 2, ['science'], 'all', 2),
  Q('Who wrote “Romeo and Juliet”?', ['Charles Dickens', 'Jane Austen', 'Mark Twain', 'William Shakespeare'], 3, ['world'], 'all', 2),
  Q('What is the largest mammal?', ['Blue whale', 'Elephant', 'Giraffe', 'Hippo'], 0, ['science'], 'all', 2),
  Q('Water freezes at what temperature in Fahrenheit?', ['0°F', '32°F', '100°F', '212°F'], 1, ['science'], 'all', 2),
  Q('What is the currency of Japan?', ['Yuan', 'Won', 'Yen', 'Ringgit'], 2, ['world'], 'all', 2),
  Q('Who came up with the theory of relativity?', ['Isaac Newton', 'Galileo', 'Stephen Hawking', 'Albert Einstein'], 3, ['science'], 'all', 2),
  Q('Which painter famously cut off part of his own ear?', ['Vincent van Gogh', 'Pablo Picasso', 'Claude Monet', 'Salvador Dalí'], 0, ['world'], 'all', 2),
  Q('What is the chemical symbol for gold?', ['Go', 'Au', 'Ag', 'Gd'], 1, ['science'], 'all', 2),
  Q('Which country has won the most FIFA men’s World Cups?', ['Germany', 'Italy', 'Brazil', 'Argentina'], 2, ['sports'], 'all', 2),
  Q('Which language has the most native speakers?', ['English', 'Spanish', 'Hindi', 'Mandarin Chinese'], 3, ['world'], 'all', 3),
  Q('Which blood type is the universal donor?', ['O negative', 'AB positive', 'A positive', 'B negative'], 0, ['science'], 'all', 3),
  Q('What is the capital of Turkey?', ['Istanbul', 'Ankara', 'Izmir', 'Antalya'], 1, ['world'], 'all', 3),
  Q('What is the second-tallest mountain on Earth?', ['Kangchenjunga', 'Lhotse', 'K2', 'Makalu'], 2, ['world'], 'all', 3),
  Q('What is a perfect score in ten-pin bowling?', ['200', '250', '360', '300'], 3, ['sports'], 'all', 3),
  Q('Light travels about how far in one second?', ['300,000 km', '30,000 km', '3,000 km', '3,000,000 km'], 0, ['science'], 'all', 3),
];

// Category Clash: five clues per category, easiest first.
const C = (q, options, answer) => ({ q, options, answer, a: options[answer] });
const jeopardy = [
  { name: 'Animal Kingdom', tags: ['science'], age: 'all', clues: [
    C('A group of lions is called a…', ['Pack', 'Herd', 'Pride', 'Flock'], 2),
    C('An animal that eats only plants', ['Herbivore', 'Carnivore', 'Omnivore', 'Insectivore'], 0),
    C('The only mammal that can truly fly', ['Flying squirrel', 'Bat', 'Sugar glider', 'Flying fish'], 1),
    C('The fastest-running bird', ['Emu', 'Roadrunner', 'Penguin', 'Ostrich'], 3),
    C('Its skin is black under its white fur', ['Arctic fox', 'Snowy owl', 'Polar bear', 'Beluga'], 2),
  ] },
  { name: 'Name That Hit', tags: ['music'], age: 'all', clues: [
    C('Adele’s song that opens with “Hello, it’s me”', ['Skyfall', 'Hello', 'Someone Like You', 'Rolling in the Deep'], 1),
    C('Ed Sheeran sang about the shape of…', ['You', 'Love', 'Me', 'Us'], 0),
    C('The Weeknd’s “Blinding ___”', ['Love', 'Stars', 'Eyes', 'Lights'], 3),
    C('The K-pop group behind “Dynamite”', ['BLACKPINK', 'EXO', 'BTS', 'TWICE'], 2),
    C('Dua Lipa’s 2020 album “Future ___”', ['Memories', 'Nostalgia', 'Love', 'Lights'], 1),
  ] },
  { name: 'Passport Please', tags: ['world'], age: 'all', clues: [
    C('The Colosseum is in this city', ['Athens', 'Istanbul', 'Rome', 'Madrid'], 2),
    C('Big Ben is in this city', ['London', 'Paris', 'Dublin', 'Edinburgh'], 0),
    C('The Taj Mahal is in this country', ['Pakistan', 'Nepal', 'Bangladesh', 'India'], 3),
    C('The world’s smallest country', ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'], 1),
    C('Mount Kilimanjaro is in this country', ['Kenya', 'Uganda', 'Tanzania', 'Ethiopia'], 2),
  ] },
  { name: 'Snack Attack', tags: ['food'], age: 'all', clues: [
    C('Fries with gravy and cheese curds', ['Nachos', 'Poutine', 'Chili fries', 'Loaded fries'], 1),
    C('The green leaf at the heart of pesto', ['Basil', 'Spinach', 'Parsley', 'Mint'], 0),
    C('Tofu is made from these', ['Rice', 'Chickpeas', 'Wheat', 'Soybeans'], 3),
    C('Tiramisu comes from this country', ['France', 'Spain', 'Italy', 'Austria'], 2),
    C('The spice that turns curry yellow', ['Saffron', 'Turmeric', 'Cumin', 'Paprika'], 1),
  ] },
  { name: 'Game On', tags: ['games'], age: 'all', clues: [
    C('Sonic the Hedgehog is this colour', ['Red', 'Green', 'Blue', 'Yellow'], 2),
    C('The hero of The Legend of Zelda', ['Link', 'Zelda', 'Ganon', 'Navi'], 0),
    C('Pac-Man’s ghosts: Blinky, Pinky, Inky and…', ['Dinky', 'Spooky', 'Funky', 'Clyde'], 3),
    C('In Fortnite, dances are called…', ['Moves', 'Emotes', 'Grooves', 'Spins'], 1),
    C('The falling shapes in Tetris are called…', ['Quads', 'Pixels', 'Tetrominoes', 'Blocks'], 2),
  ] },
  { name: 'Sports Shorts', tags: ['sports'], age: 'all', clues: [
    C('This sport uses a shuttlecock', ['Squash', 'Badminton', 'Table tennis', 'Pickleball'], 1),
    C('Points for a touchdown, before the extra point', ['3', '7', '6', '2'], 2),
    C('Golf: one stroke under par', ['Birdie', 'Eagle', 'Bogey', 'Albatross'], 0),
    C('Holes on a standard full golf course', ['9', '27', '36', '18'], 3),
    C('The Grand Slam tennis tournament played on clay', ['Wimbledon', 'French Open', 'US Open', 'Australian Open'], 1),
  ] },
  { name: 'Screen Time', tags: ['movies'], age: 'all', clues: [
    C('Toy Story’s space ranger', ['Woody', 'Rex', 'Buzz Lightyear', 'Zurg'], 2),
    C('Frozen’s talking snowman', ['Sven', 'Olaf', 'Kristoff', 'Hans'], 1),
    C('Shrek’s wife', ['Fiona', 'Rapunzel', 'Belle', 'Elsa'], 0),
    C('The name of Thor’s original hammer', ['Stormbreaker', 'Gungnir', 'Excalibur', 'Mjolnir'], 3),
    C('First film to win the Best Animated Feature Oscar', ['Toy Story', 'Monsters, Inc.', 'Shrek', 'Ice Age'], 2),
  ] },
  { name: 'Lab Coats On', tags: ['science'], age: 'all', clues: [
    C('H₂O is better known as…', ['Salt', 'Water', 'Air', 'Sugar'], 1),
    C('The force that keeps your feet on the ground', ['Gravity', 'Magnetism', 'Friction', 'Inertia'], 0),
    C('The part of a plant that makes its food', ['Root', 'Stem', 'Flower', 'Leaf'], 3),
    C('The star closest to Earth', ['Sirius', 'Proxima Centauri', 'The Sun', 'Polaris'], 2),
    C('The element with the symbol Na', ['Sodium', 'Nitrogen', 'Neon', 'Nickel'], 0),
  ] },
];

// ---------- choosing questions for this room ----------

const AGE_BANDS = ['Under 13', '13–19', '20–29', '30–44', '45–59', '60+'];
const isGrown = (band) => AGE_BANDS.indexOf(band) >= 3;

// The room's taste: how many players picked each topic, and whether grown-up nostalgia fits.
function roomTaste(players) {
  const list = players.filter((p) => p.profile);
  const topics = {};
  TOPICS.forEach((t) => { topics[t.id] = 0; });
  list.forEach((p) => (p.profile.interests || []).forEach((t) => { if (t in topics) topics[t]++; }));
  const grown = list.filter((p) => isGrown(p.profile.age)).length;
  const young = list.length - grown;
  return { topics, n: list.length || 1, grownShare: list.length ? grown / list.length : 0.5, youngShare: list.length ? young / list.length : 0.5 };
}

function fit(item, taste) {
  // Age: 'grown' nostalgia only when most of the room is 30+, 'young' culture fades when nobody is under 30.
  if (item.age === 'grown' && taste.grownShare < 0.5) return 0;
  if (item.age === 'young' && taste.youngShare === 0) return 0.2;
  const interest = (item.tags || []).reduce((m, t) => Math.max(m, (taste.topics[t] || 0) / taste.n), 0);
  return 0.35 + interest; // everything stays possible; liked topics come up more
}

function weightedPick(items, k, taste, rand) {
  const pool = items.map((it) => ({ it, w: fit(it, taste) })).filter((x) => x.w > 0);
  const out = [];
  while (out.length < k && pool.length) {
    const total = pool.reduce((a, x) => a + x.w, 0);
    let r = rand() * total;
    let i = 0;
    while (i < pool.length - 1 && r >= pool[i].w) { r -= pool[i].w; i++; }
    out.push(pool.splice(i, 1)[0].it);
  }
  return out;
}

const strip = ({ tags, age, d, ...q }) => ({ ...q, time: 20 });
const byDifficulty = (a, b) => a.d - b.d;

// Builds the content for one game, tuned to the room. `rand` is injectable for tests.
function buildContent(type, players, rand = Math.random, sizes = {}) {
  const taste = roomTaste(players);
  if (type === 'movie') return { questions: weightedPick(movie, sizes.movie || 6, taste, rand).sort(byDifficulty).map(strip) };
  if (type === 'quiz') return { questions: weightedPick(quiz, sizes.quiz || 10, taste, rand).sort(byDifficulty).map(strip) };
  if (type === 'kbc') {
    const picked = weightedPick(kbc, sizes.kbc || 10, taste, rand).sort(byDifficulty);
    const ladder = [100, 150, 200, 250, 300, 400, 500, 600, 800, 1000];
    return { ladder: picked.map((q, i) => ({ points: ladder[Math.min(i, ladder.length - 1)], questions: [strip(q)] })) };
  }
  if (type === 'jeopardy') {
    const cats = weightedPick(jeopardy, sizes.cats || 4, taste, rand);
    const per = sizes.clues || 3;
    const idx = per >= 5 ? [0, 1, 2, 3, 4] : per === 4 ? [0, 1, 3, 4] : [0, 2, 4];
    return { categories: cats.map((c) => ({ name: c.name, clues: idx.map((ci, n) => ({ ...c.clues[ci], value: (n + 1) * 100 })) })) };
  }
  return null;
}

module.exports = { TOPICS, AGE_BANDS, movie, quiz, kbc, jeopardy, buildContent, roomTaste };
