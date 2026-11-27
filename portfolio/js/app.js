// =========================================================
// Nehal's World — app layer
// =========================================================
import { createWorld } from "./world.js";
import { PLACES, BYKEY, LENSES, DOTS, NOTES, ask } from "./places.js";
import { initDots, initTolerance, initWipe, initGears } from "./toys.js";
import { initProduct } from "./product.js";
import { frame } from "./art.js";

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isSmall = () => matchMedia("(max-width: 760px)").matches;
const EMAIL = "hello@nehalrao.com"; // PLACEHOLDER

const state = { entered: false, lens: null, current: null, visited: new Set(), notes: new Set(), cleanup: [] };

// ---------- world ----------
let world = null;
try {
  world = createWorld($("#world"), {
    places: PLACES, notes: NOTES, labelsEl: $(".labels"), reduced,
    onSelect: (k) => openPlace(k),
    onNote: (i) => openNote(i),
    onHover: (kind) => setCursor(kind === "place" ? "Enter" : kind === "note" ? "Read" : null),
  });
} catch (e) {
  console.warn("WebGL unavailable — showing the index instead.", e);
  document.body.classList.add("no-webgl");
}

// on wide screens the intro text sits left, so park the world to the right
if (world && !isSmall()) world.setPanelOffset(-innerWidth * 0.2, 0);

// ---------- loader ----------
(function loader() {
  const n = $("[data-count]"), bar = $(".loader__bar span");
  const o = { v: 0 };
  window.gsap.timeline()
    .to(o, { v: 100, duration: reduced ? 0.2 : 1.4, ease: "power2.inOut", onUpdate: () => { n.textContent = String(Math.round(o.v)).padStart(3, "0"); bar.style.transform = `scaleX(${o.v / 100})`; } })
    .to(".loader", { autoAlpha: 0, duration: 0.8, ease: "power2.out" }, "+=0.15")
    .from(".intro > *", { y: 30, autoAlpha: 0, duration: 1.1, stagger: 0.08, ease: "expo.out" }, "-=0.4")
    .add(() => { $(".loader")?.remove(); if (!world) openIndex(); });
})();

// ---------- intro → enter ----------
$$("[data-lens]").forEach((b) => b.addEventListener("click", () => enter(b.dataset.lens || null)));
function enter(lens) {
  if (state.entered) { setLens(lens); return; }
  state.entered = true;
  document.body.classList.add("is-entered");
  window.gsap.to(".intro", { autoAlpha: 0, y: -20, duration: 0.7, ease: "power2.in", onComplete: () => $(".intro").setAttribute("hidden", "") });
  world?.enter();
  world?.setPanelOffset(0, 0);
  setLens(lens);
  window.gsap.from([".bar", ".dock", ".hint"], { autoAlpha: 0, y: 16, duration: 1, stagger: 0.1, delay: 1.2, ease: "expo.out" });
  setTimeout(() => {
    if (lens) toast(`Route lit up for ${LENSES[lens].label.toLowerCase()} — follow the orange.`);
    else toast("Click any island to step inside. Some things only show up if you look around.");
  }, 2600);
}

// ---------- lens / route ----------
function setLens(lens) {
  state.lens = lens;
  const route = lens ? LENSES[lens].route : null;
  world?.setRoute(route);
  $$(".bar__lenses button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.setlens || null) === lens)));
  const rb = $(".route");
  if (!route) { rb.hidden = true; return; }
  rb.hidden = false;
  $(".route__steps").innerHTML = route.map((k, i) => `<button type="button" data-go="${k}" class="${state.visited.has(k) ? "is-done" : ""}"><span>${i + 1}</span>${BYKEY[k].name.replace("The ", "")}</button>`).join('<i aria-hidden="true">→</i>');
  $(".route__label").textContent = LENSES[lens].label;
}
$$(".bar__lenses button").forEach((b) => b.addEventListener("click", () => setLens(b.dataset.setlens || null)));

// ---------- dock / progress ----------
$(".dock__places").innerHTML = PLACES.map((p, i) => `<button type="button" data-go="${p.key}" title="${p.name}"><span class="dock__dot"></span><span class="dock__name">${p.name.replace("The ", "")}</span></button>`).join("");
function updateProgress() {
  $(".progress__places").textContent = `${state.visited.size}/${PLACES.length}`;
  $(".progress__notes").textContent = `${state.notes.size}/${NOTES.length}`;
  $$(".dock__places button").forEach((b) => b.classList.toggle("is-visited", state.visited.has(b.dataset.go)));
  $$(".dock__places button").forEach((b) => b.classList.toggle("is-current", b.dataset.go === state.current));
  $$(".route__steps button").forEach((b) => b.classList.toggle("is-done", state.visited.has(b.dataset.go)));
  $$(".route__steps button").forEach((b) => b.classList.toggle("is-current", b.dataset.go === state.current));
}

// global delegation for any [data-go]
document.addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]");
  if (go) { e.preventDefault(); closeAsk(); closeIndex(); openPlace(go.dataset.go); }
  if (e.target.closest("[data-home]")) { closePanel(); world?.home(); }
});

