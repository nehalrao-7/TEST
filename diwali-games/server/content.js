// Sample content for every game. The host can edit all of it from the
// Host panel (Games → Edit content) without touching code.

const quiz = (q, options, answer, extra = {}) => ({ q, options, answer, time: 20, ...extra });

// Set 2 (round two of the party). Set 1 is in git history (commit 9447dbe).
const guessTheMovie = {
  questions: [
    quiz('Guess the movie!', ['Sholay', 'Deewaar', 'Shaan', 'Mr. Natwarlal'], 0, { clue: '🐎 🔫 🏜️ 👬' }),
    quiz('Guess the movie!', ['Krrish', 'Mr. India', 'Shahenshah', 'Agneepath'], 1, { clue: '⌚ 🫥 👧👦 😈' }),
    quiz('Guess the movie!', ['Chillar Party', 'Stanley Ka Dabba', 'I Am Kalam', 'Taare Zameen Par'], 3, { clue: '🎨 🧒 🔤 🌟' }),
    quiz('Guess the movie!', ['Rockstar', 'Chennai Express', 'Jab We Met', 'Love Aaj Kal'], 2, { clue: '🚆 💁‍♀️ 💔 🏔️' }),
    quiz('Guess the movie!', ['Rock On!!', 'Rockstar', 'Aashiqui 2', 'Gully Boy'], 3, { clue: '🎤 🏙️ 🧢 🔥' }),
    quiz('Guess the movie!', ['Devdas', 'Mughal-e-Azam', 'Umrao Jaan', 'Pakeezah'], 0, { clue: '🍷 🪔 💃 💔' }),
    quiz('Guess the movie!', ['Robot', 'PK', 'Ra.One', 'Koi... Mil Gaya'], 1, { clue: '👽 📻 👂 🙏' }),
    quiz('Guess the movie!', ['Golmaal', 'Dhamaal', 'Hera Pheri', 'Welcome'], 2, { clue: '☎️ 💸 👴👨👨 🤣' }),
    quiz('Guess the movie!', ['Karan Arjun', 'Main Hoon Na', 'Kal Ho Naa Ho', 'Om Shanti Om'], 3, { clue: '🎬 🔥 🔁 🌟' }),
    quiz('Guess the movie!', ['Pathaan', 'Jawan', 'Tiger 3', 'War'], 1, { clue: '👨‍🦲 🚇 👩‍👩‍👧‍👧 💣' }),
    quiz('Guess the movie!', ['Piku', 'Barfi!', 'The Lunchbox', 'Masaan'], 2, { clue: '🍱 ✉️ 🚂 💌' }),
    quiz('Guess the movie!', ['Laapataa Ladies', 'Bareilly Ki Barfi', 'Badhaai Ho', 'Stree 2'], 0, { clue: '👰 👰 🚂 🔍' }),
  ],
};

const kahoot = {
  questions: [
    quiz('The Gujarati New Year, the day after Diwali, is called…', ['Bestu Varas', 'Gudi Padwa', 'Ugadi', 'Baisakhi'], 0),
    quiz('Which brother went into exile with Lord Rama?', ['Bharata', 'Shatrughna', 'Sugriva', 'Lakshmana'], 3),
    quiz('Who flew across the sea to Lanka to find Sita?', ['Sugriva', 'Vali', 'Hanuman', 'Angada'], 2),
    quiz('Which of these is NOT one of the five days of Diwali?', ['Dhanteras', 'Bhai Dooj', 'Makar Sankranti', 'Lakshmi Puja'], 2),
    quiz('A “phuljhari” is better known in English as a…', ['Rocket', 'Flowerpot', 'Sparkler', 'Firecracker string'], 2),
    quiz('Which cracker spins round and round on the ground?', ['Chakri', 'Anar', 'Rocket', 'Phuljhari'], 0),
    quiz('Diwali night falls on which phase of the moon?', ['Full moon', 'New moon', 'Half moon', 'Blue moon'], 1),
    quiz('Which sweet is grated carrots slow-cooked in milk and ghee?', ['Gajar ka halwa', 'Kheer', 'Rabri', 'Shrikhand'], 0),
    quiz('Which Gujarati snack is a steamed, spongy gram-flour cake?', ['Khandvi', 'Thepla', 'Fafda', 'Dhokla'], 3),
    quiz('Mathiya and chorafali are crispy Diwali snacks from which state?', ['Punjab', 'Gujarat', 'Kerala', 'Bengal'], 1),
    quiz('In Bengal, Diwali night is celebrated with the worship of which goddess?', ['Lakshmi', 'Kali', 'Durga', 'Saraswati'], 1),
    quiz('“Deepavali” comes from Sanskrit and means…', ['Festival of sweets', 'Night of stars', 'Victory of good', 'Row of lamps'], 3),
  ],
};

