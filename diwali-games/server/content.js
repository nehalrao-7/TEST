// Sample content for every game. The host can edit all of it from the
// Host panel (Games → Edit content) without touching code.

const quiz = (q, options, answer, extra = {}) => ({ q, options, answer, time: 20, ...extra });

// Written for guests born 1995–2000 in the Indian-Canadian GTA crowd: 2000s Bollywood,
// Hollywood and Pixar, Disney Channel nostalgia, Toronto, garba. No cricket.
// Hard but fair: every answer is something this room has seen, heard or danced to.
// Facts marked "HOST: confirm" in comments are local details worth a quick check.

const guessTheMovie = {
  questions: [
    quiz('Guess the movie!', ['Kabhi Alvida Naa Kehna', 'Kal Ho Naa Ho', 'New York', 'My Name Is Khan'], 1, { clue: '🗽 ❤️‍🩹 🩺 ⏳' }),
    quiz('Guess the movie!', ['Jab We Met', 'Chennai Express', 'Yeh Jawaani Hai Deewani', 'Dilwale Dulhania Le Jayenge'], 0, { clue: '🚆 🙋‍♀️ 💔 🏔️' }),
    quiz('Guess the movie!', ['Interstellar', 'Tenet', 'Inception', 'The Matrix'], 2, { clue: '💤 🌀 🏙️ 🔝' }),
    quiz('Guess the movie!', ['Stanley Ka Dabba', 'Taare Zameen Par', 'Iqbal', 'I Am Kalam'], 1, { clue: '🎨 🔤 🏫 ⭐' }),
    quiz('Guess the movie!', ['Karan Arjun', 'Om Shanti Om', 'Housefull', 'Krrish'], 1, { clue: '🎬 🔥 🔁 👻' }),
    quiz('Guess the movie!', ['Rocket Singh', 'Mission Mangal', 'Swades', 'Rocketry'], 2, { clue: '🚀 🇺🇸 ➡️ 🇮🇳 💡' }),
    quiz('Guess the movie!', ['Dil Chahta Hai', 'Rang De Basanti', 'Lakshya', 'Fanaa'], 1, { clue: '🎥 🟡 🛩️ 🕯️' }),
    quiz('Guess the movie!', ['Clueless', 'Legally Blonde', 'Easy A', 'Mean Girls'], 3, { clue: '💗 📓 👑 🚌' }),
    quiz('Guess the movie!', ['Lion', 'Life of Pi', 'The Jungle Book', 'Cast Away'], 1, { clue: '🐅 🚣 🌊 🧘' }),
    quiz('Guess the movie!', ['Magadheera', 'RRR', 'KGF: Chapter 2', 'Baahubali 2'], 3, { clue: '🤔 🗡️ 🔙 👑' }),
    quiz('Guess the movie!', ['Devdas', 'Saawariya', 'Bajirao Mastani', 'Mughal-e-Azam'], 0, { clue: '🥃 💔 🪔 💃' }),
    quiz('Guess the movie!', ['Kung Fu Panda', 'Luca', 'Turning Red', 'Encanto'], 2, { clue: '🐼 🔴 🍁 🎤' }),
  ],
};

