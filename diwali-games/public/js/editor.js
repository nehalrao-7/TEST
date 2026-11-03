/* Host "Questions" tab: every game's content as editable forms on one page. */
(function () {
  const { esc, letters } = App;

  function createEditor({ send, toast, rerender }) {
    const drafts = {}; // gid -> { title, emoji, mode, content, dirty }
    const collapsed = new Set();
    let qDraft = { prompts: [], dirty: false };
    let S = null;

    const clone = (x) => JSON.parse(JSON.stringify(x));
    function sync(state) {
      S = state;
      const ids = new Set(S.gamesFull.map((g) => g.id));
      for (const g of S.gamesFull) {
        if (!drafts[g.id] || !drafts[g.id].dirty) drafts[g.id] = { title: g.title, emoji: g.emoji, mode: g.mode, personalize: g.personalize !== false, content: clone(g.content), dirty: false };
      }
      if (!qDraft.dirty) qDraft = { prompts: clone(S.questionnaire), dirty: false };
      for (const k of Object.keys(drafts)) if (!ids.has(k)) delete drafts[k];
    }

    // ---------- path helpers ----------
    const getAt = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
    function setAt(obj, path, val) {
      const keys = path.split('.');
      let o = obj;
      keys.slice(0, -1).forEach((k, i) => { if (o[k] == null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {}; o = o[k]; });
      o[keys[keys.length - 1]] = val;
    }
    const field = (gid, path, val, { ph = '', type = 'text', cls = '', kind = 'text', style = '' } = {}) =>
      `<input type="${type}" class="${cls}" style="${style}" data-eg="${gid}" data-ep="${path}" data-ek="${kind}" value="${esc(val == null ? '' : val)}" placeholder="${esc(ph)}"/>`;
    const check = (gid, path, val, label) => `<label class="toggle small"><input type="checkbox" data-eg="${gid}" data-ep="${path}" data-ek="bool" ${val ? 'checked' : ''}/> ${label}</label>`;
    const btn = (act, label, data = '', cls = 'ghost small') => `<button class="btn ${cls}" data-ea="${act}" ${data}>${label}</button>`;

    function ytHint(item) {
      if (!item.youtube) return '';
      const p = window.parseYouTube(item.youtube, item.clip);
      if (!p) return `<span class="yt-bad">✗ not a YouTube link</span>`;
      const link = `https://www.youtube.com/watch?v=${p.videoId}&t=${p.start}s`;
      return `<span class="yt-ok">✓ plays from ${window.fmtTime(p.start)}${p.end ? ' to ' + window.fmtTime(p.end) : ''}</span> <a href="${link}" target="_blank" rel="noopener">preview ↗</a>`;
    }
    function mediaRow(gid, base, item, { showVideo = true } = {}) {
      return `<div class="qe-media">🎵 ${field(gid, base + '.youtube', item.youtube, { ph: 'YouTube link with timestamp (optional) — e.g. https://youtu.be/abc?t=75', cls: 'grow' })}
        ${field(gid, base + '.clip', item.clip, { ph: 'play for (s)', type: 'number', kind: 'num', style: 'width:120px' })}
        ${showVideo ? check(gid, base + '.showVideo', item.showVideo, 'show video') : ''}
        <span class="qe-yt">${ytHint(item)}</span></div>`;
    }

    // A multiple-choice question block (quiz, fastest finger, KBC).
    function qBlock(gid, base, q, idx, total, { clue = false, time = false, image = false, listPath }) {
      const opts = [0, 1, 2, 3].map((i) => `<label class="qe-opt ${q.answer === i ? 'right' : ''}">
          <input type="radio" name="ans-${gid}-${base}" data-eg="${gid}" data-ep="${base}.answer" data-ek="num" value="${i}" ${q.answer === i ? 'checked' : ''} title="Mark as correct"/>
          <span class="k">${letters[i]}</span>${field(gid, `${base}.options.${i}`, (q.options || [])[i], { ph: `Option ${letters[i]}` })}</label>`).join('');
      return `<div class="qe">
        <div class="qe-head"><b class="qe-n">${idx + 1}</b>${field(gid, base + '.q', q.q, { ph: 'Question text', cls: 'grow qe-q' })}
          ${btn('move', '↑', `data-eg="${gid}" data-list="${listPath}" data-i="${idx}" data-d="-1" ${idx === 0 ? 'disabled' : ''}`)}
          ${btn('move', '↓', `data-eg="${gid}" data-list="${listPath}" data-i="${idx}" data-d="1" ${idx === total - 1 ? 'disabled' : ''}`)}
          ${btn('del', '🗑', `data-eg="${gid}" data-list="${listPath}" data-i="${idx}"`)}</div>
        ${clue || time || image ? `<div class="qe-row">${clue ? `<span class="qe-l">Clue</span>${field(gid, base + '.clue', q.clue, { ph: 'Emoji / text clue shown big on TV (optional)', cls: 'grow' })}` : ''}
          ${time ? `<span class="qe-l">⏱</span>${field(gid, base + '.time', q.time, { type: 'number', kind: 'num', ph: 'sec', style: 'width:80px' })}` : ''}
          ${image ? `<span class="qe-l">🖼</span>${field(gid, base + '.image', q.image, { ph: 'Image URL (optional)', style: 'flex:1 1 160px' })}` : ''}</div>` : ''}
        <div class="qe-opts">${opts}</div>
        ${mediaRow(gid, base, q)}
      </div>`;
    }

    // ---------- per-type editors ----------
    function quizEditor(gid, c) {
      const qs = c.questions || [];
      return `${qs.map((q, i) => qBlock(gid, `questions.${i}`, q, i, qs.length, { clue: true, time: true, image: true, listPath: 'questions' })).join('')}
        ${btn('addQ', '+ Add question', `data-eg="${gid}" data-list="questions" data-tpl="quiz"`, 'teal small')}`;
    }

    function jeopardyEditor(gid, c) {
      const cats = c.categories || [];
      return `<div class="qe-row">${check(gid, 'wrongPenalty', c.wrongPenalty, 'Wrong answers lose points')}</div>
        ${cats.map((cat, ci) => `<div class="qe">
          <div class="qe-head"><b class="qe-n">${ci + 1}</b>${field(gid, `categories.${ci}.name`, cat.name, { ph: 'Category name', cls: 'grow qe-q' })}
            ${btn('move', '←', `data-eg="${gid}" data-list="categories" data-i="${ci}" data-d="-1" ${ci === 0 ? 'disabled' : ''}`)}
            ${btn('move', '→', `data-eg="${gid}" data-list="categories" data-i="${ci}" data-d="1" ${ci === cats.length - 1 ? 'disabled' : ''}`)}
            ${btn('del', '🗑 Category', `data-eg="${gid}" data-list="categories" data-i="${ci}"`)}</div>
          ${(cat.clues || []).map((cl, i) => `<div class="qe-clue">
            <div class="qe-row">${field(gid, `categories.${ci}.clues.${i}.value`, cl.value, { type: 'number', kind: 'num', ph: 'pts', style: 'width:90px' })}
              ${field(gid, `categories.${ci}.clues.${i}.q`, cl.q, { ph: 'Clue (shown on TV)', cls: 'grow' })}
              ${field(gid, `categories.${ci}.clues.${i}.a`, cl.a, { ph: 'Answer (host only until revealed)', style: 'flex:1 1 180px' })}
              ${btn('del', '🗑', `data-eg="${gid}" data-list="categories.${ci}.clues" data-i="${i}"`)}</div>
            ${mediaRow(gid, `categories.${ci}.clues.${i}`, cl)}</div>`).join('')}
          ${btn('addQ', '+ Add clue', `data-eg="${gid}" data-list="categories.${ci}.clues" data-tpl="clue"`, 'teal small')}
        </div>`).join('')}
        ${btn('addQ', '+ Add category', `data-eg="${gid}" data-list="categories" data-tpl="category"`, 'teal small')}`;
    }

    function kbcEditor(gid, c) {
      const ff = c.fastestFinger || [];
      const ladder = c.ladder || [];
      return `<div class="sec-title">⚡ Fastest Finger First</div>
        ${ff.map((q, i) => qBlock(gid, `fastestFinger.${i}`, q, i, ff.length, { time: true, listPath: 'fastestFinger' })).join('')}
        ${btn('addQ', '+ Add Fastest Finger question', `data-eg="${gid}" data-list="fastestFinger" data-tpl="ff"`, 'teal small')}
        <div class="sec-title">🪜 Prize ladder (each hot-seat player gets the next question on every level)</div>
        ${ladder.map((lvl, li) => `<div class="qe qe-level">
          <div class="qe-head"><b class="qe-n">L${li + 1}</b><span class="qe-l">Points</span>${field(gid, `ladder.${li}.points`, lvl.points, { type: 'number', kind: 'num', style: 'width:120px' })}
            ${check(gid, `ladder.${li}.safe`, lvl.safe, '★ Safe level')}<span class="grow"></span>
            ${btn('del', '🗑 Level', `data-eg="${gid}" data-list="ladder" data-i="${li}"`)}</div>
          ${(lvl.questions || []).map((q, i) => qBlock(gid, `ladder.${li}.questions.${i}`, q, i, lvl.questions.length, { listPath: `ladder.${li}.questions` })).join('')}
          ${btn('addQ', '+ Add question to this level', `data-eg="${gid}" data-list="ladder.${li}.questions" data-tpl="mcq"`, 'teal small')}
        </div>`).join('')}
        ${btn('addQ', '+ Add level', `data-eg="${gid}" data-list="ladder" data-tpl="level"`, 'teal small')}`;
    }

    function hookEditor(gid, c) {
      const songs = c.songs || [];
      return `<div class="qe-row"><span class="qe-l">Performance time (s)</span>${field(gid, 'performSeconds', c.performSeconds, { type: 'number', kind: 'num', style: 'width:90px' })}
          <span class="qe-l">Voting time (s)</span>${field(gid, 'votingSeconds', c.votingSeconds, { type: 'number', kind: 'num', style: 'width:90px' })}</div>
        <p class="small muted">The song's YouTube clip plays on the TV while the performer is dancing, starting at the link's timestamp.</p>
        ${songs.map((s, i) => `<div class="qe">
          <div class="qe-head"><b class="qe-n">${i + 1}</b>${field(gid, `songs.${i}.title`, s.title, { ph: 'Song — Movie', cls: 'grow qe-q' })}
            ${btn('move', '↑', `data-eg="${gid}" data-list="songs" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}`)}
            ${btn('move', '↓', `data-eg="${gid}" data-list="songs" data-i="${i}" data-d="1" ${i === songs.length - 1 ? 'disabled' : ''}`)}
            ${btn('del', '🗑', `data-eg="${gid}" data-list="songs" data-i="${i}"`)}</div>
          <div class="qe-row"><span class="qe-l">Hook step</span>${field(gid, `songs.${i}.step`, s.step, { ph: 'Describe the signature move', cls: 'grow' })}</div>
          ${mediaRow(gid, `songs.${i}`, s)}</div>`).join('')}
        ${btn('addQ', '+ Add song', `data-eg="${gid}" data-list="songs" data-tpl="song"`, 'teal small')}`;
    }

    function customEditor(gid, c) {
      return `<label class="field">Description shown on the TV</label><textarea data-eg="${gid}" data-ep="description" data-ek="text" style="min-height:80px;font-family:var(--font)">${esc(c.description || '')}</textarea>`;
    }

    const TEMPLATES = {
      quiz: () => ({ q: '', options: ['', '', '', ''], answer: 0, time: 20 }),
      ff: () => ({ q: '', options: ['', '', '', ''], answer: 0, time: 15 }),
      mcq: () => ({ q: '', options: ['', '', '', ''], answer: 0 }),
      clue: (list) => ({ value: ((list[list.length - 1] || {}).value || 0) + 100, q: '', a: '' }),
      category: () => ({ name: 'New category', clues: [100, 200, 300, 400, 500].map((v) => ({ value: v, q: '', a: '' })) }),
      level: (list) => ({ points: ((list[list.length - 1] || {}).points || 0) * 2 || 100, questions: [{ q: '', options: ['', '', '', ''], answer: 0 }] }),
      song: () => ({ title: '', step: '' }),
    };

    // ---------- clean-up before saving ----------
    function cleanQ(q, where) {
      const out = { ...q, q: String(q.q || '').trim() };
      if (!out.q) throw new Error(`${where}: the question is empty.`);
      const keep = (q.options || []).map((o, i) => ({ o: String(o || '').trim(), i })).filter((x) => x.o);
      if (keep.length < 2) throw new Error(`${where}: add at least two options.`);
      const ans = keep.findIndex((x) => x.i === q.answer);
      if (ans < 0) throw new Error(`${where}: the option marked correct is empty.`);
      out.options = keep.map((x) => x.o);
      out.answer = ans;
      return tidyMedia(out, where);
    }
    function tidyMedia(o, where) {
      for (const k of ['clue', 'image', 'youtube']) { if (typeof o[k] === 'string') o[k] = o[k].trim(); if (!o[k]) delete o[k]; }
      if (!(Number(o.clip) > 0)) delete o.clip;
      if (!o.showVideo) delete o.showVideo;
      if (!(Number(o.time) > 0)) delete o.time;
      if (o.youtube && !window.parseYouTube(o.youtube)) throw new Error(`${where}: the YouTube link isn't valid.`);
      return o;
    }
    function cleanContent(type, c) {
      c = clone(c);
      if (type === 'quiz') c.questions = (c.questions || []).map((q, i) => cleanQ(q, `Question ${i + 1}`));
      if (type === 'kbc') {
        c.fastestFinger = (c.fastestFinger || []).map((q, i) => cleanQ(q, `Fastest Finger ${i + 1}`));
        c.ladder = (c.ladder || []).map((l, li) => ({ ...l, points: Number(l.points) || 0, safe: Boolean(l.safe) || undefined, questions: (l.questions || []).map((q, i) => cleanQ(q, `Level ${li + 1} question ${i + 1}`)) }));
      }
      if (type === 'jeopardy') c.categories = (c.categories || []).map((cat, ci) => ({ ...cat, clues: (cat.clues || []).map((cl, i) => tidyMedia({ ...cl, value: Number(cl.value) || 0, q: String(cl.q || '').trim(), a: String(cl.a || '').trim() }, `${cat.name || 'Category ' + (ci + 1)} clue ${i + 1}`)) }));
      if (type === 'hookstep') c.songs = (c.songs || []).filter((s) => (s.title || '').trim()).map((s, i) => tidyMedia({ ...s, title: s.title.trim() }, `Song ${i + 1}`));
      return c;
    }

    // ---------- personalisation & questionnaire ----------
    function personalCard() {
      const st = S.settings;
      const pv = S.personalPreview || { total: 0, sample: [] };
      const done = S.answers.filter((a) => Object.values(a.answers).filter(Boolean).length).length;
      const prompts = qDraft.prompts;
      return `<section class="card ed-sec" id="ed-personal">
        <div class="ed-head"><h3 style="margin:0">✨ Personalised questions</h3><span class="grow"></span>
          <label class="toggle small"><input type="checkbox" data-eg="__s" data-ep="questionnaireOpen" data-ek="bool" ${st.questionnaireOpen ? 'checked' : ''}/> Questionnaire open on phones</label>
          <span class="qe-l">Share of each game</span><select data-eg="__s" data-ep="personalPct" data-ek="num" style="width:auto">${[0, 10, 20, 25, 30, 40, 50].map((n) => `<option value="${n}" ${Number(st.personalPct) === n ? 'selected' : ''}>${n}%</option>`).join('')}</select></div>
        <p class="small muted">Guests answer the questions below on their phones (it pops up after they join). When you <b>start</b> a game with ✨ Personalize ticked, about ${st.personalPct}% of its questions are swapped for questions built from their answers, like <i>"Whose dream holiday is Bali?"</i> or <i>"What is Priya's favourite movie?"</i>. The other questions come from your standard set, and your saved questions are never changed. Guess the Movie prefers movie answers. Jeopardy gets a "✨ Know Your Guests" category. KBC never asks the person in the hot seat about themselves. Hook Step adds guests' favourite dance songs.</p>
        <div class="row"><span class="chip ${done ? 'done' : ''}">${done} of ${S.players.length} guests answered</span><span class="chip gold">${pv.total} personal questions available</span></div>
        ${pv.sample.length ? `<div class="sec-title">Sample of what guests will see</div>${pv.sample.map((q) => `<div class="kv"><span>${esc(q.q)} <span class="small muted">(${q.options.map((o, i) => i === q.answer ? `<b>${esc(o)}</b>` : esc(o)).join(' · ')})</span></span><span class="small muted">about ${esc(q.about)}</span></div>`).join('')}` : '<p class="small muted">Questions will appear here once a few guests have answered (you need 2+ guests).</p>'}
        <div class="sec-title">Questionnaire (what guests are asked)</div>
        ${prompts.map((q, i) => `<div class="qe-row"><b class="qe-n">${i + 1}</b>
          <input type="text" class="grow" data-eg="__q" data-ep="prompts.${i}.text" data-ek="text" value="${esc(q.text)}" placeholder="Question for guests"/>
          <input type="text" data-eg="__q" data-ep="prompts.${i}.ph" data-ek="text" value="${esc(q.ph || '')}" placeholder="Example answer" style="flex:0 1 220px"/>
          ${btn('pqDel', '🗑', `data-i="${i}"`)}</div>`).join('')}
        <div class="row" style="margin-top:10px">${btn('pqAdd', '+ Add question', '', 'teal small')}<span class="grow"></span>
          ${qDraft.dirty ? '<span class="chip gold">Unsaved</span>' : ''}${btn('pqSave', '💾 Save questionnaire', qDraft.dirty ? '' : 'disabled', 'small')}</div>
        <p class="small muted">Tip: open-ended "favourite…" questions work best. Answers are used as-is in game questions, and you can delete any answer in the Players tab.</p>
      </section>`;
    }

    // ---------- page ----------
    function html(state) {
      sync(state);
      const dirty = S.gamesFull.filter((g) => drafts[g.id].dirty);
      const nav = S.gamesFull.map((g) => `<a href="#ed-${g.id}" class="chip ${drafts[g.id].dirty ? 'gold' : ''}">${esc(g.emoji)} ${esc(drafts[g.id].title)}${drafts[g.id].dirty ? ' •' : ''}</a>`).join(' ');
      const sections = S.gamesFull.map((g) => {
        const d = drafts[g.id];
        const open = !collapsed.has(g.id);
        const live = g.status === 'live';
        const body = { quiz: quizEditor, jeopardy: jeopardyEditor, kbc: kbcEditor, hookstep: hookEditor, custom: customEditor }[g.type](g.id, d.content);
        return `<section class="card ed-sec" id="ed-${g.id}">
          <div class="ed-head">
            <button class="btn ghost small" data-ea="toggle" data-eg="${g.id}">${open ? '▾' : '▸'}</button>
            <input type="text" data-eg="${g.id}" data-ep="@emoji" data-ek="text" value="${esc(d.emoji)}" style="width:56px;text-align:center"/>
            <input type="text" data-eg="${g.id}" data-ep="@title" data-ek="text" value="${esc(d.title)}" class="grow ed-title"/>
            <select data-eg="${g.id}" data-ep="@mode" data-ek="text" style="width:auto" ${live ? 'disabled' : ''}><option value="individual" ${d.mode === 'individual' ? 'selected' : ''}>👤 Solo</option><option value="team" ${d.mode === 'team' ? 'selected' : ''}>👥 Teams</option></select>
            ${g.type !== 'custom' ? `<label class="toggle small" title="Swap some questions for ones built from guests' answers"><input type="checkbox" data-eg="${g.id}" data-ep="@personalize" data-ek="bool" ${d.personalize ? 'checked' : ''}/> ✨ Personalize</label>` : ''}
            ${live ? '<span class="chip live">LIVE — end it to save</span>' : ''}
            ${d.dirty ? '<span class="chip gold">Unsaved</span>' : '<span class="chip done">Saved</span>'}
            ${btn('revert', 'Undo changes', `data-eg="${g.id}" ${d.dirty ? '' : 'disabled'}`)}
            ${btn('save', '💾 Save', `data-eg="${g.id}" ${d.dirty && !live ? '' : 'disabled'}`, 'small')}
          </div>
          ${open ? `<div class="ed-body">${body}</div>` : ''}
        </section>`;
      }).join('');
      return `<div class="card ed-top"><div class="row"><h3 style="margin:0">✏️ All questions</h3><span class="grow"></span>
          ${btn('expandAll', 'Expand all')} ${btn('collapseAll', 'Collapse all')}
          ${btn('saveAll', `💾 Save all${dirty.length ? ` (${dirty.length})` : ''}`, dirty.length ? '' : 'disabled', 'small')}</div>
        <p class="small muted" style="margin:8px 0">Click the circle next to an option to mark it correct. Add a YouTube link with a timestamp (like <code>https://youtu.be/xyz?t=1m15s</code>) to any question, clue or song and it plays on the TV from that point. "Play for" stops it after that many seconds. Questions play the audio only (so the video doesn't give the answer away), and the video appears when the answer is revealed. Tick "show video" to show it from the start.</p>
        <div class="ed-nav">${nav}</div></div>${personalCard()}${sections}`;
    }

    // ---------- events ----------
    function onInput(e) {
      const t = e.target;
      if (!t.dataset || !t.dataset.eg || !t.dataset.ep) return false;
      if (t.dataset.eg === '__s') {
        const v = t.dataset.ek === 'bool' ? t.checked : Number(t.value);
        send({ type: 'settings', [t.dataset.ep]: v }, (r) => { if (r && r.error) toast(r.error, true); else toast('Saved ✓'); });
        return true;
      }
      if (t.dataset.eg === '__q') { setAt(qDraft, t.dataset.ep, t.value); qDraft.dirty = true; return true; }
      const d = drafts[t.dataset.eg];
      if (!d) return true;
      let v = t.dataset.ek === 'bool' ? t.checked : t.value;
      if (t.dataset.ek === 'num') v = v === '' ? '' : Number(v);
      const p = t.dataset.ep;
      if (p.startsWith('@')) d[p.slice(1)] = v; else setAt(d.content, p, v);
      d.dirty = true;
      // Radio/checkbox/select changes and YouTube links need a redraw (highlight / preview).
      if (t.type === 'radio' || t.type === 'checkbox' || t.tagName === 'SELECT') rerender(true);
      else if (/youtube|clip$/.test(p)) {
        const box = t.closest('.qe-media');
        const base = p.replace(/\.(youtube|clip)$/, '');
        if (box) box.querySelector('.qe-yt').innerHTML = ytHint(getAt(d.content, base) || {});
      }
      return true;
    }

    async function save(gid) {
      const g = S.gamesFull.find((x) => x.id === gid);
      const d = drafts[gid];
      let content;
      try { content = cleanContent(g.type, d.content); } catch (err) { toast(`${d.title}: ${err.message}`, true); return false; }
      return new Promise((res) => send({ type: 'editGame', gameId: gid, title: d.title, emoji: d.emoji, mode: d.mode, personalize: d.personalize, content }, (r) => {
        if (r && r.error) { toast(`${d.title}: ${r.error}`, true); res(false); return; }
        d.dirty = false;
        d.content = content;
        res(true);
      }));
    }

    function onClick(e) {
      const b = e.target.closest('[data-ea]');
      if (!b) return false;
      const gid = b.dataset.eg;
      const d = gid && drafts[gid];
      const list = d && b.dataset.list ? getAt(d.content, b.dataset.list) : null;
      const i = Number(b.dataset.i);
      switch (b.dataset.ea) {
        case 'pqAdd': qDraft.prompts.push({ id: 'q' + Math.random().toString(36).slice(2, 8), text: '', ph: '', tag: 'fun' }); qDraft.dirty = true; break;
        case 'pqDel': if (!confirm('Remove this question? Answers to it will no longer be used.')) return true; qDraft.prompts.splice(i, 1); qDraft.dirty = true; break;
        case 'pqSave': send({ type: 'questionnaire', prompts: qDraft.prompts.filter((q) => (q.text || '').trim()) }, (r) => {
          if (r && r.error) toast(r.error, true); else { qDraft.dirty = false; toast('Questionnaire saved ✓'); rerender(true); }
        }); return true;
        case 'toggle': collapsed.has(gid) ? collapsed.delete(gid) : collapsed.add(gid); break;
        case 'expandAll': collapsed.clear(); break;
        case 'collapseAll': S.gamesFull.forEach((g) => collapsed.add(g.id)); break;
        case 'addQ': {
          let arr = list;
          if (!arr) { arr = []; setAt(d.content, b.dataset.list, arr); }
          arr.push(TEMPLATES[b.dataset.tpl](arr));
          d.dirty = true;
          break;
        }
        case 'del':
          if (!confirm('Delete this item?')) return true;
          list.splice(i, 1); d.dirty = true; break;
        case 'move': {
          const j = i + Number(b.dataset.d);
          if (j < 0 || j >= list.length) return true;
          [list[i], list[j]] = [list[j], list[i]]; d.dirty = true; break;
        }
        case 'revert': {
          const g = S.gamesFull.find((x) => x.id === gid);
          drafts[gid] = { title: g.title, emoji: g.emoji, mode: g.mode, personalize: g.personalize !== false, content: clone(g.content), dirty: false };
          break;
        }
        case 'save': save(gid).then((ok) => { if (ok) toast(`Saved ${d.title} ✓`); rerender(true); }); return true;
        case 'saveAll': {
          const ids = S.gamesFull.filter((g) => drafts[g.id].dirty && g.status !== 'live').map((g) => g.id);
          (async () => { let n = 0; for (const id of ids) if (await save(id)) n++; toast(`Saved ${n} game${n === 1 ? '' : 's'} ✓`); rerender(true); })();
          return true;
        }
        default: return false;
      }
      rerender(true);
      return true;
    }

    const isDirty = () => qDraft.dirty || Object.values(drafts).some((d) => d.dirty);
    return { html, onInput, onClick, isDirty };
  }

  window.createEditor = createEditor;
})();
