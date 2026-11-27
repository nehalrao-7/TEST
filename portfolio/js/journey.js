// =========================================================
// The journey: scroll position → machine state, chapter copy,
// callouts and the scroll guide on the right.
// =========================================================
import { createMachine } from "./machine.js";

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = () => matchMedia("(max-width: 760px)").matches;

const ALL = ["housing", "capL", "bearingL", "bearingR", "stator", "rotor", "ring", "carrier", "bell", "flange", "cold", "pcb", "lid"];
const ghostAllBut = (keep, k = 0.85) => Object.fromEntries(ALL.filter((g) => !keep.includes(g)).map((g) => [g, k]));
const exAll = Object.fromEntries(ALL.map((g) => [g, 1]));

// One state per chapter. Camera positions are relative to the machine (units: 50 mm).
const CHAPTERS = [
  { id: "intro", state: { cam: [8.2, 3.6, 10.4], target: [0.5, 0.45, 0], spin: 0.12, gear: 0.5, offX: 0.16 }, callouts: [] },
  { id: "form", state: { cam: [6.6, 3.0, 9.6], target: [0, 0.45, 0.1], spin: 0, offX: 0.17 },
    callouts: [
      { m: "fins", t: "Cooling fins", s: "Cast A356 · 2° draft · 40 fins", side: 1, dy: 70 },
      { m: "nameplate", t: "Nameplate", s: "Anodised, laser-etched", side: 1, dy: -40 },
      { m: "flange", t: "Bolted flange", s: "12 × M8 on Ø 182", side: 1, dy: -110 },
      { m: "port", t: "Coolant ports", s: "O-ring sealed, Ø 12", side: -1, dy: 80 },
    ] },
  { id: "motion", state: { cam: [9.2, 2.6, 7.2], target: [3.3, 0.1, 0], gear: 1, offX: 0.15, ex: { bell: 1, ring: 1, carrier: 1, flange: 1, bearingR: 1 }, ghost: ghostAllBut(["bell", "ring", "carrier", "flange", "rotor", "bearingR"], 0.82) },
    callouts: [
      { m: "sun", t: "Sun gear", s: "12 teeth · module 1.5", side: -1, dy: -120 },
      { m: "planet", t: "Planet gears", s: "3 × 42 teeth, pinned", side: 1, dy: -90 },
      { m: "ring", t: "Ring gear", s: "96 internal teeth → 9 : 1", side: 1, dy: 60 },
      { m: "flange", t: "Output flange", s: "6 × M10, splined hub", side: 1, dy: 20 },
    ] },
  { id: "core", state: { cam: [0.6, 4.0, 11.4], target: [-1.5, 0.3, 0.4], gear: 0.35, offX: 0.15, ex: { housing: 1, capL: 1, bearingL: 1, rotor: 1, lid: 0.4, pcb: 0.3, cold: 0.3 }, ghost: { ...ghostAllBut(["stator", "rotor"], 0.88) } },
    callouts: [
      { m: "lams", t: "Stator stack", s: "28 laminated steel plates", side: 1, dy: 60 },
      { m: "windings", t: "Hairpin windings", s: "36 slots · 72 copper bars", side: -1, dy: -110 },
      { m: "magnets", t: "Rotor magnets", s: "8-pole V · NdFeB", side: -1, dy: 90 },
      { m: "shaft", t: "Shaft", s: "Ground steel, two bearing seats", side: -1, dy: 30 },
    ] },
  { id: "brain", state: { cam: [3.6, 9.4, 9.6], target: [-0.1, 4.0, -1.0], glow: 1, offX: 0.15, ex: { lid: 1, pcb: 1, cold: 1 }, ghost: ghostAllBut(["pcb", "lid", "cold"], 0.8) },
    callouts: [
      { m: "modules", t: "Power stage", s: "3 half-bridge modules", side: 1, dy: -100 },
      { m: "dclink", t: "DC-link capacitor", s: "Film, low inductance", side: -1, dy: 80 },
      { m: "mcu", t: "Controller", s: "Firmware, sensing, control", side: 1, dy: 70 },
      { m: "cables", t: "HV harness", s: "Orange means live", side: -1, dy: -90 },
    ] },
  { id: "system", state: { cam: [9.6, 6.4, 15.5], target: [0.9, 1.6, -0.4], spin: 0.05, gear: 0.5, glow: 0.4, offX: 0.1, ex: exAll },
    callouts: [
      { m: "lid", t: "Inverter lid", side: 1, dy: -40 },
      { m: "pcbName", t: "Control board", side: 1, dy: 0 },
      { m: "housingName", t: "Housing", side: -1, dy: -60 },
      { m: "statorName", t: "Stator", side: -1, dy: 20 },
      { m: "rotorName", t: "Rotor", side: -1, dy: 70 },
      { m: "capL", t: "End cap", side: -1, dy: 40 },
      { m: "bell", t: "Gearbox", side: 1, dy: -50 },
      { m: "flange", t: "Output", side: 1, dy: 40 },
    ] },
  { id: "next", state: { cam: [-7.4, 3.0, 9.6], target: [0.4, 0.5, 0], spin: 0.1, gear: 0.4, offX: 0.16 }, callouts: [] },
];

