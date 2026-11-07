// Sample content for every game. The host can edit all of it from the
// Host panel (Games → Edit content) without touching code.

const quiz = (q, options, answer, extra = {}) => ({ q, options, answer, time: 20, ...extra });

// Written for guests born 1995–2000 in the Indian-Canadian GTA crowd: Bollywood, desi TV,
// diaspora films, desi food, garba. Every question is Indian. No cricket.
// Hard but fair: every answer is something this room has seen, heard or danced to.
// Facts marked "HOST: confirm" in comments are local details worth a quick check.

const guessTheMovie = {
  // Round two. Easy to hard. The last question is the Double Diya.
  questions: [
    quiz('Guess the movie!', ['Chillar Party', 'Stanley Ka Dabba', 'I Am Kalam', 'Taare Zameen Par'], 3, { clue: '🎨 🧒 🔤 🌟' }),
    quiz('Guess the movie!', ['Rockstar', 'Chennai Express', 'Jab We Met', 'Love Aaj Kal'], 2, { clue: '🚆 💁‍♀️ 💔 🏔️' }),
    quiz('Guess the movie!', ['Robot', 'PK', 'Ra.One', 'Krrish'], 1, { clue: '👽 📻 👂 🙏' }),
    quiz('Guess the movie!', ['Rock On!!', 'Rockstar', 'Aashiqui 2', 'Gully Boy'], 3, { clue: '🎤 🏙️ 🧢 🔥' }),
    quiz('Guess the movie!', ['Om Shanti Om', 'Karan Arjun', 'Main Hoon Na', 'Rab Ne Bana Di Jodi'], 0, { clue: '🎬 🔥 🔁 🌟' }),
    quiz('Guess the movie!', ['Piku', 'Barfi!', 'The Lunchbox', 'Masaan'], 2, { clue: '🍱 ✉️ 🚂 💌' }),
  ],
};

const kahoot = {
  // Round two. Easy to hard. The last question is the Double Diya.
  questions: [
    quiz('“Pushpa, I hate tears” — which superstar said it?', ['Rajesh Khanna', 'Dev Anand', 'Amitabh Bachchan', 'Dharmendra'], 0),
    quiz('“Bade bade deshon mein aisi chhoti chhoti baatein…” Which film?', ['Kuch Kuch Hota Hai', 'Dilwale Dulhania Le Jayenge', 'Pardes', 'Dil To Pagal Hai'], 1),
    quiz('In Taarak Mehta Ka Ooltah Chashmah, Jethalal’s wife is…', ['Babita', 'Anjali', 'Madhavi', 'Daya'], 3),
    quiz('On Orkut, messages left on someone’s profile were called…', ['Scraps', 'Pokes', 'Walls', 'Notes'], 0),
    quiz('“Mere paas maa hai!” Which film?', ['Deewaar', 'Sholay', 'Zanjeer', 'Trishul'], 0),
    quiz('Which Bollywood awards show came to Toronto in 2011?', ['IIFA', 'Filmfare', 'Zee Cine', 'Screen'], 0),
    quiz('Hum Paanch and Banegi Apni Baat aired on which channel?', ['Star Plus', 'Sony', 'Zee TV', 'DD National'], 2),
    quiz('In 3 Idiots, the real Rancho turns out to be…', ['Raju Rastogi', 'Chatur Ramalingam', 'Phunsukh Wangdu', 'Farhan Qureshi'], 2),
    quiz('Who played Don in the 2006 remake?', ['Amitabh Bachchan', 'Ranveer Singh', 'Hrithik Roshan', 'Shah Rukh Khan'], 3),
    quiz('Which Indo-Canadian director made “Fire” and “Water”?', ['Mira Nair', 'Gurinder Chadha', 'Deepa Mehta', 'Lilly Singh'], 2),
  ],
};

