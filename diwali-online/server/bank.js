// Tagged question bank for the self-running app.
// Every question has: topic tags (matched to players' interests), an age fit
// ('all', 'grown' for 30+ nostalgia, 'young' for under-30 culture) and a difficulty d (1 easy – 3 hard).
// Each question has exactly one defensible answer. No cricket, no Sikh references.

const Q = (q, options, answer, tags, age, d, extra = {}) => ({ q, options, answer, tags, age, d, ...extra });
const M = (clue, options, answer, tags, age, d) => Q('Guess the movie!', options, answer, ['bollywood', ...tags], age, d, { clue });

const TOPICS = [
  { id: 'bollywood', label: 'Bollywood movies', emoji: '🎬' },
  { id: 'mythology', label: 'Mythology & festivals', emoji: '🪔' },
  { id: 'gujarati', label: 'Gujarati culture', emoji: '🪁' },
  { id: 'music', label: 'Music & dance', emoji: '🎶' },
  { id: 'tvads', label: 'TV, ads & nostalgia', emoji: '📺' },
  { id: 'canada', label: 'Life in Canada', emoji: '🍁' },
  { id: 'food', label: 'Food', emoji: '🍛' },
];

const movie = [
  M('👨‍👩‍👦‍👦 🇬🇧 🚁 🏰', ['Kabhi Khushi Kabhie Gham', 'Hum Saath-Saath Hain', 'Kal Ho Naa Ho', 'Baghban'], 0, [], 'all', 1),
  M('🎓 🔧 💡 😂', ['Chhichhore', '3 Idiots', 'Munna Bhai M.B.B.S.', 'Student of the Year'], 1, [], 'all', 1),
  M('🚆 🙋‍♀️ 💔 🏔️', ['Chennai Express', 'Yeh Jawaani Hai Deewani', 'Jab We Met', 'Love Aaj Kal'], 2, [], 'all', 1),
  M('🏑 👩‍👩‍👧‍👧 🇮🇳 🏆', ['Dangal', 'Mary Kom', 'Gold', 'Chak De! India'], 3, [], 'all', 1),
  M('🤼‍♀️ 👨‍👧‍👧 🥇', ['Dangal', 'Sultan', 'Mary Kom', 'Gold'], 0, [], 'all', 1),
  M('🔥 💧 🤝 🏍️', ['Baahubali', 'RRR', 'KGF', 'Pushpa'], 1, [], 'young', 1),
  M('🗽 ❤️‍🩹 🩺 ⏳', ['Kabhi Alvida Naa Kehna', 'New York', 'Kal Ho Naa Ho', 'My Name Is Khan'], 2, [], 'all', 2),
  M('🪁 👬 👦 🏪', ['Chhichhore', 'Dil Chahta Hai', 'Rock On!!', 'Kai Po Che!'], 3, ['gujarati'], 'all', 2),
  M('🎨 🔤 🏫 ⭐', ['Taare Zameen Par', 'Stanley Ka Dabba', 'Iqbal', 'I Am Kalam'], 0, [], 'all', 2),
  M('👽 📻 👂 🙏', ['Robot', 'PK', 'Ra.One', 'Krrish'], 1, [], 'all', 2),
  M('🎤 🏙️ 🧢 🔥', ['Rock On!!', 'Rockstar', 'Gully Boy', 'Aashiqui 2'], 2, ['music'], 'young', 2),
  M('🤔 🗡️ 👑', ['Magadheera', 'RRR', 'KGF: Chapter 2', 'Baahubali 2'], 3, [], 'all', 2),
  M('🏰 👻 💃 🔒', ['Bhool Bhulaiyaa', 'Stree', 'Raaz', 'Tumbbad'], 0, [], 'all', 3),
  M('🎬 🔥 🔁 ⭐', ['Housefull', 'Om Shanti Om', 'Krrish', 'Bhool Bhulaiyaa'], 1, [], 'all', 3),
  M('🇬🇧 🚂 🌻 🇨🇭', ['Kuch Kuch Hota Hai', 'Pardes', 'Dilwale Dulhania Le Jayenge', 'Mohabbatein'], 2, [], 'grown', 1),
  M('🐶 💌 💍 🏡', ['Maine Pyar Kiya', 'Vivah', 'Hum Saath-Saath Hain', 'Hum Aapke Hain Koun..!'], 3, [], 'grown', 2),
  M('🐎 🪙 🔫 🏜️', ['Sholay', 'Deewaar', 'Don', 'Zanjeer'], 0, [], 'grown', 2),
];