// ---------- panel ----------
const panel = $(".panel"), content = $(".panel__content");
function panelOffset(open) {
  if (!world) return;
  if (!open) return world.setPanelOffset(0, 0);
  if (isSmall()) world.setPanelOffset(0, panel.offsetHeight * 0.5);
  else world.setPanelOffset(panel.offsetWidth * 0.5, 0);
}

function openPlace(key) {
  const p = BYKEY[key]; if (!p) return;
  if (!state.entered) enter(null);
  state.cleanup.forEach((f) => f && f()); state.cleanup = [];
  state.current = key;
  const first = !state.visited.has(key);
  state.visited.add(key);
  world?.focus(key);
  content.innerHTML = renderPlace(p);
  $(".panel__inner").scrollTop = 0;
  panel.classList.add("is-open"); panel.setAttribute("aria-hidden", "false");
  document.body.classList.add("panel-open");
  requestAnimationFrame(() => panelOffset(true));
  initModules(p);
  updateProgress();
  window.gsap.from($$(".panel__content > *"), { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.05, ease: "expo.out", delay: 0.15 });
  if (first && state.visited.size === PLACES.length) setTimeout(() => toast("You've explored the whole world. The Lighthouse is where we talk."), 1200);
}
function closePanel() {
  if (!panel.classList.contains("is-open")) return;
  state.cleanup.forEach((f) => f && f()); state.cleanup = [];
  panel.classList.remove("is-open"); panel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("panel-open");
  state.current = null; updateProgress(); panelOffset(false);
  // park the lumen viewer so it keeps its WebGL context
  if (lumenEl.parentElement) $(".parking").appendChild(lumenEl);
}
$(".panel__close").addEventListener("click", () => { closePanel(); world?.home(); });

function nextKey(key) {
  const route = state.lens ? LENSES[state.lens].route : null;
  if (route && route.includes(key)) { const i = route.indexOf(key); return route[i + 1] || null; }
  const i = PLACES.findIndex((p) => p.key === key);
  return PLACES[(i + 1) % PLACES.length].key;
}

const MODULE_TITLES = {
  timeline: "The dots so far — tap one to visit",
  lumen: "Scrub the object — sketch to ship",
  tolerance: "Try it — find the fit",
  gears: "Try it — gear the robot",
  dots: "Try it — connect 1 → 13",
  wipe: "Try it — drag v0.3 → v4.0",
  frames: "Wayfinder, in four frames",
  engine: "The engine — this world, live",
  contact: "Let's talk",
};

function renderPlace(p) {
  const nk = nextKey(p.key);
  const onRoute = state.lens && LENSES[state.lens].route.includes(p.key);
  return `
    <p class="pl__kicker mono"><span>${String(PLACES.indexOf(p) + 1).padStart(2, "0")}</span>${p.kicker}</p>
    <h2 class="pl__name">${p.name}</h2>
    <p class="pl__tagline">${p.tagline}</p>
    <p class="pl__lead">${p.lead}</p>
    ${p.modules.map((m) => `<div class="mod" data-mod="${m}"><p class="mod__title mono">${MODULE_TITLES[m]}</p>${moduleHTML(m)}</div>`).join("")}
    ${p.sections.map((s) => `<div class="pl__sec"><h3 class="mono">${s.h}</h3><p>${s.p}</p></div>`).join("")}
    <ul class="pl__facts">${p.facts.map((f) => `<li>${f}</li>`).join("")}</ul>
    <div class="pl__links"><p class="mono">Paths from here</p>${p.links.map((k) => `<button type="button" data-go="${k}">${BYKEY[k].name} <span>→</span></button>`).join("")}</div>
    ${nk ? `<button type="button" class="pl__next" data-go="${nk}"><span class="mono">${onRoute ? "Next on your route" : "Next place"}</span><strong>${BYKEY[nk].name} →</strong></button>`
         : `<button type="button" class="pl__next" data-home><span class="mono">Route complete</span><strong>Back to the whole world ↺</strong></button>`}
  `;
}

