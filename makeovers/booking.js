(() => {
  const IG_HANDLE = 'makeoversbyriddhii';
  const PRICES = { makeup: 35, combo: 60 };
  const LABELS = { makeup: 'Makeup', combo: 'Makeup + Hair' };
  const LAST_MINUTE_FEE = 15;
  const LEAD_DAYS = 3;
  const MAX_MONTHS_AHEAD = 6;
  const MAX_PEOPLE = 8;

  const form = document.getElementById('booking-form');
  const grid = document.getElementById('cal-grid');
  const title = document.getElementById('cal-title');
  const prev = document.getElementById('cal-prev');
  const next = document.getElementById('cal-next');
  const peopleOut = document.getElementById('people');
  const minus = document.getElementById('people-minus');
  const plus = document.getElementById('people-plus');
  const areaField = document.getElementById('area-field');
  const summaryList = document.getElementById('summary-list');
  const totalEl = document.getElementById('total');
  const totalNote = document.getElementById('total-note');
  const errorEl = document.getElementById('form-error');
  const dialog = document.getElementById('confirm');
  const messageEl = document.getElementById('message');
  const copyStatus = document.getElementById('copy-status');

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(new Date());
  const maxDate = new Date(today.getFullYear(), today.getMonth() + MAX_MONTHS_AHEAD + 1, 0);
  const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
  const fmtLong = (d) => d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const fmtShort = (d) => d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });

  const state = { people: 1, date: null, view: new Date(today.getFullYear(), today.getMonth(), 1) };

  const isLate = (d) => daysBetween(today, d) < LEAD_DAYS;

  // ---------- Calendar ----------
  function renderCalendar() {
    const y = state.view.getFullYear(), m = state.view.getMonth();
    title.textContent = state.view.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
    grid.innerHTML = '';
    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    for (let i = 0; i < firstDow; i++) grid.appendChild(document.createElement('span'));

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m, day);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day';
      btn.textContent = day;
      btn.dataset.date = d.toISOString();
      const disabled = d < today || d > maxDate;
      btn.disabled = disabled;
      if (+d === +today) btn.classList.add('today');
      if (!disabled && isLate(d)) btn.classList.add('late');
      if (state.date && +d === +state.date) {
        btn.classList.add('selected');
        btn.setAttribute('aria-pressed', 'true');
      }
      let label = fmtLong(d);
      if (!disabled && isLate(d)) label += ' — last-minute, +$15';
      btn.setAttribute('aria-label', label);
      btn.addEventListener('click', () => {
        state.date = d;
        renderCalendar();
        update();
        grid.querySelector('.selected')?.focus();
      });
      grid.appendChild(btn);
    }
    prev.disabled = y === today.getFullYear() && m === today.getMonth();
    next.disabled = new Date(y, m + 1, 1) > maxDate;
  }
  prev.addEventListener('click', () => { state.view.setMonth(state.view.getMonth() - 1); renderCalendar(); });
  next.addEventListener('click', () => { state.view.setMonth(state.view.getMonth() + 1); renderCalendar(); });

  // ---------- People ----------
  function setPeople(n) {
    state.people = Math.max(1, Math.min(MAX_PEOPLE, n));
    peopleOut.textContent = state.people;
    minus.disabled = state.people === 1;
    plus.disabled = state.people === MAX_PEOPLE;
    update();
  }
  minus.addEventListener('click', () => setPeople(state.people - 1));
  plus.addEventListener('click', () => setPeople(state.people + 1));

  // ---------- Summary ----------
  function values() {
    const f = new FormData(form);
    return {
      service: f.get('service'),
      time: f.get('time'),
      location: f.get('location'),
      area: (f.get('area') || '').trim(),
      name: (f.get('name') || '').trim(),
      phone: (f.get('phone') || '').trim(),
      notes: (f.get('notes') || '').trim(),
    };
  }

  function compute(v) {
    const base = PRICES[v.service] * state.people;
    const late = state.date ? isLate(state.date) : false;
    return { base, late, total: base + (late ? LAST_MINUTE_FEE : 0), travel: v.location === 'mobile' };
  }

  function row(dt, dd, pending) {
    const div = document.createElement('div');
    const t = document.createElement('dt'); t.textContent = dt;
    const d = document.createElement('dd'); d.textContent = dd;
    if (pending) d.className = 'pending';
    div.append(t, d);
    return div;
  }

  function update() {
    const v = values();
    const c = compute(v);
    areaField.hidden = v.location !== 'mobile';
    summaryList.innerHTML = '';
    summaryList.append(
      row('Look', `${LABELS[v.service]}${state.people > 1 ? ` × ${state.people}` : ''}`),
      row('Date', state.date ? fmtShort(state.date) : 'Pick a date', !state.date),
      row('Time', v.time),
      row('Where', v.location === 'mobile' ? 'Your place' : 'Studio, Brampton'),
    );
    if (c.late) summaryList.append(row('Last-minute', `+$${LAST_MINUTE_FEE}`));
    if (c.travel) summaryList.append(row('Travel', 'Quoted by Riddhi', true));
    totalEl.textContent = `$${c.total}${c.travel ? '+' : ''}`;
    totalNote.textContent = c.travel
      ? 'Plus travel fee, based on your location. Final price confirmed by Riddhi.'
      : 'Final price confirmed by Riddhi.';
  }

  form.addEventListener('change', update);
  form.addEventListener('input', (e) => { if (e.target.name === 'name') e.target.classList.remove('invalid'); });

  // Service links on price cards pre-select the look
  document.querySelectorAll('[data-service]').forEach((a) => {
    a.addEventListener('click', () => {
      const input = form.querySelector(`input[name="service"][value="${a.dataset.service}"]`);
      if (input) { input.checked = true; update(); }
    });
  });

  // ---------- Submit ----------
  function buildMessage(v, c) {
    const lines = [
      'Hi Riddhi! I would like to book an appointment:',
      '',
      `• Look: ${LABELS[v.service]}${state.people > 1 ? ` for ${state.people} people` : ''}`,
      `• Date: ${fmtLong(state.date)}${c.late ? ' (last-minute)' : ''}`,
      `• Preferred time: ${v.time}`,
      `• Location: ${v.location === 'mobile' ? `My place${v.area ? ` (${v.area})` : ''}` : 'Your studio in Brampton'}`,
      `• Name: ${v.name}`,
    ];
    if (v.phone) lines.push(`• Phone: ${v.phone}`);
    if (v.notes) lines.push(`• Notes: ${v.notes}`);
    lines.push('', `Estimated total: $${c.total}${c.travel ? ' + travel' : ''}`, '', 'Thank you!');
    return lines.join('\n');
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const v = values();
    if (!state.date) {
      showError('Please pick a date on the calendar.');
      document.getElementById('calendar').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!v.name) {
      showError('Please add your name so Riddhi knows who is booking.');
      const nameInput = form.elements.name;
      nameInput.classList.add('invalid');
      nameInput.focus();
      return;
    }
    messageEl.textContent = buildMessage(v, compute(v));
    copyStatus.textContent = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  });

  async function copyMessage() {
    const text = messageEl.textContent;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const range = document.createRange();
      range.selectNodeContents(messageEl);
      const sel = getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      try { return document.execCommand('copy'); } catch { return false; }
    }
  }

  document.getElementById('copy-msg').addEventListener('click', async () => {
    copyStatus.textContent = (await copyMessage()) ? 'Copied ✓' : 'Select the message above and copy it.';
  });
  document.getElementById('send-ig').addEventListener('click', async () => {
    const ok = await copyMessage();
    copyStatus.textContent = ok ? 'Copied ✓ — paste it into the Instagram chat.' : 'Copy the message above, then paste it in Instagram.';
    window.open(`https://ig.me/m/${IG_HANDLE}`, '_blank', 'noopener');
  });

  // ---------- Page niceties ----------
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));

    const links = document.querySelectorAll('.nav-links a');
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === `#${en.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach((s) => spy.observe(s));

    const cta = document.querySelector('.mobile-cta');
    // Hide the floating CTA while the hero buttons or the booking form are on screen
    const visible = new Set();
    const hideCta = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? visible.add(en.target) : visible.delete(en.target)));
      cta.classList.toggle('hide', visible.size > 0);
    }, { threshold: 0.05 });
    hideCta.observe(document.querySelector('.hero-actions'));
    hideCta.observe(document.getElementById('book'));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  setPeople(1);
  renderCalendar();
  update();
})();
