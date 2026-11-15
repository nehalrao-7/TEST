// Sample content for every game. The host can edit all of it from the
// Host panel (Games → Edit content) without touching code.

const quiz = (q, options, answer, extra = {}) => ({ q, options, answer, time: 20, ...extra });

// Written for guests born 1995–2000 in the Indian-Canadian GTA crowd: Bollywood, desi TV,
// diaspora films, desi food, garba. Every question is Indian. No cricket.
// Hard but fair: every answer is something this room has seen, heard or danced to.
// Facts marked "HOST: confirm" in comments are local details worth a quick check.

const guessTheMovie = {
  // All films from 2000 onwards. Easy to hard; the last question is the Double Diya.
  questions: [
    quiz('Guess the movie!', ['Kabhi Khushi Kabhie Gham', 'Hum Saath-Saath Hain', 'Kal Ho Naa Ho', 'Baghban'], 0, { clue: '👨‍👩‍👦‍👦 🇬🇧 🚁 🏰' }),
    quiz('Guess the movie!', ['Chhichhore', '3 Idiots', 'Munna Bhai M.B.B.S.', 'Student of the Year'], 1, { clue: '🎓 🔧 💡 😂' }),
    quiz('Guess the movie!', ['Kabhi Alvida Naa Kehna', 'New York', 'Kal Ho Naa Ho', 'My Name Is Khan'], 2, { clue: '🗽 ❤️‍🩹 🩺 ⏳' }),
    quiz('Guess the movie!', ['Chhichhore', 'Dil Chahta Hai', 'Rock On!!', 'Kai Po Che!'], 3, { clue: '🪁 👬 👦 🏪' }),
    quiz('Guess the movie!', ['Baahubali 2', 'Magadheera', 'RRR', 'KGF: Chapter 2'], 0, { clue: '🤔 🗡️ 👑' }),
    quiz('Guess the movie!', ['Housefull', 'Om Shanti Om', 'Krrish', 'Bhool Bhulaiyaa'], 1, { clue: '🎬 🔥 🔁 ⭐' }),
  ],
};

const kahoot = {
  // Easy to hard. The last question is the Double Diya.
  questions: [
    quiz('Diwali celebrates Ram’s return to…', ['Mathura', 'Ayodhya', 'Lanka', 'Dwarka'], 1),
    quiz('Lord Ganesha’s vehicle is a…', ['Peacock', 'Bull', 'Mouse', 'Swan'], 2),
    quiz('In Canada, the $2 coin is the…', ['Toonie', 'Loonie', 'Queenie', 'Beaver'], 0),
    quiz('What do you shout when you cut a kite on Uttarayan?', ['Jai Shree Krishna', 'Saal Mubarak', 'Khamma Ghani', 'Kai Po Che!'], 3),
    quiz('How many years was Ram in exile?', ['7', '12', '14', '16'], 2),
    quiz('A Tim Hortons “double-double” is…', ['A double shot', '2 creams, 2 sugars', 'Two cups', 'Extra large'], 1),
    quiz('Krishna was born in…', ['Gokul', 'Vrindavan', 'Dwarka', 'Mathura'], 3),
    quiz('The Gujarati New Year, the day after Diwali, is…', ['Bestu Varas', 'Bhai Beej', 'Labh Pancham', 'Dhanteras'], 0),
    quiz('Who wrote down the Mahabharata as Ved Vyasa dictated it?', ['Hanuman', 'Narad', 'Ganesha', 'Valmiki'], 2),
    quiz('“Pushpa… naam sunke flower samjhe kya? ___ hai main!”', ['Power', 'Fire', 'Tiger', 'Rowdy'], 1),
  ],
};