const kahoot = {
  questions: [
    quiz('Before her talk show, Lilly Singh’s YouTube channel was called…', ['IISuperwomanII', 'SuperDesiGirl', 'LillyLaughs', 'ScarboroughSuperstar'], 0),
    quiz('Drake’s character on Degrassi: The Next Generation was…', ['Spinner Mason', 'Jimmy Brooks', 'Sean Cameron', 'Craig Manning'], 1),
    quiz('Shaktimaan’s mild-mannered alter ego was…', ['Kilvish', 'Dr. Jackal', 'Gangadhar', 'Tamraj'], 2),
    quiz('In K3G, what’s Pooja’s (Kareena’s) nickname?', ['Pinky', 'Poo', 'Chutki', 'Sweety'], 1),
    quiz('“Kya aapke toothpaste mein namak hai?” sold which toothpaste?', ['Colgate Active Salt', 'Close-Up', 'Pepsodent', 'Babool'], 0),
    quiz('In The Suite Life of Zack & Cody, the twins live in the…', ['Plaza', 'Tipton', 'Carlton', 'Waldorf'], 1),
    quiz('Which Pokémon evolves into Charizard?', ['Charmander', 'Charmeleon', 'Dragonite', 'Magmar'], 1),
    quiz('Lakshmi Puja on Diwali night falls on which lunar day?', ['Purnima', 'Ekadashi', 'Amavasya', 'Chaturthi'], 2),
    quiz('Which form of the Goddess is worshipped on the first night of Navratri?', ['Kalaratri', 'Shailaputri', 'Siddhidatri', 'Kushmanda'], 1),
    quiz('Garba is traditionally danced in a circle around…', ['A tulsi plant', 'A bonfire', 'A lamp in a clay pot (garbo)', 'A banyan tree'], 2),
    quiz('Atul Purohit’s Toronto Navratri nights (2023–2025) were held at…', ['Scotiabank Arena', 'Enercare Centre', 'International Centre', 'Paramount Fine Foods Centre'], 1),
    // HOST: confirm. Aditya Gadhvi's own tour page lists Toronto, 3 Oct 2026 (Navrang Navratri, Mississauga).
    quiz('Aditya Gadhvi (“Khalasi”) played the GTA this Navratri. On which date?', ['Sat, Sept 26', 'Fri, Oct 2', 'Sat, Oct 3', 'Sat, Oct 10'], 2),
  ],
};

const jeopardy = {
  wrongPenalty: false,
  categories: [
    { name: '2000s Bollywood', clues: [
      { value: 100, q: 'Shah Rukh’s character in Kal Ho Naa Ho', a: 'Aman Mathur' },
      { value: 200, q: '“Main apni favourite hoon!” — say her name', a: 'Geet (Jab We Met)' },
      { value: 300, q: 'The 2003 film where Rohit befriends an alien named Jaadu', a: 'Koi... Mil Gaya' },
      { value: 400, q: 'Rancho’s real name in 3 Idiots', a: 'Phunsukh Wangdu' },
      { value: 500, q: 'Farhan Akhtar’s 2001 debut about three friends, Goa and Sydney', a: 'Dil Chahta Hai' },
    ] },
    { name: 'The 6ix', clues: [
      { value: 100, q: 'Drake’s 2016 album with him sitting on the CN Tower on the cover', a: 'Views' },
      { value: 200, q: 'Scarborough’s own YouTuber who got an NBC late-night show', a: 'Lilly Singh' },
      { value: 300, q: 'Brampton-raised comic: “Somebody gonna get hurt real bad”', a: 'Russell Peters' },
      { value: 400, q: 'The year the Raptors won the NBA championship', a: '2019' },
      { value: 500, q: 'In 2017 he became the first turbaned Sikh to lead a Canadian federal party', a: 'Jagmeet Singh' },
    ] },
    { name: 'Garba Nights', clues: [
      { value: 100, q: 'The sticks you twirl in raas', a: 'Dandiya' },
      { value: 200, q: 'Gujarati name for the clay-pot lamp at the centre of the circle', a: 'Garbo (garbi)' },
      { value: 300, q: 'Number of claps in the classic “tran taali” step', a: 'Three' },
      { value: 400, q: 'Falguni Pathak’s royal nickname', a: 'Queen of Dandiya' },
      { value: 500, q: 'The 2023 Coke Studio Bharat song that took Aditya Gadhvi global', a: 'Khalasi' },
    ] },
    { name: 'Screen Time', clues: [
      { value: 100, q: 'Cedric Diggory’s Hogwarts house', a: 'Hufflepuff' },
      { value: 200, q: 'Netflix show starring Devi Vishwakumar', a: 'Never Have I Ever' },
      { value: 300, q: 'Maitreyi Ramakrishnan, who plays Devi, grew up in this GTA city', a: 'Mississauga' },
      { value: 400, q: 'Nolan film where Cooper’s daughter is named Murph', a: 'Interstellar' },
      { value: 500, q: '2016 Dev Patel film about finding home using Google Earth', a: 'Lion' },
    ] },
    { name: 'Desi Kitchen', clues: [
      { value: 100, q: 'Spongy, yellow, steamed Gujarati besan snack', a: 'Dhokla' },
      { value: 200, q: 'Mango pulp served with puri in a Gujarati thali', a: 'Aamras (keri no ras)' },
      { value: 300, q: 'The eggy-smelling salt that makes chaat taste like chaat', a: 'Kala namak (black salt)' },
      { value: 400, q: 'On Dussehra, fafda is eaten with this sweet', a: 'Jalebi' },
      { value: 500, q: 'The spice that is the dried stigma of a crocus flower', a: 'Saffron (kesar)' },
    ] },
  ],
};

