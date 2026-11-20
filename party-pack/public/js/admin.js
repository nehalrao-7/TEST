/* Live dashboard: who is playing now, and parties that already finished. Counts only. */
(function () {
  const app = document.getElementById('app');
  const KEY = 'pp_admin_key';
  const store = {
    get() { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } },
    set(v) { try { sessionStorage.setItem(KEY, v); } catch { /* private mode */ } },
    del() { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } },
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('en-US');
  const ago = (t, now) => {
    const s = Math.max(0, Math.round((now - t) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' d ago';
  };
  const mins = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };
  const STAGE = { lobby: 'In the lobby', profile: 'Profile questions', standings: 'Standings', awards: 'Awards', podium: 'Finished' };
  const THEMES = { classic: '🌌 Midnight', spring: '🌸 Blossom', summer: '☀️ Sunshine', autumn: '🍂 Harvest', winter: '❄️ Frost', newyear: '🥂 New Year', lunar: '🏮 Lunar New Year', spooky: '🎃 Spooky Night', lights: '🪔 Festival of Lights', festive: '🎄 Winter Holidays' };

  let timer = null, lastOk = 0, data = null, drawn = false, shown = '';

  const head = (right = '') => `<div class="top"><span class="mark" aria-hidden="true">${[0, 1, 2, 3].map(() => '<i></i>').join('')}</span><h1>Party Pack <span class="muted">· live</span></h1><span class="grow"></span>${right}</div>`;

  function login(msg) {
    clearTimeout(timer);
    app.innerHTML = `<form class="login" id="f"><span class="mark" aria-hidden="true">${[0, 1, 2, 3].map(() => '<i></i>').join('')}</span><h1>Dashboard</h1><p>Enter the admin key to see who’s playing.</p>
      <input id="k" type="password" autocomplete="current-password" placeholder="Admin key" aria-label="Admin key" /><div class="err" id="e">${esc(msg || '')}</div><button class="btn big" type="submit">Open dashboard</button></form>`;
    const k = document.getElementById('k'); k.focus();
    document.getElementById('f').onsubmit = (e) => { e.preventDefault(); store.set(k.value.trim()); load(true); };
  }

  async function load(first) {
    clearTimeout(timer);
    const key = store.get();
    if (!key) return login();
    try {
      const res = await fetch('/api/admin/stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }), cache: 'no-store' });
      if (res.status === 401) { store.del(); return login('That key is not right.'); }
      if (res.status === 404) { store.del(); return app.innerHTML = head() + '<div class="panel"><b>The dashboard is switched off.</b><p class="muted" style="margin-top:6px">Set an <code>ADMIN_KEY</code> (16 or more characters) in the server’s environment settings and redeploy.</p></div>'; }
      if (!res.ok) throw new Error('bad status');
      data = await res.json();
      lastOk = Date.now();
      // Only redraw when something changed, and only animate the first time.
      const sig = JSON.stringify([data.live, data.history]);
      if (sig !== shown || !document.getElementById('out')) { shown = sig; draw(); } else stamp();
    } catch {
      if (!data) { app.innerHTML = head() + '<div class="panel">Can’t reach the server. Retrying…</div>'; }
      else stamp();
    }
    timer = setTimeout(load, document.hidden ? 15000 : 5000);
  }

  const kpi = (label, value, extra = '', cls = '') => `<div class="kpi ${cls}"><span>${label}</span><b>${value}</b>${extra ? `<small>${extra}</small>` : ''}</div>`;
  const stateTag = (r) => `<span class="state ${r.state}">${r.state === 'live' ? 'Live' : r.state === 'recent' ? 'Quiet' : 'Idle'}</span>`;

  function liveTable(L, now) {
    const rows = L.rooms.filter((r) => r.state !== 'idle');
    if (!rows.length) return '<div class="empty">Nobody is playing right now. This page updates by itself.</div>';
    return `<div class="scroll"><table class="tbl"><thead><tr><th>Room</th><th></th><th>Doing</th><th class="num">Online</th><th>Theme</th><th>Started</th></tr></thead><tbody>${rows.map((r) => {
      const doing = r.game ? `${esc(r.game.emoji)} ${esc(r.game.title)} <span class="muted">· ${r.gameNo} of ${r.gamesTotal}</span>` : esc(STAGE[r.stage] || r.stage);
      return `<tr><td class="code">${esc(r.code)}</td><td>${stateTag(r)}</td><td>${doing}</td><td class="num">${r.online}<span class="muted"> / ${r.players}${r.bots ? ` +${r.bots} 🤖` : ''}</span></td><td>${esc(THEMES[r.theme] || r.theme)}</td><td class="muted">${ago(r.createdAt, now)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function pastTable(H, now) {
    if (!H.enabled) return '<div class="note">History isn’t available: the database login can’t create the <code>history</code> table. Run <code>migrations/003_history.sql</code> once (replace <code>ppk</code> with your table prefix) and it starts filling in.</div>';
    if (!H.recent.length) return '<div class="empty">No finished parties yet. Each one appears here when it reaches the podium, or when an unfinished room expires.</div>';
    return `<div class="scroll"><table class="tbl"><thead><tr><th>Ended</th><th>Room</th><th class="num">Players</th><th>Games</th><th>Theme</th><th class="num">Length</th><th>Result</th></tr></thead><tbody>${H.recent.map((r) => `<tr>
      <td class="muted" title="${esc(new Date(r.endedAt).toLocaleString())}">${ago(r.endedAt, now)}</td><td class="code">${esc(r.code)}</td>
      <td class="num">${r.humans}${r.bots ? `<span class="muted"> +${r.bots} 🤖</span>` : ''}</td>
      <td><div class="chips">${r.games.map((g) => `<span>${esc(gameLabel(g, H))}</span>`).join('') || '<span class="muted">none</span>'}</div></td>
      <td>${esc(THEMES[r.theme] || r.theme)}</td><td class="num">${mins(r.endedAt - r.createdAt)}</td>
      <td>${r.finished ? '<span class="ok">✓ Finished</span>' : '<span class="no">Left early</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const gameLabel = (id, H) => { const g = H.games.find((x) => x.id === id); return g ? `${g.emoji} ${g.title}` : id; };

  function bars(H) {
    const max = Math.max(1, ...H.days.map((d) => d.parties));
    return `<div class="bars" role="img" aria-label="Parties per day, last 14 days">${H.days.map((d) => {
      const dt = new Date(d.day);
      return `<div class="col" title="${esc(dt.toUTCString().slice(0, 11))}: ${d.parties} parties, ${d.players} players"><b>${d.parties || ''}</b><i style="height:${Math.round((100 * d.parties) / max)}%"></i><small>${dt.getUTCDate()}</small></div>`;
    }).join('')}</div>`;
  }
  function rank(list, label) {
    if (!list.length) return '<div class="empty">Nothing yet.</div>';
    const max = Math.max(1, ...list.map(label.n));
    return `<div class="rank">${list.slice(0, 8).map((x) => `<div class="r"><span>${esc(label.name(x))}</span><b>${label.n(x)}</b><i style="--w:${Math.round((100 * label.n(x)) / max)}%"></i></div>`).join('')}</div>`;
  }

  function draw() {
    const { live: L, history: H, now } = data;
    const y = window.scrollY;
    app.innerHTML = head(`<span class="pulse-dot" id="stamp">Live</span><button class="btn small ghost" id="out">Sign out</button>`) + `
      <section class="kpis">
        ${kpi('Players online now', num(L.playersOnline), `${L.roomsLive} room${L.roomsLive === 1 ? '' : 's'} with someone connected`, L.playersOnline ? 'hot' : '')}
        ${kpi('Parties, last 24 h', num(H.last24.parties), `${num(H.last24.players)} players`)}
        ${kpi('Parties recorded', num(H.parties), `${num(H.finished)} played to the end`)}
        ${kpi('Players recorded', num(H.humans), 'people, not bots')}
        ${kpi('Average party', H.avgPlayers || '–', H.avgMins ? `players · about ${H.avgMins} min` : 'players')}
      </section>
      <section class="panel wide"><h2>Playing now</h2>${liveTable(L, now)}</section>
      <section class="grid">
        <div class="panel"><h2>Parties per day · last 14 days</h2>${bars(H)}</div>
        <div class="panel"><h2>Most played games</h2>${rank(H.games, { name: (g) => `${g.emoji} ${g.title}`, n: (g) => g.plays })}</div>
      </section>
      <section class="grid">
        <div class="panel"><h2>Themes</h2>${rank(H.themes, { name: (t) => `${t.emoji} ${t.name}`, n: (t) => t.n })}</div>
        <div class="panel"><h2>About this data</h2><p class="muted small">Counts only: no names, emails or answers are stored here. History starts from the day the dashboard was switched on. Rooms that expire after a game was played are counted as “left early”.</p></div>
      </section>
      <section class="panel wide"><h2>Past parties</h2>${pastTable(H, now)}</section>`;
    app.classList.toggle('still', drawn); drawn = true;
    document.getElementById('out').onclick = () => { store.del(); data = null; drawn = false; shown = ''; login(); };
    window.scrollTo(0, y);
    stamp();
  }
  function stamp() {
    const el = document.getElementById('stamp'); if (!el) return;
    const s = Math.round((Date.now() - lastOk) / 1000);
    el.classList.toggle('stale', s > 20);
    el.textContent = s > 20 ? `Connection lost · last update ${s}s ago` : 'Live · updated ' + (s < 2 ? 'just now' : s + 's ago');
  }
  setInterval(stamp, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && store.get()) load(); });
  load(true);
})();
