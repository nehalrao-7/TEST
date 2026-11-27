// =========================================================
// Nehal Rao — orchestration
// =========================================================
import { initScene } from "./scene.js";
import { initProduct } from "./product.js";
import { initDots, initTolerance, initWipe } from "./toys.js";
import { initWork } from "./work.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

// ---------- WebGL: particle field ----------
let scene = null;
try { scene = initScene($("#webgl"), { reducedMotion: reduced }); }
catch (err) { console.warn("WebGL unavailable — continuing without the particle field.", err); }

// ---------- WebGL: the object ----------
let product = null;
try {
  product = initProduct($(".lens__canvas"), { reduced, labelsEl: $(".lens__labels"), dimsEl: $(".lens__dims") });
} catch (err) { console.warn("Product viewer unavailable.", err); }

// ---------- Toys ----------
initDots($("#toy-dots"), $(".toy__stage--dots"));
initTolerance($("#toy-tol"), $(".toy__stage--tol"));
initWipe($(".wipe"));

// ---------- Work + drawer ----------
let lenis = null;
initWork({
  list: $(".projects"), preview: $(".preview"), drawer: $(".drawer"),
  onOpen: () => { lenis?.stop(); document.body.classList.add("drawer-open"); },
  onClose: () => { lenis?.start(); document.body.classList.remove("drawer-open"); },
});

// ---------- Premise: split words ----------
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
        if (n.tagName === "EM") n.classList.add("w"); else walk(n);
      }
    });
  };
  walk(el);
});

// ---------- Marquee duplication ----------
$$(".marquee__row").forEach((row) => { row.innerHTML += row.innerHTML; });

// ---------- Clock ----------
const clockEl = $("[data-clock]");
const fmt = new Intl.DateTimeFormat("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Toronto" });
const tickClock = () => { if (clockEl) clockEl.textContent = fmt.format(new Date()); };
tickClock(); setInterval(tickClock, 15000);

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
  try { await navigator.clipboard.writeText(btn.dataset.email); showToast("Copied — talk soon."); }
  catch { window.location.href = `mailto:${btn.dataset.email}`; }
}));