const kbc = {
  // Played in order, easy to hard. Each later correct answer is worth less, so speed matters.
  ladder: [
    { points: 100, questions: [
      quiz('“Ye Baburao ka style hai!” — which film?', ['Welcome', 'Hera Pheri', 'Golmaal', 'Bhagam Bhag'], 1),
      quiz('An Iced Capp comes from…', ['Second Cup', 'Starbucks', 'Tim Hortons', 'McDonald’s'], 2),
    ] },
    { points: 200, questions: [
      quiz('Who sang “Tum Hi Ho” from Aashiqui 2?', ['Atif Aslam', 'Arijit Singh', 'KK', 'Sonu Nigam'], 1),
      quiz('By law, Canada’s national SUMMER sport is…', ['Soccer', 'Baseball', 'Lacrosse', 'Basketball'], 2),
    ] },
    { points: 300, safe: true, questions: [
      quiz('In Kuch Kuch Hota Hai, little Anjali is named after…', ['Rahul’s mother', 'Tina’s college friend', 'Rahul’s sister', 'A film star'], 1),
      quiz('In Canada, the first Harry Potter book is “… and the ___ Stone”', ['Sorcerer’s', 'Philosopher’s', 'Wizard’s', 'Secret'], 1),
    ] },
    { points: 500, questions: [
      quiz('Dhanteras honours which god of Ayurveda?', ['Kubera', 'Vishwakarma', 'Dhanvantari', 'Ashwini Kumaras'], 2),
      quiz('Which A.R. Rahman song won the 2009 Oscar?', ['Chaiyya Chaiyya', 'Jai Ho', 'Kun Faya Kun', 'Naatu Naatu'], 1),
    ] },
    { points: 750, questions: [
      quiz('In Chak De! India, Kabir Khan coaches India’s women’s ___ team', ['Kabaddi', 'Football', 'Hockey', 'Volleyball'], 2),
      quiz('Garba star Atul Purohit is from which city?', ['Ahmedabad', 'Vadodara', 'Surat', 'Rajkot'], 1),
    ] },
    { points: 1000, safe: true, questions: [
      quiz('Who directed both Lagaan and Swades?', ['Rakeysh Mehra', 'Ashutosh Gowariker', 'Farhan Akhtar', 'Rajkumar Hirani'], 1),
      quiz('India’s first-ever Oscar nomination (1958) was…', ['Pather Panchali', 'Mother India', 'Salaam Bombay!', 'Lagaan'], 1),
    ] },
    { points: 1500, questions: [
      quiz('Bandi Chhor Divas marks the release of which Guru from Gwalior Fort?', ['Guru Nanak', 'Guru Hargobind', 'Guru Gobind Singh', 'Guru Arjan'], 1),
      quiz('How many zeros are in one crore?', ['5', '6', '7', '8'], 2),
    ] },
    { points: 2500, questions: [
      quiz('Tagore wrote India’s anthem — and which other country’s?', ['Sri Lanka', 'Nepal', 'Bangladesh', 'Myanmar'], 2),
      quiz('Shah Rukh Khan’s Bandra home is called…', ['Jalsa', 'Galaxy', 'Prateeksha', 'Mannat'], 3),
    ] },
  ],
  fastestFinger: [
    quiz('How many nights does Navratri last?', ['7', '8', '9', '10'], 2, { time: 15 }),
    quiz('Which GTA city is home to Square One?', ['Brampton', 'Mississauga', 'Vaughan', 'Markham'], 1, { time: 15 }),
    quiz('Which festival is called the festival of colours?', ['Diwali', 'Holi', 'Onam', 'Pongal'], 1, { time: 15 }),
    quiz('Paneer is made from…', ['Soy', 'Milk', 'Rice', 'Lentils'], 1, { time: 15 }),
  ],
};