// ---------- machine ----------
let machine = null;
try { machine = createMachine($("#machine"), { reduced }); }
catch (e) { console.warn("WebGL unavailable", e); document.body.classList.add("no-webgl"); }
$$("[data-parts]").forEach((el) => (el.textContent = (machine?.parts ?? 1200).toLocaleString()));

// ---------- scroll guide ----------
const sections = $$(".chapter");
const guide = $(".guide__list");
guide.innerHTML = sections.map((s, i) => `<li><a href="#${s.id}" data-i="${i}"><span class="guide__label">${s.dataset.label}</span><span class="guide__node"><span class="guide__num">${String(i).padStart(2, "0")}</span></span></a></li>`).join("");
const guideLinks = $$(".guide__list a");

// ---------- smooth scroll ----------
let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true });
  (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
}
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  const t = $(a.getAttribute("href")); if (!t) return;
  e.preventDefault();
  lenis ? lenis.scrollTo(t, { duration: 1.6 }) : t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
});

// ---------- scroll → chapter position (float) ----------
function chapterPos() {
  const mid = innerHeight * 0.5;
  for (let i = 0; i < sections.length; i++) {
    const r = sections[i].getBoundingClientRect();
    if (r.top <= mid && r.bottom > mid) return i + (mid - r.top) / r.height;
  }
  return sections[0].getBoundingClientRect().top > mid ? 0 : sections.length - 0.001;
}
const ease = (x) => { const t = Math.min(1, Math.max(0, (x - 0.55) / 0.45)); return t * t * (3 - 2 * t); }; // hold, then transition into the next chapter
const lerp = (a, b, t) => a + (b - a) * t;
function mix(a, b, t) {
  const out = { cam: a.cam.map((v, i) => lerp(v, b.cam[i], t)), target: a.target.map((v, i) => lerp(v, b.target[i], t)), ex: {}, ghost: {} };
  ["spin", "gear", "glow", "offX"].forEach((k) => (out[k] = lerp(a[k] || 0, b[k] || 0, t)));
  ALL.forEach((g) => { out.ex[g] = lerp(a.ex?.[g] || 0, b.ex?.[g] || 0, t); out.ghost[g] = lerp(a.ghost?.[g] || 0, b.ghost?.[g] || 0, t); });
  return out;
}