const jeopardy = {
  wrongPenalty: false,
  // The last category ("group: true") is swapped for questions about the guests when the
  // questionnaire has enough answers. It keeps its name; these clues are the fallback.
  categories: [
    { name: 'Filmy Chakkar', clues: [
      { value: 100, q: '“Main apni favourite hoon!” — say her name', a: 'Geet (Jab We Met)' },
      { value: 200, q: '“Control Uday, control!” — which character says it?', a: 'Majnu Bhai (Welcome)' },
      { value: 300, q: 'The film where Akshay Kumar plays Happy Singh', a: 'Singh Is Kinng' },
      { value: 400, q: '“Kabhi kabhi lagta hai apun hi bhagwan hai” — which series?', a: 'Sacred Games' },
      { value: 500, q: '“How’s the josh?” — which film?', a: 'Uri: The Surgical Strike' },
    ] },
    { name: 'Ramayan Katha', clues: [
      { value: 100, q: 'Ravana’s kingdom', a: 'Lanka' },
      { value: 200, q: 'Sita’s father', a: 'King Janaka' },
      { value: 300, q: 'The herb Hanuman flew to fetch for Lakshman', a: 'Sanjeevani' },
      { value: 400, q: 'Ravana’s brother who joined Ram', a: 'Vibhishana' },
      { value: 500, q: 'He wrote the original Ramayana', a: 'Valmiki' },
    ] },
    { name: 'Krishna Leela', clues: [
      { value: 100, q: 'Krishna’s evil uncle', a: 'Kansa' },
      { value: 200, q: 'The hill Krishna lifted on his little finger', a: 'Govardhan' },
      { value: 300, q: 'In the Mahabharata war, Krishna was Arjuna’s…', a: 'Charioteer (sarathi)' },
      { value: 400, q: 'The demon Krishna defeated, remembered on Kali Chaudas / Choti Diwali', a: 'Narakasura' },
      { value: 500, q: 'How many Kaurava brothers were there?', a: '100' },
    ] },
    { name: 'Garvi Gujarat', clues: [
      { value: 100, q: 'The only forest home of Asiatic lions', a: 'Gir' },
      { value: 200, q: 'Eaten with jalebi on Dussehra', a: 'Fafda' },
      { value: 300, q: 'Krishna’s kingdom on Gujarat’s coast', a: 'Dwarka' },
      { value: 400, q: 'Gandhi’s birthplace', a: 'Porbandar' },
      { value: 500, q: 'The first of the 12 jyotirlingas, on Gujarat’s coast', a: 'Somnath' },
    ] },
    { name: 'Ad Break 📺', clues: [
      { value: 100, q: '“Washing powder ___, washing powder ___…” — name the brand', a: 'Nirma' },
      { value: 200, q: '“Daag achhe hain” — whose famous tagline?', a: 'Surf Excel' },
      { value: 300, q: '“Yeh ___ ka mazboot jod hai, tootega nahi!”', a: 'Fevicol' },
      { value: 400, q: '“Thanda matlab…?” — Aamir Khan’s famous line', a: 'Coca-Cola' },
      { value: 500, q: 'A girl dances onto a cricket field to celebrate a six. “Kuch khaas hai…” Which chocolate?', a: 'Cadbury Dairy Milk' },
    ] },
    { name: 'Apni Toli', group: true, clues: [
      { value: 100, q: 'The sticks you twirl in raas', a: 'Dandiya' },
      { value: 200, q: 'Number of claps in the classic “tran taali” step', a: 'Three' },
      { value: 300, q: 'Falguni Pathak’s royal nickname', a: 'Queen of Dandiya' },
      { value: 400, q: 'The 2023 Coke Studio Bharat song that took Aditya Gadhvi global', a: 'Khalasi' },
      { value: 500, q: 'The date and venue of Aditya Gadhvi’s last 2026 GTA show', a: 'Sat, Oct 3 — International Centre, Mississauga' },
    ] },
  ],
};

