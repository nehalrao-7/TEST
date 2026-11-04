// Sample content for every game. The host can edit all of it from the
// Host panel (Games → Edit content) without touching code.

const quiz = (q, options, answer, extra = {}) => ({ q, options, answer, time: 20, ...extra });

const guessTheMovie = {
  questions: [
    quiz('Guess the movie!', ['Kuch Kuch Hota Hai', 'Dilwale Dulhania Le Jayenge', 'Veer-Zaara', 'Kabhi Khushi Kabhie Gham'], 1, { clue: '🚂 👫 🌻 🇨🇭' }),
    quiz('Guess the movie!', ['Lagaan', 'Chak De! India', 'Iqbal', '83'], 0, { clue: '🏏 🇬🇧 💰 🌧️' }),
    quiz('Guess the movie!', ['Munna Bhai MBBS', 'Chhichhore', '3 Idiots', 'Student of the Year'], 2, { clue: '🎓 🔧 💡 😂 👬👦' }),
    quiz('Guess the movie!', ['Sultan', 'Dangal', 'Mary Kom', 'Gold'], 1, { clue: '🤼‍♀️ 👨‍👧‍👧 🥇' }),
    quiz('Guess the movie!', ['Kal Ho Naa Ho', 'Kabhi Khushi Kabhie Gham', 'Hum Saath-Saath Hain', 'Baghban'], 1, { clue: '👨‍👩‍👧‍👦 🚁 🏰 ❤️' }),
    quiz('Guess the movie!', ['Baahubali', 'Padmaavat', 'Bajirao Mastani', 'Jodhaa Akbar'], 0, { clue: '💧 ⛰️ 🗡️ 👑' }),
    quiz('Guess the movie!', ['Paan Singh Tomar', 'M.S. Dhoni', 'Bhaag Milkha Bhaag', 'Chak De! India'], 2, { clue: '🏃‍♂️ 🇮🇳 🥇 ⏱️' }),
    quiz('Guess the movie!', ['Krrish', 'Koi... Mil Gaya', 'PK', 'Ra.One'], 1, { clue: '👽 📞 🌟 🧒' }),
    quiz('Guess the movie!', ['Dil Chahta Hai', 'Zindagi Na Milegi Dobara', 'Yeh Jawaani Hai Deewani', 'Queen'], 1, { clue: '🚗 🇪🇸 👬👦 🤿' }),
    quiz('Guess the movie!', ['KGF', 'Pushpa', 'RRR', 'Kantara'], 2, { clue: '🔥 💧 🤝 🏍️' }),
    quiz('Guess the movie!', ['Drishyam', 'Andhadhun', 'Kahaani', 'Talaash'], 1, { clue: '🧑‍🦯 🎹 🔫 🐇' }),
    quiz('Guess the movie!', ['Stree', 'Bhool Bhulaiyaa', 'Raaz', 'Tumbbad'], 1, { clue: '🏰 👻 💃 🔒' }),
  ],
};

