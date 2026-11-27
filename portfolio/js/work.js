// =========================================================
// Work, unfolded — list rows, cursor preview, process drawer
// PLACEHOLDER CONTENT: project details below are illustrative.
// Replace with real stories and swap the frames for real photos.
// =========================================================
import { frame } from "./art.js";

export const projects = [
  {
    key: "lumen", title: "Lumen", org: "Elevety", disc: "Industrial design · DFM", year: "2018",
    premise: "A lamp that's also a speaker — designed so the factory loves it as much as the customer does.",
    question: "What if the most beautiful version was also the cheapest one to build?",
    how: "I sketched forty silhouettes, then killed every one that needed more than one machined part. The survivor got a single aluminium core that's structure, heatsink and enclosure at once. The bezel became the only control — turn for volume, tap for light.",
    stuck: "Design for assembly isn't a constraint on beauty. It's where the beauty comes from.",
    outcome: "61 parts became 38. Same silhouette.",
    notes: ["one part??", "core = heatsink", "v0.4 — finally"],
  },
  {
    key: "line", title: "Line 4", org: "Weston Foods", disc: "Production engineering", year: "2017",
    premise: "A high‑speed bakery line, where every idle minute costs thousands of loaves.",
    question: "Why does a changeover take ninety minutes when the actual work takes twenty?",
    how: "I stood on the floor with a stopwatch for two weeks. Most of the lost time wasn't work — it was searching. So I designed a colour‑coded tooling cart and quick‑release fixtures, so nothing ever has to be found.",
    stuck: "The best engineering often looks like tidying up. Watch first, design second.",
    outcome: "Changeovers cut by about a fifth.",
    notes: ["where's the 13mm?", "cart → colour code", "trial run ✓"],
  },
  {
    key: "wayfinder", title: "Wayfinder", org: "HackPrinceton", disc: "Hardware + software", year: "36 hrs",
    premise: "A wristband that guides you through a city with taps instead of a screen.",
    question: "Can you navigate somewhere new without ever looking down?",
    how: "Hour 1: a paper prototype taped to a wrist. Hour 6: vibration motors on a breadboard. Hour 30: a 3D‑printed band talking to a phone app. We tested on strangers in the hallway every few hours and changed the tap patterns each time.",
    stuck: "Ship the demo, not the slide. Judges remember what they can wear.",
    outcome: "Best Overall Hack.",
    notes: ["left = 2 taps?", "motors x4", "hour 30"],
  },
  {
    key: "site", title: "This website", org: "Personal", disc: "Creative development · WebGL", year: "2026",
    premise: "A portfolio that shows how I think instead of telling you.",
    question: "How do you show a process, not just results?",
    how: "I wrote the story first, then built the system: one accent colour, three typefaces, six particle shapes. Everything 3D is generated in code — GLSL shaders, procedural geometry, no imported models. Press S anywhere to see the working drawings.",
    stuck: "Constraints breed identity. One accent colour meant every use of it had to earn its place.",
    outcome: "4,200 particles · 0 templates.",
    notes: ["dots → lines!", "helix = timeline", "press S"],
  },
  {
    key: "bolo", title: "Current work", org: "BOLO", disc: "[Replace — discipline]", year: "Now",
    premise: "[Replace] One sentence on what Nehal is building at BOLO.",
    question: "[Replace] The question driving the current work.",
    how: "[Replace] How Nehal is approaching it: the first sketches, the experiments, the decisions.",
    stuck: "[Replace] One lesson so far.",
    outcome: "In progress.",
    notes: ["fog → path", "Q2?", "ship it"],
  },
];

const STAGES = [["sketch", "Sketch"], ["model", "Model"], ["proto", "Prototype"], ["final", "Shipped"]];