const jeopardy = {
  wrongPenalty: false,
  categories: [
    { name: 'Filmy Dialogues', clues: [
      { value: 100, q: "'Kitne aadmi the?' — the Sholay villain who asks it", a: 'Gabbar Singh' },
      { value: 200, q: "'Bade bade deshon mein aisi chhoti chhoti baatein hoti rehti hain' — the actor who says it", a: 'Shah Rukh Khan (DDLJ)' },
      { value: 300, q: "'Rishte mein toh hum tumhare baap lagte hain…' — the actor who says it", a: 'Amitabh Bachchan (Shahenshah)' },
      { value: 400, q: "'Pushpa, I hate tears' — the superstar who said it in Amar Prem", a: 'Rajesh Khanna' },
      { value: 500, q: "'Mere paas maa hai' is the famous comeback in this 1975 film", a: 'Deewaar' },
    ] },
    { name: 'Chaat & Mithai', clues: [
      { value: 100, q: 'Hollow crispy puris filled with spicy tangy water', a: 'Pani puri / golgappa' },
      { value: 200, q: 'Diamond-shaped cashew sweet, often topped with silver varq', a: 'Kaju katli' },
      { value: 300, q: 'Gujarati dessert of strained yogurt with saffron and cardamom', a: 'Shrikhand' },
      { value: 400, q: 'Bengali sweet: soft chhena balls in light sugar syrup', a: 'Rasgulla' },
      { value: 500, q: 'Translucent sweet from Agra, made from ash gourd', a: 'Petha' },
    ] },
    { name: 'IPL & Cricket', clues: [
      { value: 100, q: "MS Dhoni's IPL team, nicknamed the 'Yellow Army'", a: 'Chennai Super Kings' },
      { value: 200, q: 'The only IPL team Virat Kohli has ever played for', a: 'Royal Challengers Bengaluru (RCB)' },
      { value: 300, q: 'Year India won the very first T20 World Cup', a: '2007' },
      { value: 400, q: 'Indian batter who holds the highest ODI score, 264', a: 'Rohit Sharma' },
      { value: 500, q: 'Indian bowler who took all 10 wickets in a Test innings vs Pakistan in 1999', a: 'Anil Kumble' },
    ] },
    { name: 'Garba Nights', clues: [
      { value: 100, q: 'Navratri lasts this many nights', a: 'Nine' },
      { value: 200, q: 'Dance played with pairs of decorated sticks', a: 'Dandiya raas' },
      { value: 300, q: 'Goddess whose nine forms are worshipped during Navratri', a: 'Durga (Navadurga)' },
      { value: 400, q: 'Garba is danced in a circle around this: a lamp inside a pierced clay pot', a: 'The garbo / garbi (garba deep)' },
      { value: 500, q: "Singer famously called the 'Dandiya Queen'", a: 'Falguni Pathak' },
    ] },
    { name: 'Desi Geography', clues: [
      { value: 100, q: 'The Gateway of India stands in this city', a: 'Mumbai' },
      { value: 200, q: 'Holy river that flows past Varanasi', a: 'Ganga (Ganges)' },
      { value: 300, q: "Gujarat's Gir Forest is the only wild home of these big cats", a: 'Asiatic lions' },
      { value: 400, q: "The Statue of Unity, the world's tallest statue, depicts this leader", a: 'Sardar Vallabhbhai Patel' },
      { value: 500, q: "Mainland India's southern tip, where three seas meet", a: 'Kanyakumari' },
    ] },
  ],
};