// ---------- callouts ----------
const layer = $(".callouts"), svg = $(".leaders");
let active = -1, calloutEls = [];
function buildCallouts(i) {
  layer.innerHTML = ""; calloutEls = [];
  (CHAPTERS[i].callouts || []).forEach((c, k) => {
    const el = document.createElement("div");
    el.className = "callout" + (c.side < 0 ? " callout--l" : "") + (c.s ? "" : " callout--name");
    el.innerHTML = `<span class="callout__t"></span>${c.s ? '<span class="callout__s"></span>' : ""}`;
    el.querySelector(".callout__t").textContent = c.t;
    if (c.s) el.querySelector(".callout__s").textContent = c.s;
    el.style.transitionDelay = `${0.25 + k * 0.08}s`;
    layer.appendChild(el);
    calloutEls.push({ el, c });
  });
  requestAnimationFrame(() => calloutEls.forEach(({ el }) => el.classList.add("is-on")));
}
function drawCallouts(vis) {
  let d = "", dots = "";
  const W = innerWidth, minX = small() ? 12 : W * 0.4, maxX = W - (small() ? 12 : 120);
  calloutEls.forEach(({ el, c }) => {
    const p = machine?.project(c.m);
    if (!p || !p.visible || vis < 0.05) { el.style.opacity = "0"; return; }
    const off = small() ? 60 : 150;
    let lx = p.x + c.side * off, ly = p.y + (small() ? c.dy * 0.35 : c.dy);
    lx = Math.min(maxX - (c.side > 0 ? 170 : 0), Math.max(minX + (c.side < 0 ? 170 : 0), lx));
    ly = Math.min(small() ? innerHeight * 0.5 : innerHeight - 60, Math.max(90, ly));
    const elbow = lx - c.side * 28;
    d += `M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${elbow.toFixed(1)} ${ly.toFixed(1)} L${lx.toFixed(1)} ${ly.toFixed(1)} `;
    dots += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2"/><circle class="ring" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="8"/>`;
    el.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;
    el.style.opacity = String(vis);
  });
  svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
  svg.innerHTML = `<path d="${d}" style="opacity:${vis.toFixed(3)}"/><g style="opacity:${vis.toFixed(3)}">${dots}</g>`;
}

// ---------- frame ----------
const fill = $(".guide__fill"), pct = $(".guide__pct");
function frame() {
  const pos = chapterPos();
  const i = Math.min(CHAPTERS.length - 1, Math.floor(pos));
  const f = pos - i;
  const t = ease(f);
  const a = CHAPTERS[i].state, b = CHAPTERS[Math.min(CHAPTERS.length - 1, i + 1)].state;
  machine?.setState(mix(a, b, t));

  // chapter becomes "active" while it holds
  const holding = i;
  if (holding !== active) {
    active = holding;
    buildCallouts(active);
    guideLinks.forEach((l, k) => { l.classList.toggle("is-active", k === active); l.classList.toggle("is-done", k < active); });
    sections.forEach((s, k) => s.classList.toggle("is-active", k === active));
    document.body.dataset.chapter = CHAPTERS[active].id;
  }
  const vis = Math.max(0, Math.min(1, (0.55 - f) / 0.15)) * Math.min(1, f / 0.08 + (active === 0 ? 1 : 0));
  drawCallouts(vis);

  const total = (document.documentElement.scrollHeight - innerHeight) || 1;
  const prog = Math.min(1, Math.max(0, scrollY / total));
  fill.style.transform = `scaleY(${prog})`;
  pct.textContent = String(Math.round(prog * 100)).padStart(2, "0");
  requestAnimationFrame(frame);
}

// ---------- chapter copy reveal ----------
const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle("is-in", e.isIntersecting)), { threshold: 0.35 });
$$(".chapter__card").forEach((c) => io.observe(c));

// ---------- loader ----------
const loader = $(".loader");
const count = $(".loader__count");
const target = machine?.parts ?? 1200, t0 = performance.now(), DUR = reduced ? 0 : 1400;
const step = () => {
  const k = DUR ? Math.min(1, (performance.now() - t0) / DUR) : 1;
  count.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString();
  if (k < 1) requestAnimationFrame(step);
  else setTimeout(() => { loader.classList.add("is-done"); document.body.classList.add("is-ready"); setTimeout(() => loader.remove(), 1200); }, 250);
};
step();

// ---------- copy email + clock ----------
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  const lab = b.querySelector("small");
  try { await navigator.clipboard.writeText(b.dataset.copy); if (lab) lab.textContent = "Copied — talk soon"; }
  catch { if (lab) lab.textContent = b.dataset.copy; }
});
const fmt = new Intl.DateTimeFormat("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Toronto" });
const tick = () => $$("[data-clock]").forEach((c) => (c.textContent = fmt.format(new Date())));
tick(); setInterval(tick, 15000);

frame();