const kbc = {
  // Played in order, easy to hard. Each later correct answer is worth less, so speed matters.
  ladder: [
    { points: 100, questions: [
      quiz('How many heads does Ravana have?', ['5', '7', '10', '12'], 2),
      quiz('An Iced Capp comes from…', ['Second Cup', 'Starbucks', 'Tim Hortons', 'McDonald’s'], 2),
    ] },
    { points: 200, questions: [
      quiz('Who sang “Tum Hi Ho” from Aashiqui 2?', ['Atif Aslam', 'Arijit Singh', 'KK', 'Sonu Nigam'], 1),
      quiz('Shah Rukh Khan’s Bandra home is called…', ['Jalsa', 'Galaxy', 'Prateeksha', 'Mannat'], 3),
    ] },
    { points: 300, safe: true, questions: [
      quiz('Which goddess is worshipped on Diwali night?', ['Saraswati', 'Lakshmi', 'Durga', 'Parvati'], 1),
      quiz('Hanuman’s mother is…', ['Kaushalya', 'Sumitra', 'Anjana', 'Kaikeyi'], 2),
    ] },
    { points: 500, questions: [
      quiz('Which A.R. Rahman song won the 2009 Oscar?', ['Chaiyya Chaiyya', 'Jai Ho', 'Kun Faya Kun', 'Naatu Naatu'], 1),
      quiz('Before a Gujarati wedding begins, the bride’s mother welcomes the groom with…', ['Pithi', 'Mameru', 'Ponkvu', 'Saptapadi'], 2),
    ] },
    { points: 750, questions: [
      quiz('The Bhagavad Gita is Krishna’s advice to…', ['Bhima', 'Arjuna', 'Yudhishthira', 'Karna'], 1),
      quiz('Garba star Atul Purohit is from which city?', ['Ahmedabad', 'Vadodara', 'Surat', 'Rajkot'], 1),
    ] },
    { points: 1000, safe: true, questions: [
      quiz('“Ek chutki sindoor ki keemat tum kya jaano…” — who?', ['Rahul babu', 'Ramesh babu', 'Raju babu', 'Mohan babu'], 1),
      quiz('“Kajra Re” got all three Bachchans on screen. Which film?', ['Kabhi Alvida Naa Kehna', 'Jhoom Barabar Jhoom', 'Bunty Aur Babli', 'Bluffmaster!'], 2),
    ] },
    { points: 1500, questions: [
      quiz('At a Gujarati wedding, the gift ceremony from the bride’s maternal uncle is…', ['Pithi', 'Mameru', 'Jaan', 'Saptapadi'], 1),
      quiz('How many zeros are in one crore?', ['5', '6', '7', '8'], 2),
    ] },
    { points: 2500, questions: [
      quiz('Gujarat’s capital is…', ['Ahmedabad', 'Gandhinagar', 'Vadodara', 'Surat'], 1),
      quiz('Anant Ambani and Radhika Merchant’s first pre-wedding bash (2024) was in…', ['Udaipur', 'Jamnagar', 'Jodhpur', 'Lonavala'], 1),
    ] },
  ],
  fastestFinger: [
    quiz('How many nights does Navratri last?', ['7', '8', '9', '10'], 2, { time: 15 }),
    quiz('Which festival is called the festival of colours?', ['Diwali', 'Holi', 'Onam', 'Pongal'], 1, { time: 15 }),
    quiz('Paneer is made from…', ['Soy', 'Milk', 'Rice', 'Lentils'], 1, { time: 15 }),
  ],
};

