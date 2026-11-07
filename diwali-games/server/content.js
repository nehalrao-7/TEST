// Sample content for every game. The host can edit all of it from the
// Host panel (Games → Edit content) without touching code.

const quiz = (q, options, answer, extra = {}) => ({ q, options, answer, time: 20, ...extra });

// Written for guests born 1995–2000 in the Indian-Canadian GTA crowd: Bollywood, desi TV,
// diaspora films, desi food, garba. Every question is Indian. No cricket.
// Hard but fair: every answer is something this room has seen, heard or danced to.
// Facts marked "HOST: confirm" in comments are local details worth a quick check.

const guessTheMovie = {
  questions: [
    quiz('Guess the movie!', ['Namastey London', 'Patiala House', 'Bend It Like Beckham', 'Bride & Prejudice'], 2, { clue: '⚽ 🥔 🥦 👧🏽 🇬🇧' }),
    quiz('Which of these was NOT filmed in Toronto?', ['Taal', 'Kal Ho Naa Ho', 'Kismat Konnection', 'Dhoom 3'], 3),
    quiz('Guess the movie!', ['Kabhi Alvida Naa Kehna', 'Kal Ho Naa Ho', 'New York', 'My Name Is Khan'], 1, { clue: '🗽 ❤️‍🩹 🩺 ⏳' }),
    quiz('The 2011 movie about a hockey team, shot in the GTA and backed by Akshay Kumar', ['Patiala House', 'Speedy Singhs', 'Chak De! India', 'Singh Is Kinng'], 1),
    quiz('Guess the movie!', ['Kabhi Khushi Kabhie Gham', 'Hum Saath-Saath Hain', 'Kal Ho Naa Ho', 'Baghban'], 0, { clue: '👨‍👩‍👦‍👦 🇬🇧 🚁 🏰' }),
    quiz('Guess the movie!', ['Kuch Kuch Hota Hai', 'Dilwale Dulhania Le Jayenge', 'Pardes', 'Mohabbatein'], 1, { clue: '🇬🇧 🚂 🌻 🇨🇭' }),
  ],
};

const kahoot = {
  questions: [
    quiz('On MSN Messenger, shaking your friend’s chat window was a…', ['Buzz', 'Poke', 'Nudge', 'Wink'], 2),
    quiz('Tulsi in Kyunki Saas Bhi Kabhi Bahu Thi was played by…', ['Shweta Tiwari', 'Sakshi Tanwar', 'Smriti Irani', 'Ekta Kapoor'], 2),
    quiz('CID: “Daya, ___ tod do!”', ['Darwaza', 'Taala', 'Khidki', 'Deewar'], 0),
    quiz('In Shaka Laka Boom Boom, Sanju’s magic object was a…', ['Paintbrush', 'Pencil', 'Chalk', 'Pen'], 1),
    quiz('“Main apni favourite hoon!” Which character made self-love look this cool?', ['Poo', 'Naina', 'Geet', 'Simran'], 2),
    quiz('Hrithik Roshan’s 2000 debut film was…', ['Fiza', 'Mission Kashmir', 'Kaho Naa... Pyaar Hai', 'Koi... Mil Gaya'], 2),
    quiz('In Main Hoon Na, Major Ram goes undercover as a…', ['Teacher', 'College student', 'Cook', 'Bodyguard'], 1),
    quiz('“21 din mein paisa double!” The Laxmi Chit Fund scam got Raju in which film?', ['Hera Pheri', 'Phir Hera Pheri', 'Welcome', 'Bhagam Bhag'], 1),
    quiz('“How’s the josh?” Which movie made this a national catchphrase?', ['Shershaah', 'Border', 'Uri: The Surgical Strike', 'Lakshya'], 2),
    quiz('“Dhoni finishes off in style!” That 2011 six won India which final?', ['1983 World Cup', '2007 T20 World Cup', '2011 ODI World Cup', '2013 Champions Trophy'], 2),
  ],
};