const jeopardy = {
  wrongPenalty: false,
  // The last category ("group: true") is swapped for questions about the guests when the
  // questionnaire has enough answers. It keeps its name; these clues are the fallback.
  categories: [
    { name: 'Dialogue Baazi', clues: [
      { value: 100, q: '“Rahul… naam toh suna hoga” — who says it?', a: 'Shah Rukh Khan' },
      { value: 200, q: '“Tension lene ka nahi, sirf dene ka” — which Bhai?', a: 'Munna Bhai' },
      { value: 300, q: '“Rishte mein toh hum tumhare baap lagte hain…” — name the film', a: 'Shahenshah' },
      { value: 400, q: '“Thappad se darr nahi lagta sahab, pyaar se lagta hai” — name the film', a: 'Dabangg' },
      { value: 500, q: '“Babumoshai, zindagi badi honi chahiye, lambi nahi” — name the film', a: 'Anand' },
    ] },
    { name: 'Chaat & Mithai', clues: [
      { value: 100, q: 'Hollow crispy puris filled with spicy tangy water', a: 'Pani puri / golgappa' },
      { value: 200, q: 'Diamond-shaped cashew sweet, often topped with silver varq', a: 'Kaju katli' },
      { value: 300, q: 'Gujarati dessert of strained yogurt with saffron and cardamom', a: 'Shrikhand' },
      { value: 400, q: 'Bengali sweet: soft chhena balls in light sugar syrup', a: 'Rasgulla' },
      { value: 500, q: 'Translucent sweet from Agra, made from ash gourd', a: 'Petha' },
    ] },
    { name: 'Desi Map', clues: [
      { value: 100, q: 'The Gateway of India stands in this city', a: 'Mumbai' },
      { value: 200, q: 'The Golden Temple is in this city', a: 'Amritsar' },
      { value: 300, q: "Gujarat's Gir Forest is the only wild home of these big cats", a: 'Asiatic lions' },
      { value: 400, q: "Gujarat's Somnath temple stands on the shore of this sea", a: 'Arabian Sea' },
      { value: 500, q: "Mainland India's southern tip, where three seas meet", a: 'Kanyakumari' },
    ] },
    { name: 'Bachpan Ke Din', clues: [
      { value: 100, q: 'Noodles that took "bas do minute"', a: 'Maggi' },
      { value: 200, q: 'The cat-and-mouse duo every desi kid watched on Cartoon Network', a: 'Tom and Jerry' },
      { value: 300, q: 'Bubblegum brand: "Big ___"', a: 'Big Babol' },
      { value: 400, q: 'Mukesh Khanna’s Doordarshan superhero', a: 'Shaktimaan' },
      { value: 500, q: 'Zee TV singing show Sonu Nigam hosted in the 90s', a: 'Sa Re Ga Ma (Pa)' },
    ] },
    { name: 'Gaana Bajana', clues: [
      { value: 100, q: 'The “Desi Girl” in Dostana’s hit song', a: 'Priyanka Chopra' },
      { value: 200, q: 'He sang the “Kal Ho Naa Ho” title track', a: 'Sonu Nigam' },
      { value: 300, q: 'He sang “Chaiyya Chaiyya” with Sapna Awasthi', a: 'Sukhwinder Singh' },
      { value: 400, q: 'Mumbai rapper behind “Mere Gully Mein” with Naezy', a: 'DIVINE' },
      { value: 500, q: 'Composer trio behind “Dil Chahta Hai” and “Kal Ho Naa Ho”', a: 'Shankar–Ehsaan–Loy' },
    ] },
    { name: 'Apni Toli', group: true, clues: [
      { value: 100, q: 'Navratri honours this goddess', a: 'Durga (Amba)' },
      { value: 200, q: 'The festival that comes the day after Navratri ends', a: 'Dussehra' },
      { value: 300, q: 'The lamp in a pierced clay pot that garba circles around', a: 'Garbo / garbi' },
      { value: 400, q: 'Mirrored, flared skirt-and-blouse worn for garba', a: 'Chaniya choli' },
      { value: 500, q: 'UNESCO added garba to this list in 2023', a: 'Intangible Cultural Heritage' },
    ] },
  ],
};

const kbc = {
  // Played in order, easy to hard. Each later correct answer is worth less, so speed matters.
  ladder: [
    { points: 100, questions: [
      quiz('Which fruit is called the “king of fruits” in India?', ['Mango', 'Banana', 'Guava', 'Lychee'], 0),
      quiz('Tim Hortons’ bite-sized doughnut holes are called…', ['Munchkins', 'Donettes', 'Timbits', 'Bites'], 2),
    ] },
    { points: 200, questions: [
      quiz('Which city is called the “Silicon Valley of India”?', ['Hyderabad', 'Pune', 'Bengaluru', 'Chennai'], 2),
      quiz('Who played Poo in Kabhi Khushi Kabhie Gham?', ['Kajol', 'Kareena Kapoor', 'Rani Mukerji', 'Preity Zinta'], 1),
    ] },
    { points: 300, safe: true, questions: [
      quiz('Ustad Zakir Hussain was a legend of which instrument?', ['Sitar', 'Sarod', 'Santoor', 'Tabla'], 3),
    ] },
    { points: 500, questions: [
      quiz('What is the capital of Gujarat?', ['Ahmedabad', 'Surat', 'Gandhinagar', 'Vadodara'], 2),
      quiz('Who won India’s javelin gold at the Tokyo 2020 Olympics?', ['Neeraj Chopra', 'Abhinav Bindra', 'P. V. Sindhu', 'Mirabai Chanu'], 0),
    ] },
    { points: 750, questions: [
      quiz('How many spokes does the Ashoka Chakra on India’s flag have?', ['12', '16', '24', '32'], 2),
      quiz('In the Mahabharata, who was Arjuna’s charioteer at Kurukshetra?', ['Bhishma', 'Krishna', 'Drona', 'Karna'], 1),
    ] },
    { points: 1000, safe: true, questions: [
      quiz('How many Vedas are there?', ['1', '2', '3', '4'], 3),
      quiz('Who directed Lagaan?', ['Ashutosh Gowariker', 'Rajkumar Hirani', 'Farhan Akhtar', 'Karan Johar'], 0),
    ] },
    { points: 1500, questions: [
      quiz('Which classical dance from Kerala is famous for its elaborate painted faces?', ['Bharatanatyam', 'Kathak', 'Kathakali', 'Odissi'], 2),
      quiz('Gandhi’s 1930 Salt March ended at which coastal village in Gujarat?', ['Dandi', 'Porbandar', 'Sabarmati', 'Surat'], 0),
    ] },
    { points: 2500, questions: [
      quiz('In which year did Satyajit Ray receive his honorary Oscar?', ['1985', '1992', '1999', '2004'], 1),
      quiz('The Kohinoor diamond was mined in which present-day Indian state?', ['Karnataka', 'Odisha', 'Madhya Pradesh', 'Andhra Pradesh'], 3),
    ] },
  ],
  fastestFinger: [
    quiz('Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Mercury', 'Jupiter'], 1, { time: 15 }),
    quiz('Ghee is made from…', ['Butter', 'Coconut', 'Mustard', 'Sesame'], 0, { time: 15 }),
    quiz('On which festival do sisters tie a rakhi?', ['Bhai Dooj', 'Karva Chauth', 'Raksha Bandhan', 'Teej'], 2, { time: 15 }),
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