function moduleHTML(m) {
  switch (m) {
    case "timeline": return `<ol class="tl">${DOTS.map((d) => `<li><button type="button" data-go="${d.place}"><span class="tl__y mono">${d.y}</span><span class="tl__t">${d.t}</span><span class="tl__l">${d.l}</span></button></li>`).join("")}</ol>`;
    case "lumen": return `<div class="lumen-slot"></div>`;
    case "tolerance": return `<div class="toy__stage toy__stage--tol"><svg class="tol-svg" viewBox="0 0 400 300" role="img" aria-label="Shaft in a hole"></svg><div class="tol"><input class="tol__range" type="range" min="-10" max="30" value="22" aria-label="Clearance"><div class="tol__readout"><output class="tol__value mono"></output><span class="tol__verdict"></span></div></div></div>`;
    case "gears": return `<div class="toy__stage toy__stage--gear"><svg class="gear-svg" viewBox="0 0 400 260" role="img" aria-label="Two meshing gears"></svg><div class="tol"><input class="gear__range tol__range" type="range" min="8" max="36" value="20" aria-label="Wheel gear teeth"><div class="tol__readout"><output class="gear__ratio mono"></output><span class="gear__verdict tol__verdict"></span></div></div></div>`;
    case "dots": return `<div class="toy__stage toy__stage--dots"><svg class="dots-svg" viewBox="0 0 400 400" role="img" aria-label="Connect the dots"></svg><p class="toy__done"><span class="hand">There it is.</span> Seeing the idea before it's drawn.</p><button class="toy__reset mono" type="button">Reset ↺</button></div>`;
    case "wipe": return `<div class="toy__stage toy__stage--wipe"><div class="wipe"><svg class="wipe__rough" viewBox="0 0 400 300" aria-hidden="true"></svg><div class="wipe__clean"><svg viewBox="0 0 400 300" aria-hidden="true"></svg></div><div class="wipe__handle" role="slider" tabindex="0" aria-label="Compare prototype and final" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><span>⟷</span></div><span class="wipe__tag wipe__tag--l mono">v0.3 · cardboard</span><span class="wipe__tag wipe__tag--r mono">v4.0 · production</span></div></div>`;
    case "frames": return `<div class="strip">${[["sketch", "Sketch", "left = 2 taps?"], ["model", "Model", ""], ["proto", "Prototype", ""], ["final", "Shipped", ""]].map(([s, l, n], k) => `<figure class="strip__frame strip__frame--${s}">${frame("wayfinder", s, n)}<figcaption class="mono"><span>0${k + 1}</span> ${l}</figcaption></figure>`).join("")}</div>`;
    case "engine": return `<div class="engine">
        <div class="engine__row"><span class="mono">World seed</span><output class="engine__seed mono">#${String(world?.seed ?? 1997).padStart(6, "0")}</output><button type="button" class="btn" data-regrow>Regrow the world ↻</button></div>
        <div class="engine__row"><span class="mono">Render</span><div class="seg" role="group" aria-label="Render style"><button type="button" data-style="solid">Solid</button><button type="button" data-style="blueprint">Blueprint</button></div></div>
        <dl class="engine__stats mono"><div><dt>Islands</dt><dd>${PLACES.length}</dd></div><div><dt>Objects</dt><dd data-st="objects">—</dd></div><div><dt>Triangles</dt><dd data-st="triangles">—</dd></div><div><dt>Frame</dt><dd data-st="fps">—</dd></div></dl>
        <pre class="engine__code"><code><b>function</b> <i>growIsland</i>(seed, place) {
  <b>const</b> rng = mulberry32(seed ^ hash(place.key));
  <b>const</b> land = plateau(rng, place.r)
             .add(rock(rng, place.r * <u>1.6</u>));
  scatter(land, rng, density(place));
  <b>return</b> land.add(landmarks[place.key]());
}</code></pre></div>`;
    case "contact": return `<div class="contact">
        <button type="button" class="contact__cta" data-copy="${EMAIL}"><span>${EMAIL}</span><small class="mono">Click to copy</small></button>
        <div class="contact__links"><a href="https://ca.linkedin.com/in/nehalrao" target="_blank" rel="noopener">LinkedIn ↗</a><a href="assets/Nehal-Rao-Resume.pdf" target="_blank" rel="noopener">Résumé ↗</a><a href="mailto:${EMAIL}">Email ↗</a></div>
        <p class="contact__time mono">Toronto time — <span data-clock>--:--</span></p></div>`;
  }
  return "";
}