// ---------- Spec mode ----------
const specBtn = $(".spec-toggle");
let specTimer = 0, lastFrames = 0, lastT = performance.now();
function setSpec(on) {
  document.body.classList.toggle("spec-mode", on);
  specBtn.setAttribute("aria-pressed", String(on));
  clearInterval(specTimer);
  if (on) {
    showToast("Spec mode on — the working drawings");
    const upd = () => {
      const st = scene?.stats, now = performance.now();
      if (st) {
        const fps = ((st.frames - lastFrames) / (now - lastT)) * 1000;
        lastFrames = st.frames; lastT = now;
        $('[data-stat="fps"]').textContent = `${Math.round(fps)} fps`;
        $('[data-stat="particles"]').textContent = st.particles.toLocaleString();
        $('[data-stat="lines"]').textContent = st.lines.toLocaleString();
        $('[data-stat="calls"]').textContent = st.calls + (product ? ` + ${product.info.calls}` : "");
      }
      $('[data-stat="vp"]').textContent = `${innerWidth}×${innerHeight} @${Math.min(devicePixelRatio, 2)}x`;
    };
    upd(); specTimer = setInterval(upd, 600);
  }
}
specBtn.addEventListener("click", () => setSpec(!document.body.classList.contains("spec-mode")));
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== "s" || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest("input, textarea, [contenteditable]")) return;
  setSpec(!document.body.classList.contains("spec-mode"));
});

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
    const t = e.target.closest("a, button, [data-cursor], input");
    cursor.classList.toggle("is-hover", !!t);
    const label = t?.closest("[data-cursor]")?.dataset.cursor;
    cursor.classList.toggle("has-text", !!label);
    if (label) text.textContent = label;
  });
  $$("[data-magnetic]").forEach((el) => {
    const strength = el.classList.contains("contact__cta") ? 0.35 : 0.25;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - (r.left + r.width / 2)) * strength}px, ${(e.clientY - (r.top + r.height / 2)) * strength}px)`;
      el.style.transition = "transform .15s ease-out";
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
      el.style.transition = "transform .7s cubic-bezier(.22,1,.36,1)";
    });
  });
}

// ---------- Without GSAP ----------
if (!hasGsap) {
  document.body.classList.remove("is-loading");
  $(".loader")?.remove();
  scene?.fadeIn();
  product?.setProgress(1);
} else {
  run();
}

function run() {
  gsap.registerPlugin(ScrollTrigger);

  // ---------- Smooth scroll ----------
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
    else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + scrollY, behavior: reduced ? "auto" : "smooth" });
  }));

  // ---------- Intro ----------
  gsap.set(".hero__title .word", { yPercent: 110 });
  gsap.set(".hero__dot", { scale: 0 });
  gsap.set([".hero__meta", ".hero__bottom > *", ".nav"], { autoAlpha: 0, y: 20 });

  const counter = $("[data-count]");
  const prog = { v: 0 };
  gsap.timeline({ defaults: { ease: "expo.out" } })
    .to(prog, { v: 100, duration: reduced ? 0.2 : 1.6, ease: "power2.inOut", onUpdate: () => { counter.textContent = String(Math.round(prog.v)).padStart(3, "0"); } })
    .to(".loader__bar span", { scaleX: 1, duration: reduced ? 0.2 : 1.6, ease: "power2.inOut" }, 0)
    .to(".loader", { yPercent: -100, duration: 1.1, ease: "expo.inOut" }, "+=0.1")
    .add(() => { document.body.classList.remove("is-loading"); lenis?.start(); scene?.fadeIn(); }, "-=0.6")
    .to(".hero__title .word", { yPercent: 0, duration: 1.4, stagger: 0.12 }, "-=0.55")
    .to(".hero__dot", { scale: 1, duration: 1, ease: "elastic.out(1, 0.5)" }, "-=0.6")
    .to([".nav", ".hero__meta"], { autoAlpha: 1, y: 0, duration: 1 }, "-=1")
    .to(".hero__bottom > *", { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.1 }, "-=0.9")
    .add(() => $(".loader")?.remove());

  gsap.to(".hero__title", {
    yPercent: -18, opacity: 0.2, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });

  // ---------- Pins first (so later triggers account for pin spacing) ----------
  // How I think: one pinned stage, four states
  const steps = $$(".lens__step"), ticks = $$(".lens__progress span");
  let curStep = -1;
  ScrollTrigger.create({
    trigger: ".lens", start: "top top", end: () => "+=" + innerHeight * 3.2,
    pin: true, scrub: true, anticipatePin: 1,
    onToggle: (self) => $(".hud").classList.toggle("is-hidden", self.isActive),
    onUpdate: (self) => {
      product?.setProgress(self.progress);
      const s = Math.min(3, Math.floor(self.progress * 4 * 0.999 + 0.0001));
      ticks.forEach((t, i) => t.style.setProperty("--f", Math.min(1, Math.max(0, self.progress * 4 - i))));
      if (s !== curStep) {
        curStep = s;
        steps.forEach((el, i) => el.classList.toggle("is-active", i === s));
      }
    },
  });

  const mm = gsap.matchMedia();
  mm.add("(min-width: 761px)", () => {
    const track = $(".dots__track");
    const distance = () => track.scrollWidth - innerWidth;
    const horizontal = gsap.to(track, {
      x: () => -distance(), ease: "none",
      scrollTrigger: { trigger: ".dots", start: "top top", end: () => "+=" + distance(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    gsap.to(".dots__rail-fill", {
      scaleX: 1, ease: "none",
      scrollTrigger: { trigger: ".dots", start: "top top", end: () => "+=" + distance(), scrub: 1, invalidateOnRefresh: true },
    });
    $$(".dot-card").forEach((card) => ScrollTrigger.create({
      trigger: card, containerAnimation: horizontal, start: "left 78%",
      onEnter: () => card.classList.add("is-lit"), onLeaveBack: () => card.classList.remove("is-lit"),
    }));
  });
  mm.add("(max-width: 760px)", () => {
    gsap.fromTo(".dots__rail-fill", { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: ".dots__track", start: "top 60%", end: "bottom 60%", scrub: true } });
    $$(".dot-card").forEach((card) => ScrollTrigger.create({ trigger: card, start: "top 70%", onEnter: () => card.classList.add("is-lit"), onLeaveBack: () => card.classList.remove("is-lit") }));
  });

  // ---------- Section → particle shape, dimming, HUD ----------
  const hudIndex = $(".hud__index"), hudLabel = $(".hud__label");
  $$("[data-section]").forEach((sec, i) => {
    ScrollTrigger.create({
      trigger: sec, start: "top 55%", end: "bottom 45%",
      onToggle: (self) => {
        if (!self.isActive) return;
        scene?.setShape(+sec.dataset.section);
        scene?.setDim(sec.dataset.dim ? +sec.dataset.dim : 1);
        hudIndex.textContent = String(i).padStart(2, "0");
        hudLabel.textContent = sec.dataset.label || "";
      },
    });
  });
  ScrollTrigger.create({ trigger: "#story", start: "top 80%", endTrigger: ".contact", end: "bottom bottom", toggleClass: { targets: ".hud", className: "is-on" } });
  ScrollTrigger.create({ trigger: ".projects", start: "top bottom", end: "bottom top", toggleClass: { targets: ".hud", className: "is-hidden" } });
  gsap.to(".hud__fill", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

  // ---------- Premise word reveal ----------
  if (!reduced) {
    gsap.to(".premise__text .w", {
      opacity: 1, stagger: 0.05, ease: "none",
      scrollTrigger: { trigger: ".premise__text", start: "top 78%", end: "bottom 45%", scrub: 0.6 },
    });
  }

  // ---------- Reveals ----------
  const revealUp = (targets, trigger) => gsap.from(targets, {
    y: 60, autoAlpha: 0, duration: 1.2, ease: "expo.out", stagger: 0.08,
    scrollTrigger: { trigger: trigger || targets, start: "top 85%" },
  });
  $$(".h2").forEach((h) => revealUp(h));
  $$(".eyebrow").forEach((e) => revealUp(e));
  $$(".toy").forEach((t) => {
    revealUp($$(".toy__copy > *", t), t);
    gsap.from($(".toy__stage", t), { clipPath: "inset(12% 12% 12% 12% round 8px)", autoAlpha: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: t, start: "top 75%" } });
  });
  revealUp(".work__intro");
  gsap.from(".project", { y: 40, autoAlpha: 0, duration: 1, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: ".projects", start: "top 80%" } });
  revealUp(".contact__lead");
  revealUp(".contact__cta");
  revealUp(".contact__links a", ".contact__links");

  gsap.set(".contact__title .word", { yPercent: 110 });
  gsap.to(".contact__title .word", { yPercent: 0, duration: 1.4, ease: "expo.out", stagger: 0.12, scrollTrigger: { trigger: ".contact__title", start: "top 80%" } });

  // ---------- Marquees ----------
  $$(".marquee__row").forEach((row) => {
    const dir = +row.dataset.dir;
    let x = dir > 0 ? -row.scrollWidth / 2 : 0, boost = 0;
    lenis?.on("scroll", (e) => { boost = Math.min(Math.abs(e.velocity) * 0.25, 12); });
    gsap.ticker.add(() => {
      if (reduced) return;
      const half = row.scrollWidth / 2;
      x += dir * (0.6 + boost); boost *= 0.94;
      if (x <= -half) x += half;
      if (x >= 0) x -= half;
      row.style.transform = `translate3d(${x}px,0,0)`;
    });
  });

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener("load", () => ScrollTrigger.refresh());
}
