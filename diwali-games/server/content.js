// Sample content for every game. The host can edit all of it from the
// Host panel (Games → Edit content) without touching code.

const quiz = (q, options, answer, extra = {}) => ({ q, options, answer, time: 20, ...extra });

// Written for guests born 1995–2000 in the Indian-Canadian GTA crowd: Bollywood, desi TV,
// diaspora films, desi food, garba. Every question is Indian. No cricket.
// Hard but fair: every answer is something this room has seen, heard or danced to.
// Facts marked "HOST: confirm" in comments are local details worth a quick check.

const guessTheMovie = {
  questions: [
    quiz('Guess the movie!', ['The Lunchbox', 'Cheeni Kum', 'Piku', 'Chef'], 0, { clue: '🍱 📮 💌 🚂' }),
    quiz('Guess the movie!', ['Namastey London', 'Patiala House', 'Bend It Like Beckham', 'Bride & Prejudice'], 2, { clue: '⚽ 🥔 🥦 👧🏽 🇬🇧' }),
    quiz('Guess the movie!', ['Jab We Met', 'Chennai Express', 'Yeh Jawaani Hai Deewani', 'Love Aaj Kal'], 0, { clue: '🚆 🙋‍♀️ 💔 🏔️' }),
    quiz('Guess the movie!', ['Kabhi Alvida Naa Kehna', 'Kal Ho Naa Ho', 'New York', 'My Name Is Khan'], 1, { clue: '🗽 ❤️‍🩹 🩺 ⏳' }),
    quiz('Guess the movie!', ['Stanley Ka Dabba', 'Taare Zameen Par', 'Iqbal', 'I Am Kalam'], 1, { clue: '🎨 🔤 🏫 ⭐' }),
    quiz('Deepa Mehta’s 2002 Toronto comedy: a desi guy hires a fake fiancée to please his family', ['Monsoon Wedding', 'Bride & Prejudice', 'Bollywood/Hollywood', 'Namastey London'], 2),
    quiz('Guess the movie!', ['The Hundred-Foot Journey', 'Julie & Julia', 'Burnt', 'Chef'], 0, { clue: '🍛 🇫🇷 ⭐ 👨‍👩‍👦' }),
    quiz('Guess the movie!', ['Band Baaja Baaraat', 'Monsoon Wedding', 'Shaadi Ke Side Effects', 'Bride & Prejudice'], 1, { clue: '💍 🌧️ 🌼 🏕️' }),
    quiz('The 2011 hockey movie about a Sikh team, shot in the GTA and backed by Akshay Kumar', ['Patiala House', 'Speedy Singhs', 'Chak De! India', 'Singh Is Kinng'], 1),
    quiz('Guess the movie!', ['Pardes', 'Swades', 'Namastey London', 'Aa Ab Laut Chalen'], 0, { clue: '🇺🇸 💍 👧🏽 🌾 🎸' }),
    quiz('Guess the movie!', ['Kabhi Khushi Kabhie Gham', 'Hum Saath-Saath Hain', 'Kal Ho Naa Ho', 'Baghban'], 0, { clue: '👨‍👩‍👦‍👦 🇬🇧 🚁 🏰' }),
    quiz('Guess the movie!', ['Kuch Kuch Hota Hai', 'Dilwale Dulhania Le Jayenge', 'Pardes', 'Mohabbatein'], 1, { clue: '🇬🇧 🚂 🌻 🇨🇭' }),
  ],
};

const kahoot = {
  questions: [
    quiz('Himesh Reshammiya’s trademark look was his…', ['Cap', 'Sunglasses', 'Scarf', 'Ponytail'], 0),
    quiz('Ekta Kapoor’s saas-bahu serials famously all started with the letter…', ['S', 'K', 'A', 'M'], 1),
    quiz('The dog in Hum Aapke Hain Koun..! is called…', ['Moti', 'Sheru', 'Tuffy', 'Bruno'], 2),
    quiz('Munna Bhai’s loyal sidekick is…', ['Majnu', 'Circuit', 'Babloo', 'Pappu'], 1),
    quiz('Chhota Bheem lives in the village of…', ['Hastinapur', 'Champakpur', 'Dholakpur', 'Gokuldham'], 2),
    quiz('Tulsi in Kyunki Saas Bhi Kabhi Bahu Thi was played by…', ['Shweta Tiwari', 'Sakshi Tanwar', 'Smriti Irani', 'Ekta Kapoor'], 2),
    quiz('CID: “Daya, ___ tod do!”', ['Darwaza', 'Taala', 'Khidki', 'Deewar'], 0),
    quiz('In Shaka Laka Boom Boom, Sanju’s magic object was a…', ['Paintbrush', 'Pencil', 'Chalk', 'Pen'], 1),
    quiz('Hrithik Roshan’s 2000 debut film was…', ['Fiza', 'Mission Kashmir', 'Kaho Naa... Pyaar Hai', 'Koi... Mil Gaya'], 2),
    quiz('In Main Hoon Na, Major Ram goes undercover as a…', ['Teacher', 'College student', 'Cook', 'Bodyguard'], 1),
    quiz('Atul Purohit headlined a big Sharad Purnima garba in Toronto back in…', ['2006', '2010', '2014', '2017'], 1),
    quiz('Aditya Gadhvi’s sold-out GTA garba night this year was on…', ['Mon, Sept 7', 'Sat, Sept 26', 'Sat, Oct 3', 'Sat, Oct 17'], 2),
  ],
};

