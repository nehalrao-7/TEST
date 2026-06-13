// Generates clearly-marked black & white placeholder images for program cards.
// These are stand-ins for real photography — swap the files in /public/images
// with real B&W photos (same filenames) and nothing else needs to change.
// Run with: node scripts/generate-placeholders.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "images");

const cards = [
  { file: "program-g6bl.svg", label: "G6BL", sub: "The League" },
  { file: "program-junior.svg", label: "Junior Ball", sub: "Fundamentals" },
  { file: "program-academy.svg", label: "Training Academy", sub: "Advanced" },
  { file: "program-lions.svg", label: "Lions Rep", sub: "Competitive" },
  { file: "program-camps.svg", label: "Camps & Clinics", sub: "Seasonal" },
  { file: "program-girls.svg", label: "Girls Program", sub: "Built For Her" },
];

function svg({ label, sub }, i) {
  const cx = 200 + ((i * 137) % 400);
  const cy = 150 + ((i * 91) % 260);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="${label} placeholder">
  <rect width="800" height="600" fill="#0a0a0a"/>
  <g stroke="#ffffff" stroke-opacity="0.10" stroke-width="2" fill="none">
    <rect x="20" y="20" width="760" height="560"/>
    <line x1="400" y1="20" x2="400" y2="580"/>
    <circle cx="400" cy="300" r="90"/>
    <path d="M20 180 H170 V420 H20"/>
    <path d="M780 180 H630 V420 H780"/>
  </g>
  <circle cx="${cx}" cy="${cy}" r="70" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="3"/>
  <path d="M${cx - 70} ${cy} H${cx + 70} M${cx} ${cy - 70} V${cy + 70}" stroke="#ffffff" stroke-opacity="0.16" stroke-width="3"/>
  <text x="400" y="300" text-anchor="middle" font-family="Impact, Haettenschweiler, sans-serif" font-size="78" letter-spacing="2" fill="#f5f5f3" fill-opacity="0.92">${label.toUpperCase()}</text>
  <text x="400" y="345" text-anchor="middle" font-family="Arial Narrow, sans-serif" font-size="22" letter-spacing="6" fill="#9a9a9a">${sub.toUpperCase()}</text>
  <text x="400" y="560" text-anchor="middle" font-family="Arial Narrow, sans-serif" font-size="13" letter-spacing="4" fill="#ffffff" fill-opacity="0.18">PHOTO PLACEHOLDER — SWAP IN REAL IMAGERY</text>
</svg>
`;
}

for (let i = 0; i < cards.length; i++) {
  writeFileSync(join(outDir, cards[i].file), svg(cards[i], i));
  console.log("wrote", cards[i].file);
}
