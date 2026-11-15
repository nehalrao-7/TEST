// Pack format. Each line: "difficulty | question | right answer | wrong | wrong | wrong".
// Movie lines (Guess the Movie): "difficulty | emoji clue | right title | wrong | wrong | wrong".
// Difficulty: 1 very easy · 2 easy · 3 medium · 4 hard · 5 very hard.
const crypto = require('crypto');
const qid = (packId, text) => packId + ':' + crypto.createHash('sha1').update(text).digest('hex').slice(0, 8);

function parse(packId, block, kind) {
  return String(block || '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
    const parts = l.split('|').map((x) => x.trim());
    const d = Number(parts[0]);
    if (!(d >= 1 && d <= 5) || parts.length !== 6) throw new Error(`Bad line in pack ${packId}: ${l}`);
    const [, text, right, ...wrong] = parts;
    if (new Set([right, ...wrong].map((x) => x.toLowerCase())).size !== 4) throw new Error(`Duplicate option in pack ${packId}: ${l}`);
    return kind === 'movie'
      ? { id: qid(packId, 'movie:' + text), pack: packId, kind, d, q: 'Guess the movie!', clue: text, right, wrong }
      : { id: qid(packId, text), pack: packId, kind, d, q: text, right, wrong };
  });
}

function pack(meta, questions, movies) {
  const p = { ...meta, questions: parse(meta.id, questions, 'q'), movies: parse(meta.id, movies, 'movie') };
  const ids = new Set();
  for (const x of [...p.questions, ...p.movies]) { if (ids.has(x.id)) throw new Error(`Duplicate question in ${meta.id}: ${x.q} ${x.clue || ''}`); ids.add(x.id); }
  return p;
}

module.exports = { pack };