const jeopardy = {
  wrongPenalty: false,
  // The last category ("group: true") is swapped for questions about the guests when the
  // questionnaire has enough answers. It keeps its name; these clues are the fallback.
  categories: [
    { name: 'Filmy Chakkar', clues: [
      { value: 100, q: '“Kitne aadmi the?” — who’s asking?', a: 'Gabbar Singh (Sholay)' },
      { value: 200, q: '“Main apni favourite hoon!” — say her name', a: 'Geet (Jab We Met)' },
      { value: 300, q: 'The 2003 film where Rohit befriends an alien named Jaadu', a: 'Koi... Mil Gaya' },
      { value: 400, q: '“Mogambo khush hua!” is from this film', a: 'Mr. India' },
      { value: 500, q: 'Rancho’s real name in 3 Idiots', a: 'Phunsukh Wangdu' },
    ] },
    { name: 'Khaana Peena', clues: [
      { value: 100, q: 'Spongy, yellow, steamed Gujarati besan snack', a: 'Dhokla' },
      { value: 200, q: 'Mango pulp served with puri in a Gujarati thali', a: 'Aamras (keri no ras)' },
      { value: 300, q: 'The eggy-smelling salt that makes chaat taste like chaat', a: 'Kala namak (black salt)' },
      { value: 400, q: 'On Dussehra, fafda is eaten with this sweet', a: 'Jalebi' },
      { value: 500, q: 'Undhiyu is the star dish of this January kite festival', a: 'Uttarayan (Makar Sankranti)' },
    ] },
    { name: 'Mera Bharat Mahaan', clues: [
      { value: 100, q: 'The state where garba was born', a: 'Gujarat' },
      { value: 200, q: 'Known as the Pink City', a: 'Jaipur' },
      { value: 300, q: 'The Statue of Unity, the world’s tallest statue, honours him', a: 'Sardar Vallabhbhai Patel' },
      { value: 400, q: 'The Rann of Kutch is a vast white desert of this', a: 'Salt' },
      { value: 500, q: 'Nickname of India’s first mission to Mars', a: 'Mangalyaan' },
    ] },
    { name: 'Screen Time Pass', clues: [
      { value: 100, q: 'Netflix show starring Devi Vishwakumar', a: 'Never Have I Ever' },
      { value: 200, q: 'Maitreyi Ramakrishnan, who plays Devi, grew up in this GTA city', a: 'Mississauga' },
      { value: 300, q: 'Jethalal is the lovable lead of this long-running sitcom', a: 'Taarak Mehta Ka Ooltah Chashmah' },
      { value: 400, q: 'Hasan Minhaj’s Netflix comedy news show', a: 'Patriot Act' },
      { value: 500, q: 'Mindy Kaling’s character on The Office', a: 'Kelly Kapoor' },
    ] },
    { name: 'Apni Toli', group: true, clues: [
      { value: 100, q: 'The sticks you twirl in raas', a: 'Dandiya' },
      { value: 200, q: 'Number of claps in the classic “tran taali” step', a: 'Three' },
      { value: 300, q: 'Falguni Pathak’s royal nickname', a: 'Queen of Dandiya' },
      { value: 400, q: 'The 2023 Coke Studio Bharat song that took Aditya Gadhvi global', a: 'Khalasi' },
      { value: 500, q: 'The Mississauga venue of Aditya Gadhvi’s two 2026 GTA shows', a: 'International Centre' },
    ] },
  ],
};

const kbc = {
  // Played in order, easy to hard. Each later correct answer is worth less, so speed matters.
  ladder: [
    { points: 100, questions: [
      quiz('“Ye Baburao ka style hai!” — which film?', ['Welcome', 'Hera Pheri', 'Golmaal', 'Bhagam Bhag'], 1),
      quiz('Which star does all of Bollywood just call “Bhai”?', ['Shah Rukh Khan', 'Salman Khan', 'Aamir Khan', 'Akshay Kumar'], 1),
    ] },
    { points: 200, questions: [
      quiz('Who sang “Tum Hi Ho” from Aashiqui 2?', ['Atif Aslam', 'Arijit Singh', 'KK', 'Sonu Nigam'], 1),
      quiz('Who is known as the “Nightingale of India”?', ['Asha Bhosle', 'Lata Mangeshkar', 'Shreya Ghoshal', 'Alka Yagnik'], 1),
    ] },
    { points: 300, safe: true, questions: [
      quiz('In Kuch Kuch Hota Hai, little Anjali is named after…', ['Rahul’s mother', 'Tina’s college friend', 'Rahul’s sister', 'A film star'], 1),
      quiz('Jai and Veeru’s friendship song in Sholay is…', ['Yaaron Dosti', 'Yeh Dosti', 'Tere Jaisa Yaar', 'Dil Chahta Hai'], 1),
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
