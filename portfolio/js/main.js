// =========================================================
// Nehal Rao — interactions, scroll choreography, scene sync
// =========================================================
import { initScene } from "./scene.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

// ---------- WebGL ----------
let scene = null;
try {
  scene = initScene($("#webgl"), { reducedMotion: reduced });
} catch (err) {
  console.warn("WebGL unavailable — continuing without the particle field.", err);
}

// ---------- Blueprint drawings for case visuals ----------
const blueprints = [
  // 0 — product housing, side profile with dimensions
  `<rect class="bp-line" x="90" y="120" width="220" height="150" rx="34"/>
   <rect class="bp-line" x="110" y="140" width="180" height="110" rx="20"/>
   <circle class="bp-accent" cx="200" cy="195" r="42"/>
   <circle class="bp-line" cx="200" cy="195" r="18"/>
   <path class="bp-dim" d="M200 120 V80 M90 100 H310 M90 94 V106 M310 94 V106"/>
   <path class="bp-dim" d="M330 120 V270 M324 120 H336 M324 270 H336"/>
   <path class="bp-accent" d="M158 195 H120 M242 195 H280"/>
   <text x="170" y="92">220.0 mm</text><text x="340" y="200">150</text>
   <text x="206" y="250">Ø 42.0</text><text x="96" y="300">REV C — PART COUNT 61 → 38</text>`,
  // 1 — production line rollers
  `<path class="bp-line" d="M40 230 H360 M40 270 H360"/>
   ${[60, 110, 160, 210, 260, 310, 350].map((x) => `<circle class="bp-line" cx="${x}" cy="250" r="16"/><circle class="bp-accent" cx="${x}" cy="250" r="3"/>`).join("")}
   <rect class="bp-accent" x="120" y="170" width="70" height="56" rx="4"/>
   <rect class="bp-line" x="220" y="182" width="56" height="44" rx="4"/>
   <path class="bp-dim" d="M40 140 H360 M40 134 V146 M360 134 V146"/>
   <path class="bp-accent" d="M300 120 l20 0 l-6 -6 M320 120 l-6 6"/>
   <text x="44" y="128">LINE 4 — 10,000 u/h</text><text x="44" y="320">CHANGEOVER  −22%</text>`,
  // 2 — wearable with haptic motors
  `<ellipse class="bp-line" cx="200" cy="200" rx="130" ry="70"/>
   <ellipse class="bp-line" cx="200" cy="200" rx="108" ry="52"/>
   ${[[110, 168], [290, 168], [110, 232], [290, 232]].map(([x, y], i) => `<circle class="bp-accent" cx="${x}" cy="${y}" r="9"/><text x="${x - 8}" y="${y + (y < 200 ? -16 : 26)}">M${i + 1}</text>`).join("")}
   <rect class="bp-accent" x="176" y="184" width="48" height="32" rx="4"/>
   <path class="bp-dim" d="M200 92 q 30 -20 60 0 M200 74 q 45 -30 90 0 M200 56 q 60 -40 120 0"/>
   <text x="70" y="330">HAPTIC BAND — 36H BUILD</text>`,
  // 3 — roadmap from fog to path
  `${Array.from({ length: 9 }, (_, i) => `<path class="bp-dim" d="M${40 + i * 6} ${90 + i * 26} q 60 -20 120 0 t 120 0"/>`).join("")}
   <path class="bp-accent" d="M60 300 C 140 300, 140 200, 200 200 S 280 100, 340 100"/>
   ${[[60, 300], [200, 200], [340, 100]].map(([x, y]) => `<circle class="bp-accent" cx="${x}" cy="${y}" r="8"/>`).join("")}
   <text x="44" y="330">Q1</text><text x="190" y="232">Q2</text><text x="330" y="80">Q3</text>`,
];
$$(".case__visual").forEach((el) => {
  const svg = $("svg", el);
  svg.innerHTML = blueprints[+el.dataset.shape] || "";
});

