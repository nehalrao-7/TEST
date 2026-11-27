// =========================================================
// Habit toys: connect-the-dots, tolerance slider, proto wipe
// =========================================================
import { rough, clean, motifs } from "./art.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

// ---------- 01 · Connect the dots → a light bulb (an idea) ----------
export function initDots(svg, stage) {
  if (!svg) return;
  const cx = 200, cy = 168, R = 98;
  const pts = [235, 200, 162, 125, 90, 55, 18, -20, -55].map((d) => {
    const a = (d * Math.PI) / 180;
    return [cx + Math.cos(a) * R, cy - Math.sin(a) * R];
  });
  pts.push([246, 292], [246, 330], [154, 330], [154, 292]);

  let next = 1, done = false;
  const gLines = el("g", { class: "cd-lines" });
  const band = el("line", { class: "cd-band" });
  const gFill = el("g", { class: "cd-fill" });
  const gDots = el("g");
  svg.append(gFill, gLines, band, gDots);

  const dots = pts.map(([x, y], i) => {
    const g = el("g", { class: "cd-dot" + (i === 0 ? " is-on" : i === 1 ? " is-next" : "") });
    g.append(el("circle", { cx: x, cy: y, r: 16, class: "cd-hit" }), el("circle", { cx: x, cy: y, r: 5, class: "cd-pt" }));
    const t = el("text", { x: x + (x < cx ? -14 : 12), y: y - 10, class: "cd-num", "text-anchor": x < cx ? "end" : "start" });
    t.textContent = i + 1;
    g.append(t);
    gDots.append(g);
    return g;
  });

  const toSvg = (e) => {
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  };

  function connect(i) {
    const [a, b] = [pts[i - 1], pts[i % pts.length]];
    const ln = el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "cd-seg" });
    gLines.append(ln);
    dots[i % pts.length].classList.add("is-on");
    dots[i % pts.length].classList.remove("is-next");
    next = i + 1;
    if (next <= pts.length) dots[next % pts.length].classList.add("is-next");
    if (next > pts.length) finish();
  }

  function finish() {
    done = true;
    band.setAttribute("visibility", "hidden");
    const d = "M" + pts.map((p) => p.join(" ")).join(" L") + " Z";
    gFill.innerHTML = `<path d="${d}" class="cd-glow"/>
      <path d="M182 292 L182 236 Q200 214 218 236 L218 292" class="cd-filament"/>
      <path d="M170 306 H230 M170 318 H230" class="cd-thread"/>
      ${[170, 145, 120, 90, 60, 35, 10].map((deg, k) => {
        const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
        return `<line class="cd-ray" style="--k:${k}" x1="${cx + c * (R + 16)}" y1="${cy - s * (R + 16)}" x2="${cx + c * (R + 40)}" y2="${cy - s * (R + 40)}"/>`;
      }).join("")}`;
    stage.classList.add("is-done");
  }

  function reset() {
    gLines.innerHTML = ""; gFill.innerHTML = "";
    dots.forEach((d, i) => d.setAttribute("class", "cd-dot" + (i === 0 ? " is-on" : i === 1 ? " is-next" : "")));
    next = 1; done = false; band.removeAttribute("visibility");
    stage.classList.remove("is-done");
  }

  svg.addEventListener("pointermove", (e) => {
    if (done) return;
    const p = toSvg(e);
    const [ax, ay] = pts[next - 1];
    band.setAttribute("x1", ax); band.setAttribute("y1", ay);
    band.setAttribute("x2", p.x); band.setAttribute("y2", p.y);
    const [tx, ty] = pts[next % pts.length];
    if (Math.hypot(p.x - tx, p.y - ty) < 18) connect(next);
  });
  svg.addEventListener("pointerleave", () => band.setAttribute("x2", band.getAttribute("x1") || 0));
  dots.forEach((d, i) => d.addEventListener("click", () => { if (!done && i === next % pts.length) connect(next); }));
  stage.querySelector(".toy__reset")?.addEventListener("click", reset);
}