const kahoot = {
  questions: [
    quiz('Diwali is popularly known as the festival of…', ['Colours', 'Lights', 'Kites', 'Harvest'], 1),
    quiz('Diwali celebrates whose return to Ayodhya?', ['Lord Krishna', 'Lord Shiva', 'Lord Rama', 'Lord Ganesha'], 2),
    quiz('How many years of exile did Lord Rama complete?', ['7', '10', '12', '14'], 3),
    quiz('Which goddess of wealth is worshipped on Diwali night?', ['Saraswati', 'Lakshmi', 'Durga', 'Parvati'], 1),
    quiz('Choti Diwali is also called…', ['Dhanteras', 'Bhai Dooj', 'Naraka Chaturdashi', 'Govardhan Puja'], 2),
    quiz('The small clay oil lamps lit on Diwali are called…', ['Diyas', 'Torans', 'Kalash', 'Kandils'], 0),
    quiz('Colourful patterns made on the floor at the entrance are called…', ['Mehndi', 'Rangoli', 'Alpana Dance', 'Kolam Chai'], 1),
    quiz('Which festival celebrating siblings comes two days after Diwali?', ['Raksha Bandhan', 'Karva Chauth', 'Bhai Dooj', 'Teej'], 2),
    quiz('Sikhs celebrate Bandi Chhor Divas, marking the release of which Guru?', ['Guru Nanak', 'Guru Hargobind', 'Guru Gobind Singh', 'Guru Arjan'], 1),
    quiz('For Jains, Diwali marks the nirvana of…', ['Mahavira', 'Parshvanatha', 'Rishabhanatha', 'Neminatha'], 0),
    quiz('Which sweet is deep-fried milk-solid balls soaked in sugar syrup?', ['Rasgulla', 'Jalebi', 'Gulab Jamun', 'Barfi'], 2),
    quiz('On Dhanteras, people traditionally buy…', ['New shoes', 'Gold, silver or utensils', 'Books', 'Plants'], 1),
  ],
};

const jeopardy = {
  wrongPenalty: false,
  categories: [
    { name: 'Bollywood Songs', clues: [
      { value: 100, q: "'Tujhe Dekha To' is from this 1995 blockbuster", a: 'Dilwale Dulhania Le Jayenge' },
      { value: 200, q: 'This song from RRR won the Oscar for Best Original Song', a: 'Naatu Naatu' },
      { value: 300, q: "'Chaiyya Chaiyya' was shot on top of a moving train in this film", a: 'Dil Se' },
      { value: 400, q: "'London Thumakda' is from this Kangana Ranaut film", a: 'Queen' },
      { value: 500, q: "'Badtameez Dil' is from this Ranbir–Deepika film", a: 'Yeh Jawaani Hai Deewani' },
    ] },
    { name: 'Desi Food', clues: [
      { value: 100, q: 'Thin, crispy South Indian rice-and-lentil crepe', a: 'Dosa' },
      { value: 200, q: 'Indian cottage cheese', a: 'Paneer' },
      { value: 300, q: 'The spice that makes haldi doodh golden', a: 'Turmeric (haldi)' },
      { value: 400, q: "Mumbai's spiced potato fritter in a bun", a: 'Vada Pav' },
      { value: 500, q: 'Hyderabad is world-famous for this layered rice dish', a: 'Biryani' },
    ] },
    { name: 'Cricket Fever', clues: [
      { value: 100, q: 'Number of balls in an over', a: '6' },
      { value: 200, q: 'Nickname of Sachin Tendulkar', a: 'The Master Blaster' },
      { value: 300, q: 'Year India won its first Cricket World Cup', a: '1983' },
      { value: 400, q: 'Indian captain who hit the winning six in the 2011 World Cup final', a: 'MS Dhoni' },
      { value: 500, q: 'Captain of the 1983 World Cup–winning team', a: 'Kapil Dev' },
    ] },
    { name: 'Incredible India', clues: [
      { value: 100, q: 'The Taj Mahal is in this city', a: 'Agra' },
      { value: 200, q: 'Known as the Pink City', a: 'Jaipur' },
      { value: 300, q: "State nicknamed 'God's Own Country'", a: 'Kerala' },
      { value: 400, q: 'Called the City of Joy', a: 'Kolkata' },
      { value: 500, q: 'The Konark Sun Temple is in this state', a: 'Odisha' },
    ] },
    { name: 'Diwali Lore', clues: [
      { value: 100, q: 'The five-day festival begins with this day of buying gold and utensils', a: 'Dhanteras' },
      { value: 200, q: 'Goddess who is welcomed home with lamps and open doors', a: 'Lakshmi' },
      { value: 300, q: 'Demon defeated by Krishna, celebrated on Choti Diwali', a: 'Narakasura' },
      { value: 400, q: 'Hill Krishna lifted on his little finger, celebrated the day after Diwali', a: 'Govardhan' },
      { value: 500, q: 'Ravana ruled this island kingdom', a: 'Lanka' },
    ] },
  ],
};