// ---------- Word splitting for the premise ----------
$$(".split-words").forEach((el) => {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else { const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.appendChild(s); }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) {
        if (n.tagName === "EM") { n.classList.add("w"); } else walk(n);
      }
    });
  };
  walk(el);
});

// ---------- Marquee duplication ----------
$$(".marquee__row").forEach((row) => { row.innerHTML += row.innerHTML; });

// ---------- Toronto clock ----------
const clockEl = $("[data-clock]");
const fmt = new Intl.DateTimeFormat("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Toronto" });
const updateClock = () => { if (clockEl) clockEl.textContent = fmt.format(new Date()); };
updateClock(); setInterval(updateClock, 15000);

// ---------- Copy email ----------
const toast = $(".toast");
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-on"), 2200);
}
$$("[data-email]").forEach((btn) => btn.addEventListener("click", async () => {
  const email = btn.dataset.email;
  try { await navigator.clipboard.writeText(email); showToast("Copied — talk soon."); }
  catch { window.location.href = `mailto:${email}`; }
}));

// ---------- Count-ups ----------
function countUp(el) {
  if (el.dataset.done) return;
  el.dataset.done = "1";
  const end = +el.dataset.countup;
  const pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
  if (reduced || !hasGsap) { el.textContent = pre + end + suf; return; }
  const o = { v: 0 };
  gsap.to(o, { v: end, duration: 1.8, ease: "power3.out", onUpdate: () => { el.textContent = pre + Math.round(o.v) + suf; } });
}