// Official music videos. `t` is where the hook choreography starts; `clip` matches the dance clock.
const hookVideo = (id, t) => ({ youtube: `https://www.youtube.com/watch?v=${id}&t=${t}s`, clip: 45, showVideo: true });
const HOOK_SONGS = [
  { title: 'Naatu Naatu — RRR', step: 'The lightning foot shuffle, arms on each other’s shoulders', ...hookVideo('4_eEgJhsBMo', 68) },
  { title: 'Lungi Dance — Chennai Express', step: 'Twirl the (imaginary) lungi and swing those hips', ...hookVideo('2kWLyInyjOE', 46) },
  { title: 'Kala Chashma — Baar Baar Dekho', step: 'The big squat-drop on “kala chashma jachda”', ...hookVideo('k4yXQkG2s1E', 48) },
  { title: 'Srivalli — Pushpa', step: 'The swagger walk with one slipper dragging', ...hookVideo('hcMzwMrr1tE', 55) },
  { title: 'Tamma Tamma Again — Badrinath Ki Dulhania', step: 'The hand-roll and shoulder bounce', ...hookVideo('EEX_XM6SxmY', 24) },
  { title: 'Chaiyya Chaiyya — Dil Se', step: 'Groove like you’re on top of a moving train', ...hookVideo('9yT4F8hzykY', 20) },
  { title: 'Gallan Goodiyaan — Dil Dhadakne Do', step: 'Full bhangra shoulders, nonstop', ...hookVideo('jCEdTq3j-0U', 22) },
  { title: 'Butta Bomma — Ala Vaikunthapurramuloo', step: 'The smooth side-step shuffle', ...hookVideo('2mDCVzruYzQ', 18) },
  { title: 'Jhoome Jo Pathaan — Pathaan', step: 'The arm-flip and lean-back hook', ...hookVideo('YxWlaYCA8MU', 55) },
  { title: 'London Thumakda — Queen', step: 'Maximum thumkas, wedding-style', ...hookVideo('udra3Mfw2oo', 38) },
];
const hookKey = (title) => String(title || '').split('—')[0].split('(')[0].trim().toLowerCase();
const HOOK_LINKS = Object.fromEntries(HOOK_SONGS.map((s) => [hookKey(s.title), { youtube: s.youtube, clip: s.clip, showVideo: true }]));

// Saved games keep host-written links. Songs that still match the default list pick up a link.
function applyHookVideos(content) {
  if (!content || !Array.isArray(content.songs)) return;
  for (const s of content.songs) {
    if (s.youtube) continue;
    const link = HOOK_LINKS[hookKey(s.title)];
    if (link) Object.assign(s, link);
  }
}

const hookstep = {
  performSeconds: 45,
  himmatBonus: 100,
  songs: HOOK_SONGS,
};

function defaultGames() {
  return [
    { id: 'g1', type: 'quiz', title: 'Guess the Movie', emoji: '🎬', mode: 'team', status: 'pending', content: guessTheMovie },
    { id: 'g2', type: 'hookstep', title: 'Hook Step Challenge', emoji: '💃', mode: 'team', status: 'pending', content: hookstep },
    { id: 'g3', type: 'jeopardy', title: 'Desi Jeopardy', emoji: '🧠', mode: 'team', status: 'pending', content: jeopardy },
    { id: 'g4', type: 'quiz', title: 'Desi Kahoot', emoji: '⚡', mode: 'individual', status: 'pending', content: kahoot },
    { id: 'g5', type: 'kbc', title: 'Kaun Banega Crorepati', emoji: '💰', mode: 'individual', status: 'pending', content: kbc },
  ];
}

const templates = { quiz: kahoot, jeopardy, kbc, hookstep, custom: { description: 'Host awards points manually.' } };

module.exports = { defaultGames, templates, applyHookVideos };
