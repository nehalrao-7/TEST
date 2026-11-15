// Dance-Off songs and the default game list. Questions live in bank.js.
//
// Each song links to its official video, starting a couple of seconds before its most-replayed
// moment (usually the chorus / signature move). `level` sets the order songs are drawn: easy, then medium, then hard.

const video = (id, t) => ({ youtube: `https://www.youtube.com/watch?v=${id}&t=${t}s`, clip: 25, showVideo: true });
const DANCE_SONGS = [
  { level: 'easy', title: 'Macarena — Los del Río', step: 'Arms out, flip, hands to head, hips, jump', ...video('zWaymcVmJ-A', 30) },
  { level: 'easy', title: 'Cha Cha Slide — DJ Casper', step: 'Do whatever the song tells you', ...video('wZv62ShoStY', 87) },
  { level: 'easy', title: 'Y.M.C.A. — Village People', step: 'Spell it out with your arms', ...video('QINoUyrP0BI', 41) },
  { level: 'easy', title: 'Gangnam Style — PSY', step: 'The invisible-horse gallop', ...video('9bZkp7q19f0', 66) },
  { level: 'easy', title: 'Uptown Funk — Mark Ronson ft. Bruno Mars', step: 'Strut, spin and point', ...video('OPf0YbXqDm0', 65) },
  { level: 'easy', title: 'Cupid Shuffle — Cupid', step: 'To the right, to the left, now kick', ...video('uPna1dIeUHQ', 79) },
  { level: 'easy', title: 'Baby Shark Dance — Pinkfong', step: 'Chomp with your arms', ...video('XqZsoesa55w', 10) },
  { level: 'easy', title: 'Happy — Pharrell Williams', step: 'Clap along and bounce', ...video('ZbZSe6N_BXs', 58) },
  { level: 'easy', title: 'Can’t Stop the Feeling! — Justin Timberlake', step: 'Shoulder groove and spin', ...video('ru0K8uYEZWw', 55) },
  { level: 'easy', title: 'Waka Waka — Shakira', step: 'Hip sway with arms to the side', ...video('pRpeEdMmmQ0', 61) },
  { level: 'medium', title: 'Single Ladies — Beyoncé', step: 'Flip the wrist and show the ring', ...video('4m1EFMoRFvY', 30) },
  { level: 'medium', title: 'Watch Me (Whip/Nae Nae) — Silento', step: 'Whip, then nae nae', ...video('vjW8wmF5VWc', 40) },
  { level: 'medium', title: 'Party Rock Anthem — LMFAO', step: 'The shuffle, every day', ...video('KQ6zr6kCPj8', 220) },
  { level: 'medium', title: 'Crank That — Soulja Boy', step: 'Superman that move', ...video('8UFIYGkROII', 40) },
  { level: 'medium', title: 'Hips Don’t Lie — Shakira', step: 'Let the hips do the talking', ...video('DUT5rEU6pqM', 60) },
  { level: 'medium', title: 'Shake It Off — Taylor Swift', step: 'Shake it, shake it off', ...video('nfWlot6h_JM', 45) },
  { level: 'medium', title: 'Dynamite — BTS', step: 'Disco points and a slide', ...video('gdZLi9oWNZg', 63) },
  { level: 'medium', title: 'Levitating — Dua Lipa', step: 'Floaty arm waves', ...video('TUVcZfQe-Kw', 50) },
  { level: 'medium', title: 'Old Town Road — Lil Nas X', step: 'Ride that horse', ...video('w2Ov5jzm3j8', 20) },
  { level: 'medium', title: 'Despacito — Luis Fonsi ft. Daddy Yankee', step: 'Slow, smooth salsa hips', ...video('kJQP7kiw5Fk', 80) },
  { level: 'hard', title: 'Bad Romance — Lady Gaga', step: 'Claws up, march and sway', ...video('qrO4YZeyl0I', 74) },
  { level: 'hard', title: 'Stayin’ Alive — Bee Gees', step: 'Point up, point down, strut', ...video('fNFzfwLM72c', 2) },
  { level: 'hard', title: 'Footloose — Kenny Loggins', step: 'Kick off your Sunday shoes', ...video('ltrMfT4Qz5Y', 45) },
  { level: 'hard', title: 'Gimme! Gimme! Gimme! — ABBA', step: 'Full disco diva', ...video('XEjLoHdbVeE', 60) },
  { level: 'hard', title: 'Toxic — Britney Spears', step: 'Sharp, sultry pop-and-lock', ...video('LOZuxwVk7TU', 66) },
  { level: 'hard', title: 'Bye Bye Bye — *NSYNC', step: 'Wave goodbye, puppet style', ...video('Eo-KmOd3i7s', 60) },
  { level: 'hard', title: 'Wannabe — Spice Girls', step: 'Zig-a-zig-ah attitude', ...video('gJLIiF15wjQ', 48) },
];
const songKey = (title) => String(title || '').split('—')[0].split('(')[0].trim().toLowerCase();
const LINKS = Object.fromEntries(DANCE_SONGS.map((s) => [songKey(s.title), { youtube: s.youtube, clip: s.clip, showVideo: true }]));

// Saved games keep host-written links. Songs that still match the default list pick up a link.
function applyHookVideos(content) {
  if (!content || !Array.isArray(content.songs)) return;
  for (const s of content.songs) {
    if (s.youtube) continue;
    const link = LINKS[songKey(s.title)];
    if (link) Object.assign(s, link);
  }
}

const hookstep = { performSeconds: 25, himmatBonus: 100, songs: DANCE_SONGS };

// The room's game list is built from the director's CATALOG; content is generated per room.
function defaultGames() {
  return require('./director').CATALOG.map((g) => ({ ...g, status: 'pending', content: null }));
}

const templates = { hookstep };

module.exports = { defaultGames, templates, applyHookVideos, DANCE_SONGS };