const jeopardy = {
  wrongPenalty: false,
  // The last category ("group: true") is swapped for questions about the guests when the
  // questionnaire has enough answers. It keeps its name; these clues are the fallback.
  categories: [
    { name: 'Filmy Chakkar', clues: [
      { value: 100, q: '“Kitne aadmi the?” — who’s asking?', a: 'Gabbar Singh (Sholay)' },
      { value: 200, q: '“Mogambo khush hua!” — name the film', a: 'Mr. India' },
      { value: 300, q: 'The 2003 film where Rohit befriends an alien', a: 'Koi... Mil Gaya' },
      { value: 400, q: '“Control Uday, control!” — which character made this a meme forever?', a: 'Majnu Bhai (Welcome)' },
      { value: 500, q: 'How many films have Akshay Kumar and Katrina Kaif starred in together?', a: '7 — Humko Deewana Kar Gaye, Namastey London, Welcome, Singh Is Kinng, De Dana Dan, Tees Maar Khan, Sooryavanshi (accept 6–8)' },
    ] },
    { name: 'Khaana Peena', clues: [
      { value: 100, q: 'Spongy, yellow, steamed Gujarati besan snack', a: 'Khaman' },
      { value: 200, q: 'Mango pulp served with puri in a Gujarati thali', a: 'Aamras' },
      { value: 300, q: 'The eggy-smelling salt that makes chaat taste like chaat', a: 'Kala namak' },
      { value: 400, q: 'On Dussehra, fafda is eaten with this sweet', a: 'Jalebi' },
      { value: 500, q: 'Undhiyu is the star dish of this festival', a: 'Uttarayan (Makar Sankranti)' },
    ] },
    { name: 'Mera Bharat Mahaan', clues: [
      { value: 100, q: 'Baroda’s legendary garba ground', a: 'United Way' },
      { value: 200, q: 'Known as the Pink City', a: 'Jaipur' },
      { value: 300, q: 'The Statue of Unity honours this leader', a: 'Sardar Vallabhbhai Patel' },
      { value: 400, q: 'The Rann of Kutch is a vast white desert of this', a: 'Salt' },
      { value: 500, q: 'Nickname of India’s first mission to Mars', a: 'Mangalyaan' },
    ] },
    { name: 'Screen Time Pass', clues: [
      { value: 100, q: '“Mihir is dead!” This serial made the whole country cry over one character', a: 'Kyunki Saas Bhi Kabhi Bahu Thi' },
      { value: 200, q: '“Just looking like a wow!” She became an overnight internet sensation', a: 'Jasmine Kaur' },
      { value: 300, q: 'The society where Jethalal lives with Tapu Sena and all his neighbours', a: 'Gokuldham Society' },
      { value: 400, q: 'Hasan Minhaj’s Netflix comedy news show that got cancelled', a: 'Patriot Act' },
      { value: 500, q: 'Mindy Kaling’s character on The Office', a: 'Kelly Kapoor' },
    ] },
    { name: 'Ad Break 📺', clues: [
      { value: 100, q: '“Washing powder ___, washing powder ___…” — name the brand', a: 'Nirma' },
      { value: 200, q: '“Daag achhe hain” — whose famous tagline?', a: 'Surf Excel' },
      { value: 300, q: '“Yeh ___ ka mazboot jod hai, tootega nahi!”', a: 'Fevicol' },
      { value: 400, q: 'An elephant, a wall, and cement so strong it became legendary. Which brand?', a: 'Ambuja Cement' },
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
      quiz('“Ye Baburao ka style hai!” — which film?', ['Welcome', 'Hera Pheri', 'Golmaal', 'Bhagam Bhag'], 1),
      quiz('An Iced Capp comes from…', ['Second Cup', 'Starbucks', 'Tim Hortons', 'McDonald’s'], 2),
    ] },
    { points: 200, questions: [
      quiz('Who sang “Tum Hi Ho” from Aashiqui 2?', ['Atif Aslam', 'Arijit Singh', 'KK', 'Sonu Nigam'], 1),
      quiz('Shah Rukh Khan’s Bandra home is called…', ['Jalsa', 'Galaxy', 'Prateeksha', 'Mannat'], 3),
    ] },
    { points: 300, safe: true, questions: [
      quiz('In Kuch Kuch Hota Hai, little Anjali is named after…', ['Rahul’s mother', 'Tina’s college friend', 'Rahul’s sister', 'A film star'], 1),
    ] },
    { points: 500, questions: [
      quiz('Which A.R. Rahman song won the 2009 Oscar?', ['Chaiyya Chaiyya', 'Jai Ho', 'Kun Faya Kun', 'Naatu Naatu'], 1),
      quiz('Before a Gujarati wedding begins, the bride’s mother welcomes the groom with…', ['Pithi', 'Mameru', 'Ponkvu', 'Saptapadi'], 2),
    ] },
    { points: 750, questions: [
      quiz('In Chak De! India, Kabir Khan coaches India’s women’s ___ team', ['Kabaddi', 'Football', 'Hockey', 'Volleyball'], 2),
      quiz('Garba star Atul Purohit is from which city?', ['Ahmedabad', 'Vadodara', 'Surat', 'Rajkot'], 1),
    ] },
    { points: 1000, safe: true, questions: [
      quiz('“Ek chutki sindoor ki keemat tum kya jaano…” — who?', ['Rahul babu', 'Ramesh babu', 'Raju babu', 'Mohan babu'], 1),
      quiz('“Kajra Re” got all three Bachchans on screen. Which film?', ['Kabhi Alvida Naa Kehna', 'Jhoom Barabar Jhoom', 'Bunty Aur Babli', 'Bluffmaster!'], 2),
    ] },
    { points: 1500, questions: [
      quiz('The red-and-white bangles worn by Punjabi brides are called…', ['Kaleere', 'Chooda', 'Payal', 'Kangan'], 1),
      quiz('How many zeros are in one crore?', ['5', '6', '7', '8'], 2),
    ] },
    { points: 2500, questions: [
      quiz('Tagore wrote India’s anthem and which other country’s?', ['Sri Lanka', 'Nepal', 'Bangladesh', 'Myanmar'], 2),
      quiz('Anant Ambani and Radhika Merchant’s 2024 pre-wedding bash was held in…', ['Udaipur', 'Jamnagar', 'Jodhpur', 'Lonavala'], 1),
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