// ---------- Cursor + magnetic ----------
const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
if (fine && !reduced) {
  const cursor = $(".cursor"), dot = $(".cursor__dot"), ringEl = $(".cursor__ring"), text = $(".cursor__text");
  const pos = { x: innerWidth / 2, y: innerHeight / 2 }, ring = { ...pos };
  window.addEventListener("pointermove", (e) => { pos.x = e.clientX; pos.y = e.clientY; }, { passive: true });
  (function loop() {
    ring.x += (pos.x - ring.x) * 0.16; ring.y += (pos.y - ring.y) * 0.16;
    dot.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
    ringEl.style.transform = `translate(${ring.x}px, ${ring.y}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  })();
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest("a, button, [data-cursor]");
    cursor.classList.toggle("is-hover", !!t);
    const label = t?.dataset.cursor;
    cursor.classList.toggle("has-text", !!label);
    if (label) text.textContent = label;
  });

  $$("[data-magnetic]").forEach((el) => {
    const strength = el.classList.contains("contact__cta") ? 0.35 : 0.25;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * strength;
      const y = (e.clientY - (r.top + r.height / 2)) * strength;
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.transition = "transform .15s ease-out";
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
      el.style.transition = "transform .7s cubic-bezier(.22,1,.36,1)";
    });
  });
}

// ---------- Fallback: no GSAP or reduced motion ----------
if (!hasGsap) {
  document.body.classList.remove("is-loading");
  $(".loader")?.remove();
  scene?.fadeIn();
  $$("[data-countup]").forEach(countUp);
} else {
  run();
}

function run() {
  gsap.registerPlugin(ScrollTrigger);

  // ---------- Smooth scroll ----------
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on("scroll", (e) => { ScrollTrigger.update(); scene?.setVelocity(e.velocity); });
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id === "#top" ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else window.scrollTo({ top: target === 0 ? 0 : target.offsetTop, behavior: reduced ? "auto" : "smooth" });
  }));

  // ---------- Hero: initial state ----------
  gsap.set(".hero__title .word", { yPercent: 110 });
  gsap.set(".hero__dot", { scale: 0 });
  gsap.set([".hero__meta", ".hero__bottom > *", ".nav"], { autoAlpha: 0, y: 20 });

  // ---------- Loader ----------
  const counter = $("[data-count]");
  const prog = { v: 0 };
  const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
  intro
    .to(prog, {
      v: 100, duration: reduced ? 0.2 : 1.8, ease: "power2.inOut",
      onUpdate: () => { counter.textContent = String(Math.round(prog.v)).padStart(3, "0"); },
    })
    .to(".loader__bar span", { scaleX: 1, duration: reduced ? 0.2 : 1.8, ease: "power2.inOut" }, 0)
    .to(".loader", { yPercent: -100, duration: 1.1, ease: "expo.inOut" }, "+=0.15")
    .add(() => { document.body.classList.remove("is-loading"); lenis?.start(); }, "-=0.6")
    .to(".hero__title .word", { yPercent: 0, duration: 1.4, stagger: 0.12 }, "-=0.55")
    .to(".hero__dot", { scale: 1, duration: 1, ease: "elastic.out(1, 0.5)" }, "-=0.6")
    .to([".nav", ".hero__meta"], { autoAlpha: 1, y: 0, duration: 1 }, "-=1")
    .to(".hero__bottom > *", { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.1 }, "-=0.9")
    .add(() => $(".loader")?.remove());

  // fade particle field in alongside the reveal
  if (scene) {
    gsap.fromTo(scene.uniforms.uOpacity, { value: 0 }, { value: 1, duration: 2.4, delay: reduced ? 0.4 : 2.2, ease: "power2.out" });
  }

  // Hero parallax out
  gsap.to(".hero__title", {
    yPercent: -18, opacity: 0.2, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });

  // ---------- Responsive choreography ----------
  const mm = gsap.matchMedia();

  mm.add("(min-width: 761px)", () => {
    // Horizontal timeline
    const track = $(".dots__track");
    const distance = () => track.scrollWidth - window.innerWidth;
    const horizontal = gsap.to(track, {
      x: () => -distance(), ease: "none",
      scrollTrigger: {
        trigger: ".dots", start: "top top", end: () => "+=" + distance(),
        pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
      },
    });
    gsap.to(".dots__rail-fill", {
      scaleX: 1, ease: "none",
      scrollTrigger: { trigger: ".dots", start: "top top", end: () => "+=" + distance(), scrub: 1, invalidateOnRefresh: true },
    });
    $$(".dot-card").forEach((card) => {
      ScrollTrigger.create({
        trigger: card, containerAnimation: horizontal, start: "left 75%",
        onEnter: () => card.classList.add("is-lit"), onLeaveBack: () => card.classList.remove("is-lit"),
      });
    });

    // Stacking case studies
    const cases = $$(".case");
    cases.forEach((c, i) => {
      const next = cases[i + 1];
      if (!next) return;
      gsap.to(c, {
        scale: 0.94, filter: "brightness(0.35)", ease: "none",
        scrollTrigger: { trigger: next, start: "top bottom", end: "top 90px", scrub: true },
      });
    });
  });

  mm.add("(max-width: 760px)", () => {
    gsap.fromTo(".dots__rail-fill", { scaleY: 0 }, {
      scaleY: 1, ease: "none",
      scrollTrigger: { trigger: ".dots__track", start: "top 60%", end: "bottom 60%", scrub: true },
    });
    $$(".dot-card").forEach((card) => {
      ScrollTrigger.create({ trigger: card, start: "top 70%", onEnter: () => card.classList.add("is-lit"), onLeaveBack: () => card.classList.remove("is-lit") });
      gsap.from(card, { y: 50, autoAlpha: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: card, start: "top 90%" } });
    });
  });

  // ---------- Section → shape + HUD ----------
  const hudIndex = $(".hud__index"), hudLabel = $(".hud__label");
  const sections = $$("[data-section]");
  sections.forEach((sec, i) => {
    ScrollTrigger.create({
      trigger: sec, start: "top 55%", end: "bottom 45%",
      onToggle: (self) => {
        if (!self.isActive) return;
        scene?.setShape(+sec.dataset.section);
        hudIndex.textContent = String(i).padStart(2, "0");
        hudLabel.textContent = sec.dataset.label || "";
      },
    });
  });
  ScrollTrigger.create({
    trigger: "#story", start: "top 80%", endTrigger: ".contact", end: "bottom bottom",
    toggleClass: { targets: ".hud", className: "is-on" },
  });
  ScrollTrigger.create({
    trigger: ".cases", start: "top bottom", end: "bottom top",
    toggleClass: { targets: ".hud", className: "is-hidden" },
  });
  gsap.to(".hud__fill", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

  // ---------- Premise word reveal ----------
  if (!reduced) {
    gsap.to(".premise__text .w", {
      opacity: 1, stagger: 0.05, ease: "none",
      scrollTrigger: { trigger: ".premise__text", start: "top 78%", end: "bottom 45%", scrub: 0.6 },
    });
  }

  // ---------- Generic reveals ----------
  const revealUp = (targets, trigger, extra = {}) => gsap.from(targets, {
    y: 60, autoAlpha: 0, duration: 1.2, ease: "expo.out", stagger: 0.08,
    scrollTrigger: { trigger: trigger || targets, start: "top 85%" }, ...extra,
  });
  $$(".h2").forEach((h) => revealUp(h));
  $$(".eyebrow").forEach((e) => revealUp(e));
  revealUp(".fact", ".premise__facts");
  revealUp(".work__intro");
  revealUp(".power", ".powers");
  revealUp(".number", ".numbers");
  $$(".voice").forEach((v) => revealUp(v));
  revealUp(".contact__lead");
  revealUp(".contact__cta");
  revealUp(".contact__links a", ".contact__links");

  // Contact headline
  gsap.set(".contact__title .word", { yPercent: 110 });
  gsap.to(".contact__title .word", {
    yPercent: 0, duration: 1.4, ease: "expo.out", stagger: 0.12,
    scrollTrigger: { trigger: ".contact__title", start: "top 80%" },
  });

  // Count-ups
  $$("[data-countup]").forEach((el) => ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: () => countUp(el) }));

  // Blueprint line drawing
  $$(".case__visual svg").forEach((svg) => {
    const shapes = $$("path, circle, rect, ellipse", svg);
    shapes.forEach((s) => {
      const len = s.getTotalLength ? s.getTotalLength() : 600;
      s.style.strokeDasharray = s.classList.contains("bp-dim") ? "4 4" : `${len}`;
      if (!s.classList.contains("bp-dim")) s.style.strokeDashoffset = `${len}`;
    });
    gsap.to(shapes.filter((s) => !s.classList.contains("bp-dim")), {
      strokeDashoffset: 0, duration: 2, ease: "power2.inOut", stagger: 0.04,
      scrollTrigger: { trigger: svg, start: "top 80%" },
    });
    gsap.from($$("text, .bp-dim", svg), { opacity: 0, duration: 1, stagger: 0.05, delay: 0.6, scrollTrigger: { trigger: svg, start: "top 80%" } });
  });

  // ---------- Marquees (velocity-reactive) ----------
  $$(".marquee__row").forEach((row) => {
    const dir = +row.dataset.dir;
    let x = dir > 0 ? -row.scrollWidth / 2 : 0;
    let boost = 0;
    lenis?.on("scroll", (e) => { boost = Math.min(Math.abs(e.velocity) * 0.25, 12); });
    gsap.ticker.add(() => {
      if (reduced) return;
      const half = row.scrollWidth / 2;
      x += dir * (0.6 + boost);
      boost *= 0.94;
      if (x <= -half) x += half;
      if (x >= 0) x -= half;
      row.style.transform = `translate3d(${x}px,0,0)`;
    });
  });

  // Fonts can shift layout — refresh triggers once they're in
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener("load", () => ScrollTrigger.refresh());
}