const kbc = {
  // Each level has a points prize; 'safe' levels are guaranteed once crossed.
  // Each level has several questions so multiple hot-seat players get fresh ones.
  ladder: [
    { points: 100, questions: [
      quiz('Which fruit is called the “king of fruits” in India?', ['Mango', 'Banana', 'Guava', 'Lychee'], 0),
      quiz('What is the national bird of India?', ['Parrot', 'Sparrow', 'Eagle', 'Peacock'], 3),
    ] },
    { points: 200, questions: [
      quiz('Which city is called the “Silicon Valley of India”?', ['Hyderabad', 'Pune', 'Bengaluru', 'Chennai'], 2),
      quiz('Garba comes from which state?', ['Gujarat', 'Rajasthan', 'Maharashtra', 'Punjab'], 0),
    ] },
    { points: 300, safe: true, questions: [
      quiz('Who played Mastani in “Bajirao Mastani”?', ['Priyanka Chopra', 'Deepika Padukone', 'Katrina Kaif', 'Alia Bhatt'], 1),
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
      quiz('Which sage is credited with composing the Mahabharata?', ['Valmiki', 'Ved Vyasa', 'Vishwamitra', 'Vashistha'], 1),
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
    quiz('How many coloured stripes are on India’s flag?', ['2', '3', '4', '5'], 1, { time: 15 }),
    quiz('Ghee is made from…', ['Butter', 'Coconut', 'Mustard', 'Sesame'], 0, { time: 15 }),
    quiz('On which festival do sisters tie a rakhi?', ['Bhai Dooj', 'Karva Chauth', 'Raksha Bandhan', 'Teej'], 2, { time: 15 }),
    quiz('Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Mercury', 'Jupiter'], 1, { time: 15 }),
    quiz('How many sides does a hexagon have?', ['8', '7', '6', '5'], 2, { time: 15 }),
  ],
};

const hookstep = {
  performSeconds: 45,
  himmatBonus: 100,
  songs: [
    { title: 'Naatu Naatu — RRR', step: 'The lightning foot shuffle, arms on each other’s shoulders' },
    { title: 'Lungi Dance — Chennai Express', step: 'Twirl the (imaginary) lungi and swing those hips' },
    { title: 'Kala Chashma — Baar Baar Dekho', step: 'The big squat-drop on “kala chashma jachda”' },
    { title: 'Srivalli — Pushpa', step: 'The swagger walk with one slipper dragging' },
    { title: 'Tamma Tamma Again — Badrinath Ki Dulhania', step: 'The hand-roll and shoulder bounce' },
    { title: 'Chaiyya Chaiyya — Dil Se', step: 'Groove like you’re on top of a moving train' },
    { title: 'Gallan Goodiyaan — Dil Dhadakne Do', step: 'Full bhangra shoulders, nonstop' },
    { title: 'Butta Bomma — Ala Vaikunthapurramuloo', step: 'The smooth side-step shuffle' },
    { title: 'Jhoome Jo Pathaan — Pathaan', step: 'The arm-flip and lean-back hook' },
    { title: 'London Thumakda — Queen', step: 'Maximum thumkas, wedding-style' },
  ],
};

function defaultGames() {
  return [
    { id: 'g1', type: 'quiz', title: 'Guess the Movie', emoji: '🎬', mode: 'team', status: 'pending', content: guessTheMovie },
    { id: 'g2', type: 'hookstep', title: 'Hook Step Challenge', emoji: '💃', mode: 'team', status: 'pending', content: hookstep },
    { id: 'g3', type: 'jeopardy', title: 'Desi Jeopardy', emoji: '🧠', mode: 'team', status: 'pending', content: jeopardy },
    { id: 'g4', type: 'quiz', title: 'Diwali Kahoot', emoji: '⚡', mode: 'individual', status: 'pending', content: kahoot },
    { id: 'g5', type: 'kbc', title: 'Kaun Banega Crorepati', emoji: '💰', mode: 'individual', status: 'pending', content: kbc },
  ];
}

const templates = { quiz: kahoot, jeopardy, kbc, hookstep, custom: { description: 'Host awards points manually.' } };

module.exports = { defaultGames, templates };