// lumen viewer is created once and moved between panels
const lumenEl = document.createElement("div");
lumenEl.className = "lumen";
lumenEl.innerHTML = `<div class="lumen__stage"><canvas class="lens__canvas" aria-label="Lumen, a lamp-speaker concept"></canvas><svg class="lens__dims" aria-hidden="true"></svg><div class="lens__labels" aria-hidden="true"></div></div>
  <div class="lumen__ctrl"><div class="seg" role="group" aria-label="Stage">${["Sketch", "Engineer", "Explode", "Ship"].map((s, i) => `<button type="button" data-stage="${[0.08, 0.36, 0.62, 0.96][i]}">${s}</button>`).join("")}</div>
  <input class="lumen__range tol__range" type="range" min="0" max="1000" value="620" aria-label="Design stage"></div>`;
let product = null;
const lumenProg = { v: 0.62 };
function setLumen(v, animate = true) {
  window.gsap.to(lumenProg, { v, duration: animate && !reduced ? 1.2 : 0.01, ease: "power2.inOut", onUpdate: () => {
    product?.setProgress(lumenProg.v);
    $(".lumen__range", lumenEl).value = Math.round(lumenProg.v * 1000);
    $(".lumen__range", lumenEl).style.setProperty("--p", lumenProg.v * 100 + "%");
    const idx = lumenProg.v < 0.25 ? 0 : lumenProg.v < 0.5 ? 1 : lumenProg.v < 0.75 ? 2 : 3;
    $$("[data-stage]", lumenEl).forEach((b, i) => b.setAttribute("aria-pressed", String(i === idx)));
  } });
}
$(".lumen__range", lumenEl).addEventListener("input", (e) => { window.gsap.killTweensOf(lumenProg); lumenProg.v = e.target.value / 1000; setLumen(lumenProg.v, false); });
$$("[data-stage]", lumenEl).forEach((b) => b.addEventListener("click", () => setLumen(+b.dataset.stage)));

function initModules(p) {
  $$(".mod", content).forEach((mod) => {
    const m = mod.dataset.mod;
    if (m === "lumen") {
      $(".lumen-slot", mod).appendChild(lumenEl);
      if (!product) {
        try { product = initProduct($(".lens__canvas", lumenEl), { reduced, labelsEl: $(".lens__labels", lumenEl), dimsEl: $(".lens__dims", lumenEl) }); } catch (e) { console.warn(e); }
        setLumen(0.08, false);
        setTimeout(() => setLumen(0.62), 900);
      }
    }
    if (m === "tolerance") initTolerance($(".tol-svg", mod), $(".toy__stage", mod));
    if (m === "gears") state.cleanup.push(initGears($(".gear-svg", mod), $(".toy__stage", mod)));
    if (m === "dots") initDots($(".dots-svg", mod), $(".toy__stage", mod));
    if (m === "wipe") initWipe($(".wipe", mod));
    if (m === "engine") initEngine(mod);
    if (m === "contact") tickClock();
  });
}