const quiz = [
  Q('Diwali celebrates Ram’s return to…', ['Mathura', 'Ayodhya', 'Lanka', 'Dwarka'], 1, ['mythology'], 'all', 1),
  Q('Lord Ganesha’s vehicle is a…', ['Peacock', 'Bull', 'Mouse', 'Swan'], 2, ['mythology'], 'all', 1),
  Q('Which goddess is worshipped on Diwali night?', ['Saraswati', 'Lakshmi', 'Durga', 'Parvati'], 1, ['mythology'], 'all', 1),
  Q('How many nights does Navratri last?', ['7', '8', '9', '10'], 2, ['mythology', 'gujarati'], 'all', 1),
  Q('How many years was Ram in exile?', ['7', '12', '14', '16'], 2, ['mythology'], 'all', 1),
  Q('In Canada, the $2 coin is the…', ['Toonie', 'Loonie', 'Queenie', 'Beaver'], 0, ['canada'], 'all', 1),
  Q('CID: “Daya, ___ tod do!”', ['Darwaza', 'Taala', 'Khidki', 'Deewar'], 0, ['tvads'], 'all', 1),
  Q('“Main apni favourite hoon!” Which character says it?', ['Poo', 'Naina', 'Geet', 'Simran'], 2, ['bollywood'], 'all', 1),
  Q('“How’s the josh?” Which movie made it a catchphrase?', ['Shershaah', 'Border', 'Uri: The Surgical Strike', 'Lakshya'], 2, ['bollywood'], 'all', 1),
  Q('Chhota Bheem lives in…', ['Hastinapur', 'Champakpur', 'Dholakpur', 'Gokuldham'], 2, ['tvads'], 'young', 1),
  Q('In Taarak Mehta Ka Ooltah Chashmah, Jethalal’s wife is…', ['Babita', 'Anjali', 'Madhavi', 'Daya'], 3, ['tvads', 'gujarati'], 'all', 1),
  Q('Paneer is made from…', ['Soy', 'Milk', 'Rice', 'Lentils'], 1, ['food'], 'all', 1),
  Q('What do you shout when you cut a kite on Uttarayan?', ['Jai Shree Krishna', 'Saal Mubarak', 'Khamma Ghani', 'Kai Po Che!'], 3, ['gujarati'], 'all', 2),
  Q('The Gujarati New Year, the day after Diwali, is…', ['Bestu Varas', 'Bhai Beej', 'Labh Pancham', 'Dhanteras'], 0, ['gujarati', 'mythology'], 'all', 2),
  Q('Diwali’s five days begin with…', ['Bhai Beej', 'Dhanteras', 'Labh Pancham', 'Kali Chaudas'], 1, ['mythology', 'gujarati'], 'all', 2),
  Q('A Tim Hortons “double-double” is…', ['A double shot', '2 creams, 2 sugars', 'Two cups', 'Extra large'], 1, ['canada', 'food'], 'all', 2),
  Q('Krishna was born in…', ['Gokul', 'Vrindavan', 'Dwarka', 'Mathura'], 3, ['mythology'], 'all', 2),
  Q('Undhiyu is the star dish of which festival?', ['Holi', 'Uttarayan', 'Diwali', 'Navratri'], 1, ['food', 'gujarati'], 'all', 2),
  Q('The Amul girl is famous for her…', ['Polka-dot frock', 'Striped saree', 'School uniform', 'Lehenga'], 0, ['tvads'], 'all', 2),
  Q('Who played Shaktimaan?', ['Arun Govil', 'Mukesh Khanna', 'Nitish Bharadwaj', 'Puneet Issar'], 1, ['tvads'], 'all', 2),
  Q('In Shaka Laka Boom Boom, Sanju’s magic object was a…', ['Paintbrush', 'Pencil', 'Chalk', 'Pen'], 1, ['tvads'], 'young', 2),
  Q('In Main Hoon Na, Major Ram goes undercover as a…', ['Teacher', 'College student', 'Cook', 'Bodyguard'], 1, ['bollywood'], 'all', 2),
  Q('“Pushpa… naam sunke flower samjhe kya? ___ hai main!”', ['Power', 'Fire', 'Tiger', 'Rowdy'], 1, ['bollywood'], 'young', 2),
  Q('Which film’s song won the 2023 Oscar for Best Original Song?', ['RRR', 'Pathaan', 'KGF: Chapter 2', 'Brahmastra'], 0, ['music', 'bollywood'], 'all', 2),
  Q('Who played Ram in Doordarshan’s Ramayan (1987)?', ['Nitish Bharadwaj', 'Arun Govil', 'Mukesh Khanna', 'Dara Singh'], 1, ['tvads', 'mythology'], 'grown', 2),
  Q('“Buland Bharat ki buland tasveer — Hamara ___”', ['Hero', 'TVS', 'Bajaj', 'Vespa'], 2, ['tvads'], 'grown', 2),
  Q('“Mere paas maa hai!” is from…', ['Deewaar', 'Sholay', 'Trishul', 'Don'], 0, ['bollywood'], 'grown', 2),
  Q('On Orkut, messages left on someone’s profile were…', ['Scraps', 'Pokes', 'Walls', 'Notes'], 0, ['tvads'], 'grown', 2),
  Q('The original Tulsi in Kyunki Saas Bhi Kabhi Bahu Thi was played by…', ['Shweta Tiwari', 'Sakshi Tanwar', 'Smriti Irani', 'Ekta Kapoor'], 2, ['tvads'], 'grown', 2),
  Q('Who wrote down the Mahabharata as Ved Vyasa dictated it?', ['Hanuman', 'Narad', 'Ganesha', 'Valmiki'], 2, ['mythology'], 'all', 3),
  Q('“21 din mein paisa double!” The Laxmi Chit Fund scam is from…', ['Hera Pheri', 'Phir Hera Pheri', 'Welcome', 'Bhagam Bhag'], 1, ['bollywood'], 'all', 3),
  Q('Which Bollywood awards show came to Toronto in 2011?', ['IIFA', 'Filmfare', 'Zee Cine', 'Screen'], 0, ['canada', 'bollywood'], 'all', 3),
];

