// =========================================================
// The story: scroll → one object's life, one line per screen.
// =========================================================
import { createObject } from "./object.js";

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let object = null;
try { object = createObject($("#stage"), { reduced }); }
catch (e) { console.warn("WebGL unavailable", e); document.body.classList.add("no-webgl"); }

// Each scene returns the object's state for its local progress f (0..1).
const SCENES = [
  { id: "hello", word: "NEHAL RAO", solid: true,
    s: () => ({ cam: [0, 0.45, 7.4], look: [0, 0.05, 0], gloss: 1, detail: 1, spin: 0.3 }) },
  { id: "line", word: "“LINE”",
    s: (f) => ({ cam: [0, 0.5, 6.8], look: [0, 0, 0], line: 1, lineDraw: Math.min(1, 0.04 + f * 1.7), spin: 0.12 }) },
  { id: "form", word: "“FORM”",
    s: () => ({ cam: [1.6, 1.3, 6.6], look: [0, -0.05, 0], clay: 1, line: 0.18, lineDraw: 1, spin: 0.22 }) },
  { id: "finish", word: "“FINISH”", dark: true,
    s: () => ({ cam: [2.9, 0.7, 6.9], look: [0, -0.05, 0], gloss: 1, detail: 1, dark: 1, spin: 0.16, offX: 0.1 }) },
  { id: "production", word: "", count: true,
    s: (f) => ({ cam: [0.4, 17 + f * 6, 21 + f * 6], look: [0, -1.4, -3], gloss: 1, detail: 0, army: Math.min(1, 0.15 + f * 1.5), spin: 0.06 }) },
  { id: "record", word: "",
    s: () => ({ cam: [0, 0.4, 8.2], look: [0, 0, 0], gloss: 1, detail: 1, spin: 0.2, offX: 0.2, scale: 0.85 }) },
  { id: "next", word: "", dark: true,
    s: () => ({ cam: [0, 0.35, 7.6], look: [0, 0, 0], gloss: 1, detail: 1, dark: 1, orange: 1, spin: 0.35, offX: 0.17, scale: 0.92 }) },
];

const sections = $$(".scene");
const word = $(".word"), wordIn = $(".word__in");

// ---------- guide ----------
$(".guide__list").innerHTML = sections.map((s, i) => `<li><a href="#${s.id}"><span class="guide__n">${String(i).padStart(2, "0")}</span><span class="guide__l">${s.dataset.label}</span></a></li>`).join("");
const guideLinks = $$(".guide__list a");

// ---------- smooth scroll ----------
let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.08, smoothWheel: true });
  (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
}
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  const t = $(a.getAttribute("href")); if (!t) return;
  e.preventDefault();
  lenis ? lenis.scrollTo(t, { duration: 1.8 }) : t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
});

// ---------- scroll position as (scene index, local progress) ----------
function where() {
  const mid = innerHeight * 0.5;
  for (let i = 0; i < sections.length; i++) {
    const r = sections[i].getBoundingClientRect();
    if (r.top <= mid && r.bottom > mid) return [i, (mid - r.top) / r.height];
  }
  return sections[0].getBoundingClientRect().top > mid ? [0, 0] : [sections.length - 1, 0.999];
}
const ease = (x) => { const t = Math.min(1, Math.max(0, (x - 0.62) / 0.38)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const KEYS = ["line", "lineDraw", "clay", "gloss", "detail", "army", "orange", "offX", "offY", "objX", "objY", "scale", "spin", "dark"];
function mix(a, b, t) {
  const o = { cam: a.cam.map((v, i) => lerp(v, b.cam[i], t)), look: a.look.map((v, i) => lerp(v, b.look[i], t)) };
  KEYS.forEach((k) => (o[k] = lerp(a[k] ?? (k === "scale" ? 1 : 0), b[k] ?? (k === "scale" ? 1 : 0), t)));
  return o;
}

// ---------- background: off-white ⇄ black ----------
const LIGHT = [239, 237, 232], DARK = [10, 10, 10];
function paint(d) {
  const c = LIGHT.map((v, i) => Math.round(lerp(v, DARK[i], d)));
  document.documentElement.style.setProperty("--bg", `rgb(${c.join(",")})`);
  document.body.classList.toggle("is-dark", d > 0.5);
}

// ---------- frame ----------
let active = -1;
const fill = $(".guide__fill");
const countEl = $("[data-count]");
function frame() {
  const [i, f] = where();
  const a = SCENES[i].s(f), b = SCENES[Math.min(SCENES.length - 1, i + 1)].s(0);
  const st = mix(a, b, i < SCENES.length - 1 ? ease(f) : 0);
  object?.setState(st);
  paint(st.dark || 0);

  if (i !== active) {
    active = i;
    sections.forEach((s, k) => s.classList.toggle("is-active", k === i));
    guideLinks.forEach((l, k) => { l.classList.toggle("is-active", k === i); l.classList.toggle("is-past", k < i); });
    word.classList.remove("is-on");
    setTimeout(() => {
      wordIn.textContent = SCENES[i].word;
      word.classList.toggle("is-solid", !!SCENES[i].solid);
      word.classList.add("is-on");
    }, 220);
  }
  // production counter climbs with the scroll
  if (SCENES[i].count && countEl) countEl.textContent = Math.round(Math.min(1, f * 1.4) * 10000).toLocaleString();
  // "One more thing." → "I'm available."
  sections[sections.length - 1].classList.toggle("is-revealed", i === sections.length - 1 && f > 0.32);
  word.style.opacity = String(1 - ease(f) * 0.9);

  const total = document.documentElement.scrollHeight - innerHeight || 1;
  fill.style.transform = `scaleY(${Math.min(1, scrollY / total)})`;
  requestAnimationFrame(frame);
}

// ---------- intro ----------
setTimeout(() => document.body.classList.add("is-ready"), reduced ? 0 : 900);

// ---------- copy email + clock ----------
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  const lab = b.querySelector("small");
  try { await navigator.clipboard.writeText(b.dataset.copy); if (lab) lab.textContent = "“COPIED”"; }
  catch { if (lab) lab.textContent = b.dataset.copy; }
});
const fmt = new Intl.DateTimeFormat("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Toronto" });
const tick = () => $$("[data-clock]").forEach((c) => (c.textContent = fmt.format(new Date())));
tick(); setInterval(tick, 15000);

frame();