function initEngine(mod) {
  const styleBtns = $$("[data-style]", mod);
  const sync = () => styleBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.style === world?.style)));
  sync();
  styleBtns.forEach((b) => b.addEventListener("click", () => { world?.setStyle(b.dataset.style); sync(); }));
  $("[data-regrow]", mod).addEventListener("click", () => {
    const s = world?.regrow(Math.floor(Math.random() * 999999));
    $(".engine__seed", mod).textContent = "#" + String(s).padStart(6, "0");
    world?.home(); panelOffset(true);
    toast("New seed, new world — same places, different ground.");
  });
  let last = world?.stats().frames ?? 0, lt = performance.now();
  const id = setInterval(() => {
    const s = world?.stats(); if (!s) return;
    const now = performance.now();
    $('[data-st="objects"]', mod).textContent = s.objects.toLocaleString();
    $('[data-st="triangles"]', mod).textContent = s.triangles.toLocaleString();
    $('[data-st="fps"]', mod).textContent = Math.round(((s.frames - last) / (now - lt)) * 1000) + " fps";
    last = s.frames; lt = now;
  }, 700);
  state.cleanup.push(() => clearInterval(id));
}

// copy email
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); toast("Copied — talk soon."); }
  catch { location.href = `mailto:${b.dataset.copy}`; }
});

// ---------- field notes ----------
const noteEl = $(".note");
function openNote(i) {
  const first = !state.notes.has(i);
  state.notes.add(i); world?.markNote(i); updateProgress();
  $(".note__count", noteEl).textContent = `Field note ${i + 1} of ${NOTES.length} · found ${state.notes.size}`;
  $(".note__text", noteEl).textContent = NOTES[i];
  noteEl.hidden = false;
  window.gsap.fromTo(".note__card", { y: 30, rotate: -6, autoAlpha: 0 }, { y: 0, rotate: -2, autoAlpha: 1, duration: 0.8, ease: "expo.out" });
  if (first && state.notes.size === NOTES.length) setTimeout(() => toast("All six notes. You'd be good to work with."), 900);
}
function closeNote() { noteEl.hidden = true; }
$$("[data-close-note]").forEach((b) => b.addEventListener("click", closeNote));

// ---------- ask ----------
const askEl = $(".ask"), askInput = $(".ask__input"), askList = $(".ask__results");
const SUGGEST = ["Can he do CAD?", "Can he code?", "How does he think?", "Has he worked in manufacturing?", "Is he available?", "Does he use automation?"];
function openAsk(prefill = "") {
  askEl.hidden = false; askInput.value = prefill; renderAsk(prefill); askInput.focus();
  window.gsap.fromTo(".ask__box", { y: -20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "expo.out" });
}
function closeAsk() { askEl.hidden = true; }
let askTimer = 0, sel = 0;
function renderAsk(q) {
  clearTimeout(askTimer);
  if (!q.trim()) {
    askList.innerHTML = `<li class="ask__hint mono">Try</li>` + SUGGEST.map((s) => `<li><button type="button" class="ask__sugg" data-q="${s}">${s}</button></li>`).join("");
    return;
  }
  askList.innerHTML = `<li class="ask__thinking"><span></span><span></span><span></span></li>`;
  askTimer = setTimeout(() => {
    const res = ask(q); sel = 0;
    if (!res.length) {
      askList.innerHTML = `<li class="ask__none">I don't have a clean answer to that one. The <button type="button" data-go="observatory">Observatory</button> explains how I think, or <button type="button" data-go="lighthouse">ask me directly</button>.</li>`;
      return;
    }
    askList.innerHTML = res.map((r, i) => `<li><button type="button" class="ask__res${i === 0 ? " is-sel" : ""}" data-go="${r.place}"><span class="ask__a">${r.a}</span><span class="ask__go mono">${BYKEY[r.place].name} →</span></button></li>`).join("");
  }, reduced ? 0 : 260);
}
askInput.addEventListener("input", () => renderAsk(askInput.value));
askInput.addEventListener("keydown", (e) => {
  const items = $$(".ask__res", askList);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); if (!items.length) return;
    sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((it, i) => it.classList.toggle("is-sel", i === sel));
  }
  if (e.key === "Enter") { const it = items[sel]; if (it) it.click(); }
});
askList.addEventListener("click", (e) => { const s = e.target.closest("[data-q]"); if (s) { askInput.value = s.dataset.q; renderAsk(s.dataset.q); askInput.focus(); } });
$$("[data-ask]").forEach((b) => b.addEventListener("click", () => openAsk()));
$$("[data-close-ask]").forEach((b) => b.addEventListener("click", closeAsk));