export function initWork({ list, preview, drawer, onOpen, onClose }) {
  if (!list) return;
  list.innerHTML = projects.map((p, i) => `
    <li class="project" data-i="${i}">
      <button class="project__btn" type="button" data-cursor="Open">
        <span class="project__num mono">0${i + 1}</span>
        <span class="project__title">${p.title}</span>
        <span class="project__org mono">${p.org}</span>
        <span class="project__disc">${p.disc}</span>
        <span class="project__year mono">${p.year}</span>
        <span class="project__arrow" aria-hidden="true">→</span>
      </button>
    </li>`).join("");

  // ---- cursor preview (desktop) ----
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const inner = preview?.querySelector(".preview__inner");
  if (fine && preview) {
    const pos = { x: 0, y: 0, cx: 0, cy: 0 };
    let raf = 0;
    const tick = () => {
      pos.cx += (pos.x - pos.cx) * 0.14; pos.cy += (pos.y - pos.cy) * 0.14;
      preview.style.transform = `translate(${pos.cx}px, ${pos.cy}px) rotate(${(pos.x - pos.cx) * 0.03}deg)`;
      raf = requestAnimationFrame(tick);
    };
    list.addEventListener("pointerenter", () => { cancelAnimationFrame(raf); tick(); preview.classList.add("is-on"); });
    list.addEventListener("pointerleave", () => { preview.classList.remove("is-on"); cancelAnimationFrame(raf); });
    list.addEventListener("pointermove", (e) => { pos.x = e.clientX + 24; pos.y = e.clientY - 120; });
    list.querySelectorAll(".project").forEach((row) => row.addEventListener("pointerenter", () => {
      const p = projects[+row.dataset.i];
      inner.innerHTML = frame(p.key, "final");
    }));
  }

  // ---- drawer ----
  const content = drawer.querySelector(".drawer__content");
  let lastFocus = null;
  function open(i) {
    const p = projects[i];
    content.innerHTML = `
      <p class="drawer__kicker mono"><span>0${i + 1}</span> ${p.org} · ${p.disc} · ${p.year}</p>
      <h3 class="drawer__title" id="drawer-title">${p.title}</h3>
      <p class="drawer__premise">${p.premise}</p>
      <div class="strip">
        ${STAGES.map(([s, label], k) => `
          <figure class="strip__frame strip__frame--${s}">
            ${frame(p.key, s, p.notes[Math.min(k, 2)])}
            <figcaption class="mono"><span>0${k + 1}</span> ${label}</figcaption>
          </figure>`).join("")}
      </div>
      <dl class="drawer__qa">
        <div><dt class="mono">The question</dt><dd class="drawer__q">${p.question}</dd></div>
        <div><dt class="mono">How I worked it</dt><dd>${p.how}</dd></div>
        <div><dt class="mono">What stuck with me</dt><dd class="drawer__stuck">${p.stuck}</dd></div>
        <div><dt class="mono">Where it landed</dt><dd>${p.outcome}</dd></div>
      </dl>
      <div class="drawer__nav">
        <button class="mono" type="button" data-go="${(i + projects.length - 1) % projects.length}">← ${projects[(i + projects.length - 1) % projects.length].title}</button>
        <button class="mono" type="button" data-go="${(i + 1) % projects.length}">${projects[(i + 1) % projects.length].title} →</button>
      </div>`;
    content.parentElement.scrollTop = 0;
    if (!drawer.classList.contains("is-open")) {
      lastFocus = document.activeElement;
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      onOpen?.();
    }
    content.querySelectorAll(".strip__frame").forEach((f, k) => { f.style.setProperty("--k", k); });
    drawer.querySelector(".drawer__close").focus({ preventScroll: true });
  }
  function close() {
    if (!drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    onClose?.();
    lastFocus?.focus({ preventScroll: true });
  }

  list.addEventListener("click", (e) => {
    const row = e.target.closest(".project");
    if (row) open(+row.dataset.i);
  });
  drawer.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) close();
    const go = e.target.closest("[data-go]");
    if (go) open(+go.dataset.go);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}