const kbc = [
  Q('How many heads does Ravana have?', ['5', '7', '10', '12'], 2, ['mythology'], 'all', 1),
  Q('An Iced Capp comes from…', ['Second Cup', 'Starbucks', 'Tim Hortons', 'McDonald’s'], 2, ['canada', 'food'], 'all', 1),
  Q('Which dance is Gujarat famous for during Navratri?', ['Bhangra', 'Garba', 'Lavani', 'Bihu'], 1, ['gujarati', 'music'], 'all', 1),
  Q('Who killed the demon king Kansa?', ['Balram', 'Ram', 'Krishna', 'Arjun'], 2, ['mythology'], 'all', 1),
  Q('Who sang “Tum Hi Ho” from Aashiqui 2?', ['Atif Aslam', 'Arijit Singh', 'KK', 'Sonu Nigam'], 1, ['music'], 'all', 1),
  Q('Shah Rukh Khan’s Bandra home is called…', ['Jalsa', 'Galaxy', 'Prateeksha', 'Mannat'], 3, ['bollywood'], 'all', 1),
  Q('Hanuman’s mother is…', ['Kaushalya', 'Sumitra', 'Anjana', 'Kaikeyi'], 2, ['mythology'], 'all', 2),
  Q('Which A.R. Rahman song won the 2009 Oscar?', ['Chaiyya Chaiyya', 'Jai Ho', 'Kun Faya Kun', 'Naatu Naatu'], 1, ['music'], 'all', 2),
  Q('Before a Gujarati wedding begins, the bride’s mother welcomes the groom with…', ['Pithi', 'Mameru', 'Ponkvu', 'Saptapadi'], 2, ['gujarati'], 'grown', 2),
  Q('The Bhagavad Gita is Krishna’s advice to…', ['Bhima', 'Arjuna', 'Yudhishthira', 'Karna'], 1, ['mythology'], 'all', 2),
  Q('Garba star Atul Purohit is from which city?', ['Ahmedabad', 'Vadodara', 'Surat', 'Rajkot'], 1, ['gujarati', 'music'], 'all', 2),
  Q('Who played Don in the 2006 remake?', ['Amitabh Bachchan', 'Ranveer Singh', 'Hrithik Roshan', 'Shah Rukh Khan'], 3, ['bollywood'], 'all', 2),
  Q('“Ek chutki sindoor ki keemat tum kya jaano…” — who?', ['Rahul babu', 'Ramesh babu', 'Raju babu', 'Mohan babu'], 1, ['bollywood'], 'all', 3),
  Q('“Kajra Re” got all three Bachchans on screen. Which film?', ['Kabhi Alvida Naa Kehna', 'Jhoom Barabar Jhoom', 'Bunty Aur Babli', 'Bluffmaster!'], 2, ['bollywood', 'music'], 'all', 3),
  Q('At a Gujarati wedding, the gift ceremony from the bride’s maternal uncle is…', ['Pithi', 'Mameru', 'Jaan', 'Saptapadi'], 1, ['gujarati'], 'grown', 3),
  Q('How many zeros are in one crore?', ['5', '6', '7', '8'], 2, ['tvads'], 'all', 3),
  Q('Gujarat’s capital is…', ['Ahmedabad', 'Gandhinagar', 'Vadodara', 'Surat'], 1, ['gujarati'], 'all', 3),
  Q('Anant Ambani and Radhika Merchant’s first pre-wedding bash (2024) was in…', ['Udaipur', 'Jamnagar', 'Jodhpur', 'Lonavala'], 1, ['gujarati', 'bollywood'], 'all', 3),
  Q('Which Indo-Canadian director made “Fire” and “Water”?', ['Mira Nair', 'Gurinder Chadha', 'Deepa Mehta', 'Lilly Singh'], 2, ['canada', 'bollywood'], 'grown', 3),
];