// ---------- index (plain reading view) ----------
const indexEl = $(".index");
$(".index__list").innerHTML = PLACES.map((p, i) => `
  <article class="ix">
    <p class="mono ix__k"><span>${String(i + 1).padStart(2, "0")}</span>${p.kicker}</p>
    <h2 class="ix__n">${p.name}</h2>
    <p class="ix__t">${p.tagline}</p>
    <p class="ix__l">${p.lead}</p>
    ${p.sections.map((s) => `<p><strong class="mono">${s.h}</strong><br>${s.p}</p>`).join("")}
    <ul class="pl__facts">${p.facts.map((f) => `<li>${f}</li>`).join("")}</ul>
    ${world ? `<button type="button" class="ix__go mono" data-go="${p.key}">Visit in the world →</button>` : ""}
  </article>`).join("");
function openIndex() { indexEl.hidden = false; indexEl.scrollTop = 0; }
function closeIndex() { if (world) indexEl.hidden = true; }
$$("[data-index]").forEach((b) => b.addEventListener("click", openIndex));
$$("[data-close-index]").forEach((b) => b.addEventListener("click", closeIndex));

// ---------- keyboard ----------
document.addEventListener("keydown", (e) => {
  const typing = e.target.closest("input:not([type=range]), textarea");
  if (e.key === "Escape") {
    if (!askEl.hidden) return closeAsk();
    if (!noteEl.hidden) return closeNote();
    if (!indexEl.hidden) return closeIndex();
    if (panel.classList.contains("is-open")) { closePanel(); world?.home(); }
    return;
  }
  if (typing) return;
  if ((e.key === "/" || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)))) { e.preventDefault(); openAsk(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!state.entered && e.key === "Enter") return enter(null);
  if (e.key.toLowerCase() === "h") { closePanel(); world?.home(); }
  if (e.key.toLowerCase() === "i") openIndex();
  if (e.key === "]" || e.key === "[") {
    const i = Math.max(0, PLACES.findIndex((p) => p.key === state.current));
    openPlace(PLACES[(i + (e.key === "]" ? 1 : PLACES.length - 1)) % PLACES.length].key);
  }
});

// ---------- small things ----------
const toastEl = $(".toast"); let toastT = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("is-on"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("is-on"), 3600); }

const fmt = new Intl.DateTimeFormat("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Toronto" });
function tickClock() { $$("[data-clock]").forEach((c) => (c.textContent = fmt.format(new Date()))); }
setInterval(tickClock, 15000);

// hint fades after the first real interaction with the world
const hint = $(".hint");
$("#world").addEventListener("pointerdown", () => hint?.classList.add("is-gone"), { once: true });

// cursor
const cursor = $(".cursor");
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
function setCursor(text) {
  if (!fine) return;
  cursor.classList.toggle("has-text", !!text);
  $(".cursor__text").textContent = text || "";
}
if (fine && !reduced) {
  const dot = $(".cursor__dot"), ring = $(".cursor__ring");
  const p = { x: innerWidth / 2, y: innerHeight / 2 }, r = { ...p };
  addEventListener("pointermove", (e) => { p.x = e.clientX; p.y = e.clientY; }, { passive: true });
  (function loop() {
    r.x += (p.x - r.x) * 0.18; r.y += (p.y - r.y) * 0.18;
    dot.style.transform = `translate(${p.x}px, ${p.y}px)`; ring.style.transform = `translate(${r.x}px, ${r.y}px)`;
    requestAnimationFrame(loop);
  })();
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest("a, button, input, [role=slider]");
    cursor.classList.toggle("is-hover", !!t);
    if (t && cursor.classList.contains("has-text") && !e.target.closest("#world")) setCursor(null);
  });
  $("#world").addEventListener("pointerdown", () => cursor.classList.add("is-down"));
  addEventListener("pointerup", () => cursor.classList.remove("is-down"));
} else { cursor.remove(); }

addEventListener("resize", () => { if (panel.classList.contains("is-open")) panelOffset(true); });
updateProgress();