const kbc = {
  // Each level has a points prize; 'safe' levels are guaranteed once crossed.
  // Each level has several questions so multiple hot-seat players get fresh ones.
  ladder: [
    { points: 100, questions: [
      quiz('Which animal is Lord Ganesha’s vehicle?', ['Peacock', 'Mouse', 'Bull', 'Swan'], 1),
      quiz('Which of these is a popular Diwali sweet?', ['Kaju Katli', 'Croissant', 'Brownie', 'Macaron'], 0),
    ] },
    { points: 200, questions: [
      quiz('Goddess Lakshmi is usually shown seated on a…', ['Tiger', 'Lotus', 'Peacock', 'Swan'], 1),
      quiz('What is the national animal of India?', ['Lion', 'Elephant', 'Tiger', 'Peacock'], 2),
    ] },
    { points: 300, safe: true, questions: [
      quiz("Which actor is popularly called 'King Khan'?", ['Salman Khan', 'Aamir Khan', 'Shah Rukh Khan', 'Saif Ali Khan'], 2),
      quiz('Which city is Lord Rama’s birthplace?', ['Mathura', 'Ayodhya', 'Varanasi', 'Ujjain'], 1),
    ] },
    { points: 500, questions: [
      quiz('India’s first mission to Mars is called…', ['Chandrayaan', 'Gaganyaan', 'Mangalyaan', 'Aditya-L1'], 2),
      quiz('Who wrote India’s national anthem?', ['Bankim Chandra Chatterjee', 'Rabindranath Tagore', 'Sarojini Naidu', 'Muhammad Iqbal'], 1),
    ] },
    { points: 750, questions: [
      quiz('In 2023, Chandrayaan-3 landed near which region of the Moon?', ['North pole', 'Equator', 'South pole', 'Far side'], 2),
      quiz('Which Mughal emperor built the Taj Mahal?', ['Akbar', 'Shah Jahan', 'Aurangzeb', 'Babur'], 1),
    ] },
    { points: 1000, safe: true, questions: [
      quiz('Sita’s father, King Janaka, ruled which kingdom?', ['Kosala', 'Magadha', 'Mithila', 'Panchala'], 2),
      quiz('Which of Ravana’s brothers joined Lord Rama?', ['Kumbhakarna', 'Vibhishana', 'Indrajit', 'Khara'], 1),
    ] },
    { points: 1500, questions: [
      quiz('Who wrote the original Ramayana in Sanskrit?', ['Tulsidas', 'Ved Vyasa', 'Kalidasa', 'Valmiki'], 3),
      quiz('Tulsidas wrote the Ramcharitmanas in which language?', ['Sanskrit', 'Awadhi', 'Braj Bhasha', 'Maithili'], 1),
    ] },
    { points: 2500, questions: [
      quiz('Which was the first Indian film nominated for the Best Foreign Language Film Oscar?', ['Pather Panchali', 'Mother India', 'Salaam Bombay!', 'Lagaan'], 1),
      quiz("Whose court was famous for its 'Navratnas' (nine gems)?", ['Jahangir', 'Humayun', 'Akbar', 'Shah Jahan'], 2),
    ] },
  ],
  fastestFinger: [
    quiz('How many days does the Diwali festival traditionally span?', ['1', '3', '5', '7'], 2, { time: 15 }),
    quiz('Paneer is made from…', ['Soy', 'Milk', 'Rice', 'Lentils'], 1, { time: 15 }),
    quiz('Which festival is called the festival of colours?', ['Diwali', 'Holi', 'Onam', 'Pongal'], 1, { time: 15 }),
    quiz('Which is the largest planet in our solar system?', ['Saturn', 'Earth', 'Jupiter', 'Neptune'], 2, { time: 15 }),
    quiz('How many players does a cricket team field?', ['9', '10', '11', '12'], 2, { time: 15 }),
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