// Official music videos. `t` starts a couple of seconds before each video's most-replayed
// moment (usually the hook step). `level` sets the order Spin draws them: easy, then medium, then hard.
// Dola Re Dola has no official full video; its link and start time are best guesses to check.
const hookVideo = (id, t) => ({ youtube: `https://www.youtube.com/watch?v=${id}&t=${t}s`, clip: 25, showVideo: true });
const HOOK_SONGS = [
  { level: 'easy', title: 'Sheila Ki Jawani — Tees Maar Khan', step: 'The hip sway with hands framing the face', ...hookVideo('ZTmF2v59CtI', 171) },
  { level: 'easy', title: 'Chikni Chameli — Agneepath', step: 'The big jhatka with arms overhead', ...hookVideo('QcQpqWhTBCE', 31) },
  { level: 'easy', title: 'Aankh Marey — Simmba', step: 'The wink, the point, the shoulder bounce', ...hookVideo('_KhQT-LGb-4', 12) },
  { level: 'easy', title: 'Badtameez Dil — Yeh Jawaani Hai Deewani', step: 'Ranbir’s loose, jumpy shuffle', ...hookVideo('II2EO3Nw4m0', 49) },
  { level: 'easy', title: 'Mauja Hi Mauja — Jab We Met', step: 'Arms up, full bhangra shoulders', ...hookVideo('PaDaoNnOQaM', 105) },
  { level: 'easy', title: 'Kala Chashma — Baar Baar Dekho', step: 'The squat-drop on “kala chashma”', ...hookVideo('k4yXQkG2s1E', 42) },
  { level: 'easy', title: 'Lungi Dance — Chennai Express', step: 'Twirl the (imaginary) lungi and swing those hips', ...hookVideo('fbwCgt1hMD4', 104) },
  { level: 'easy', title: 'Brown Rang — Yo Yo Honey Singh', step: 'Collar pop and swagger walk', ...hookVideo('iX4qQlm-0NY', 114) },
  { level: 'easy', title: 'Character Dheela — Ready', step: 'Salman’s lazy shoulder shimmy', ...hookVideo('ruEQPQX90fI', 153) },
  { level: 'easy', title: 'Gallan Goodiyaan — Dil Dhadakne Do', step: 'Bhangra shoulders, nonstop', ...hookVideo('jCEdTq3j-0U', 45) },
  { level: 'medium', title: 'Dus Bahane — Dus', step: 'The cool side-slide', ...hookVideo('qE3DfF66DNA', 75) },
  { level: 'medium', title: 'Soni De Nakhre — Partner', step: 'Govinda’s arms-and-hips comedy groove', ...hookVideo('GFljvZMZI0U', 98) },
  { level: 'medium', title: 'Aahun Aahun — Love Aaj Kal', step: 'Punjabi jumps and claps', ...hookVideo('Qk9bPR2wfJ4', 73) },
  { level: 'medium', title: 'Ainvayi Ainvayi — Band Baaja Baaraat', step: 'Ranveer’s wild wedding flail', ...hookVideo('pElk1ShPrcE', 91) },
  { level: 'medium', title: 'Angreji Beat — Gippy Grewal', step: 'Bhangra bounce with one arm up', ...hookVideo('YEf_hnXBbyI', 149) },
  { level: 'medium', title: 'Kar Gayi Chull — Kapoor & Sons', step: 'Fist-pump party bounce', ...hookVideo('NTHz9ephYTw', 18) },
  { level: 'medium', title: 'It’s The Time To Disco — Kal Ho Naa Ho', step: 'Retro disco finger-point', ...hookVideo('M03GOY5eINg', 144) },
  { level: 'medium', title: 'Pappu Can’t Dance — Jaane Tu... Ya Jaane Na', step: 'Dance as badly as Pappu, on purpose', ...hookVideo('dbdtBQ16CXc', 32) },
  { level: 'medium', title: 'Saturday Saturday — Humpty Sharma Ki Dulhania', step: 'Bouncy shoulder shrugs', ...hookVideo('OljkSVLIt6c', 152) },
  { level: 'medium', title: 'Amplifier — Imran Khan', step: 'Head-bob and arm swing', ...hookVideo('uuCFRaFWjwY', 98) },
  { level: 'medium', title: 'Baby Doll — Ragini MMS 2', step: 'The slow, smooth hip sway', ...hookVideo('yP9KiFTyBks', 30) },
  { level: 'medium', title: 'Dola Re Dola — Devdas', step: 'Hands up, spin and twirl', ...hookVideo('ORm16CK59_Q', 93) },
  { level: 'medium', title: 'Rowdy Baby — Maari 2', step: 'Dhanush & Sai Pallavi’s quick kicks', ...hookVideo('x6Q7c9RyMzk', 137) },
  { level: 'medium', title: 'Tamma Tamma Again — Badrinath Ki Dulhania', step: 'The hand-roll and shoulder bounce', ...hookVideo('EEX_XM6SxmY', 23) },
  { level: 'hard', title: 'O O Jaane Jaana — Pyaar Kiya To Darna Kya', step: 'Salman’s arm-wave (shirt optional)', ...hookVideo('x_elT6zkqN0', 47) },
  { level: 'hard', title: 'Fevicol Se — Dabangg 2', step: 'Kareena’s thumka, maximum attitude', ...hookVideo('zE7Pwgl6sLA', 37) },
  { level: 'hard', title: 'Dhinka Chika — Ready', step: 'The hop-shuffle, thumbs in the belt', ...hookVideo('p6D8u6lEDjQ', 58) },
  { level: 'hard', title: 'Hoth Rasiley — Welcome', step: 'The slow, sassy hip sway', ...hookVideo('VHxKSyiOxgE', 63) },
  { level: 'hard', title: 'Anarkali Disco Chali — Housefull 2', step: 'Thumka, twirl, repeat', ...hookVideo('sONw3dihCRs', 38) },
  { level: 'hard', title: 'Crazy Kiya Re — Dhoom 2', step: 'Aishwarya’s sharp pop-and-lock', ...hookVideo('J2Bh68GTUOU', 212) },
  { level: 'hard', title: 'Desi Boyz — Desi Boyz', step: 'Swagger walk to “make some noise”', ...hookVideo('lyWHtKq1PcQ', 50) },
  { level: 'hard', title: 'Lucky Boy — Bachna Ae Haseeno', step: 'Club bounce with finger guns', ...hookVideo('0AqZzax9_Og', 116) },
  { level: 'hard', title: 'Shut Up & Bounce — Dostana', step: 'Just bounce. Shut up and bounce.', ...hookVideo('0akqVN4ts0w', 164) },
  { level: 'hard', title: 'Proper Patola — Namaste England', step: 'Badshah-style bhangra shoulders', ...hookVideo('YmXJp4RtBCM', 31) },
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
  performSeconds: 25,
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