// Jeopardy: each category has five clues from easy to hard. Phones answer from four options.
const C = (q, options, answer) => ({ q, options, answer, a: options[answer] });
const jeopardy = [
  { name: 'Ramayan Katha', tags: ['mythology'], age: 'all', clues: [
    C('Ravana’s kingdom', ['Lanka', 'Ayodhya', 'Kishkindha', 'Mithila'], 0),
    C('Sita’s father', ['Dasharatha', 'King Janaka', 'Sugriva', 'Vali'], 1),
    C('The herb Hanuman flew to fetch for Lakshman', ['Tulsi', 'Neem', 'Sanjeevani', 'Soma'], 2),
    C('Ravana’s brother who joined Ram', ['Kumbhakarna', 'Indrajit', 'Khara', 'Vibhishana'], 3),
    C('He wrote the original Ramayana in Sanskrit', ['Valmiki', 'Tulsidas', 'Ved Vyasa', 'Kalidasa'], 0),
  ] },
  { name: 'Krishna Leela', tags: ['mythology'], age: 'all', clues: [
    C('Krishna’s evil uncle', ['Ravana', 'Kansa', 'Shishupal', 'Duryodhana'], 1),
    C('The hill Krishna lifted on his little finger', ['Kailash', 'Meru', 'Govardhan', 'Dronagiri'], 2),
    C('In the Mahabharata war, Krishna was Arjuna’s…', ['Charioteer', 'Archer', 'Guru', 'Brother'], 0),
    C('The demon Krishna defeated, remembered on Kali Chaudas', ['Kansa', 'Mahishasura', 'Ravana', 'Narakasura'], 3),
    C('How many Kaurava brothers were there?', ['5', '12', '100', '1000'], 2),
  ] },
  { name: 'Garvi Gujarat', tags: ['gujarati'], age: 'all', clues: [
    C('The only forest home of Asiatic lions', ['Kanha', 'Gir', 'Ranthambore', 'Sundarbans'], 1),
    C('Eaten with jalebi on Dussehra', ['Fafda', 'Khaman', 'Thepla', 'Handvo'], 0),
    C('Krishna’s kingdom on Gujarat’s coast', ['Mathura', 'Ayodhya', 'Dwarka', 'Kashi'], 2),
    C('Gandhi’s birthplace', ['Ahmedabad', 'Rajkot', 'Surat', 'Porbandar'], 3),
    C('The first of the 12 jyotirlingas, on Gujarat’s coast', ['Somnath', 'Kedarnath', 'Kashi Vishwanath', 'Mahakaleshwar'], 0),
  ] },
  { name: 'Filmy Chakkar', tags: ['bollywood'], age: 'all', clues: [
    C('“Main apni favourite hoon!” — say her name', ['Poo', 'Geet', 'Naina', 'Simran'], 1),
    C('“Control Uday, control!” — who says it?', ['Uday Shetty', 'Baburao', 'Majnu Bhai', 'Circuit'], 2),
    C('The film where Akshay Kumar plays Happy Singh', ['Singh Is Kinng', 'Namastey London', 'Welcome', 'Tees Maar Khan'], 0),
    C('“Kabhi kabhi lagta hai apun hi bhagwan hai” — which series?', ['Mirzapur', 'Paatal Lok', 'The Family Man', 'Sacred Games'], 3),
    C('“Thappad se darr nahi lagta sahab, pyaar se lagta hai” — which film?', ['Rowdy Rathore', 'Dabangg', 'Singham', 'Wanted'], 1),
  ] },
  { name: 'Ad Break', tags: ['tvads'], age: 'all', clues: [
    C('“Washing powder ___” — name the brand', ['Surf', 'Rin', 'Nirma', 'Wheel'], 2),
    C('“Daag achhe hain” — whose tagline?', ['Surf Excel', 'Tide', 'Ariel', 'Rin'], 0),
    C('“Yeh ___ ka mazboot jod hai, tootega nahi!”', ['Fevikwik', 'Fevicol', 'Araldite', 'M-Seal'], 1),
    C('“Thanda matlab…?”', ['Pepsi', 'Thums Up', 'Limca', 'Coca-Cola'], 3),
    C('“Kuch khaas hai…” — which chocolate?', ['5 Star', 'KitKat', 'Cadbury Dairy Milk', 'Perk'], 2),
  ] },
  { name: 'Khaana Peena', tags: ['food', 'gujarati'], age: 'all', clues: [
    C('Thin besan rolls, tempered with mustard seeds', ['Khaman', 'Khandvi', 'Dhokla', 'Handvo'], 1),
    C('Mango pulp served with puri', ['Aamras', 'Shrikhand', 'Basundi', 'Kheer'], 0),
    C('The eggy-smelling salt in chaat masala', ['Sendha namak', 'Hing', 'Kala namak', 'Amchur'], 2),
    C('The Gujarati dessert of strained yogurt with saffron', ['Basundi', 'Rabdi', 'Kheer', 'Shrikhand'], 3),
    C('The festival where undhiyu is the star dish', ['Holi', 'Uttarayan', 'Diwali', 'Navratri'], 1),
  ] },
  { name: 'Canada Life', tags: ['canada'], age: 'all', clues: [
    C('Toronto’s 553-metre landmark', ['CN Tower', 'Rogers Centre', 'Casa Loma', 'Scotiabank Arena'], 0),
    C('Canada’s $1 coin', ['Toonie', 'Loonie', 'Beaver', 'Maple'], 1),
    C('Canada’s official national winter sport', ['Curling', 'Skiing', 'Ice hockey', 'Lacrosse'], 2),
    C('Toronto’s Little India is on this street', ['Yonge St', 'Queen St', 'Bloor St', 'Gerrard St'], 3),
    C('Brampton-raised comic: “Somebody gonna get hurt real bad”', ['Russell Peters', 'Lilly Singh', 'Hasan Minhaj', 'Kapil Sharma'], 0),
  ] },
  { name: 'Tunes & Tracks', tags: ['music'], age: 'all', clues: [
    C('“Naatu Naatu” is from…', ['Pushpa', 'RRR', 'KGF', 'Baahubali'], 1),
    C('Who is called the Queen of Dandiya?', ['Shreya Ghoshal', 'Alka Yagnik', 'Falguni Pathak', 'Kavita Krishnamurthy'], 2),
    C('“Chaiyya Chaiyya” was danced on top of a…', ['Bus', 'Ship', 'Roof', 'Train'], 3),
    C('He sang the “Kal Ho Naa Ho” title track', ['Sonu Nigam', 'KK', 'Shaan', 'Udit Narayan'], 0),
    C('The 2023 Coke Studio Bharat song that took Aditya Gadhvi global', ['Pasoori', 'Khalasi', 'Kana Yaari', 'Thagyo'], 1),
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