// ---------- 02 · Tolerance ----------
export function initTolerance(svg, stage) {
  if (!svg) return;
  const range = stage.querySelector(".tol__range");
  const out = stage.querySelector(".tol__value");
  const verdict = stage.querySelector(".tol__verdict");

  svg.innerHTML = `
    <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" class="hatch"/></pattern></defs>
    <rect x="40" y="130" width="100" height="120" class="housing"/><rect x="260" y="130" width="100" height="120" class="housing"/>
    <rect x="40" y="130" width="100" height="120" fill="url(#hatch)"/><rect x="260" y="130" width="100" height="120" fill="url(#hatch)"/>
    <g class="shaft-g"><rect class="shaft" x="140" y="34" width="120" height="216" rx="3"/></g>
    <rect class="clash clash--l" x="140" y="130" width="0" height="120"/><rect class="clash clash--r" x="260" y="130" width="0" height="120"/>
    <path class="tdim" d="M140 274 H260 M140 266 V282 M260 266 V282"/>
    <text class="ttxt" x="200" y="296" text-anchor="middle">HOLE Ø 10.00 H7</text>
    <text class="ttxt ttxt--shaft" x="200" y="24" text-anchor="middle">SHAFT Ø 9.78</text>
    <text class="ttxt ttxt--note" x="372" y="128" text-anchor="end">× 500 scale</text>`;

  const shaft = svg.querySelector(".shaft");
  const g = svg.querySelector(".shaft-g");
  const shaftTxt = svg.querySelector(".ttxt--shaft");
  const clashL = svg.querySelector(".clash--l"), clashR = svg.querySelector(".clash--r");

  function update() {
    const c = +range.value / 100; // mm
    const w = 120 - c * 150;
    shaft.setAttribute("x", 200 - w / 2);
    shaft.setAttribute("width", w);
    const over = Math.max(0, (w - 120) / 2);
    clashL.setAttribute("x", 140 - over); clashL.setAttribute("width", over);
    clashR.setAttribute("width", over);
    shaftTxt.textContent = `SHAFT Ø ${(10 - c).toFixed(2)}`;
    out.textContent = `${c >= 0 ? "+" : "−"}${Math.abs(c).toFixed(2)} mm`;
    let state, text;
    if (c < 0) { state = "bad"; text = "Interference — it won't go together. (Unless that's the point: press fit.)"; }
    else if (c < 0.03) { state = "warn"; text = "Snug — needs a press. Great for bearings, terrible for a battery door."; }
    else if (c <= 0.08) { state = "good"; text = "Just right — slides in, doesn't rattle. This is the one. ✓"; }
    else if (c <= 0.15) { state = "warn"; text = "Easy — fine for a lid, sloppy for a hinge."; }
    else { state = "bad"; text = "Loose — it'll rattle by Tuesday."; }
    stage.dataset.state = state;
    verdict.textContent = text;
    g.classList.toggle("rattle", c > 0.12);
    range.style.setProperty("--p", ((+range.value - +range.min) / (+range.max - +range.min)) * 100 + "%");
  }
  range.addEventListener("input", update);
  update();
}

// ---------- 03 · Prototype ugly → finish beautiful ----------
export function initWipe(wrap) {
  if (!wrap) return;
  const roughSvg = wrap.querySelector(".wipe__rough");
  const cleanWrap = wrap.querySelector(".wipe__clean");
  const cleanSvg = cleanWrap.querySelector("svg");
  const handle = wrap.querySelector(".wipe__handle");

  roughSvg.innerHTML = rough(motifs.lumen, { seed: 21, jitter: 4, passes: 3 }) +
    `<rect class="tape" x="96" y="140" width="40" height="24" transform="rotate(-18 116 152)"/>
     <rect class="tape" x="262" y="190" width="40" height="22" transform="rotate(14 282 201)"/>
     <circle class="glue" cx="150" cy="224" r="6"/><circle class="glue" cx="252" cy="225" r="5"/>
     <path class="r-accent" d="M300 96 q 30 -10 40 18 M332 104 l 8 12 l 4 -14"/>
     <text class="hand" x="292" y="86">button??</text>
     <text class="hand hand--sm" x="36" y="292">cardboard + hot glue, 2 hrs</text>
     <text class="hand hand--sm" x="40" y="40">too tall? ↓ 8mm</text>
     <path class="r-ink" d="M36 48 q 20 30 70 70"/>`;

  cleanSvg.innerHTML = `<defs><radialGradient id="wipe-glow" cx="50%" cy="30%" r="55%"><stop offset="0" stop-color="#ff5a1f" stop-opacity=".25"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></radialGradient></defs>
     <rect width="400" height="300" fill="url(#wipe-glow)"/>` + clean(motifs.lumen, { fill: true }) +
    `<path class="dim" d="M106 250 H294 M106 244 V256 M294 244 V256"/><text class="dimtxt" x="176" y="270">Ø 108.0</text>
     <path class="leader" d="M294 151 L330 120 H372"/><text class="dimtxt" x="300" y="112">TURN · TAP</text>`;

  let pct = 50, dragging = false;
  const set = (v) => {
    pct = Math.max(0, Math.min(100, v));
    cleanWrap.style.clipPath = `inset(0 0 0 ${pct}%)`;
    handle.style.left = pct + "%";
    handle.setAttribute("aria-valuenow", Math.round(pct));
  };
  const fromEvent = (e) => { const r = wrap.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
  wrap.addEventListener("pointerdown", (e) => { dragging = true; wrap.setPointerCapture(e.pointerId); fromEvent(e); });
  wrap.addEventListener("pointermove", (e) => { if (dragging) fromEvent(e); });
  wrap.addEventListener("pointerup", () => (dragging = false));
  handle.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") set(pct - 5);
    if (e.key === "ArrowRight") set(pct + 5);
  });
  set(50);
  return { set };
}
