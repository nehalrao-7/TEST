// =========================================================
// The places in Nehal's world — content lives here.
// PLACEHOLDER NOTE: project specifics (Lumen, Line 4, Wayfinder),
// the BOLO role and the email are illustrative. See README.
// =========================================================

export const LENSES = {
  design:      { label: "Industrial design", route: ["origin", "observatory", "workshop", "hack", "lighthouse"] },
  engineering: { label: "Engineering",       route: ["origin", "arena", "workshop", "line", "lighthouse"] },
  creative:    { label: "Creative tech",     route: ["origin", "studio", "hack", "observatory", "lighthouse"] },
  product:     { label: "Product & innovation", route: ["origin", "observatory", "hack", "workshop", "line", "lighthouse"] },
};

export const PLACES = [
  {
    key: "origin", name: "The Dot", kicker: "Start here — who",
    pos: [0, 0, 0], r: 3.6,
    tagline: "Every world starts with a single point.",
    lead: "Hi, I'm Nehal. Mechanical engineer by training, industrial designer by trade, creative technologist by obsession. I've designed robots, consumer products, production fixtures — and this.",
    sections: [
      { h: "What you're looking at", p: "Everything floating around you was designed, modelled, written and shipped by me: every island, every object, every line of code. Nothing here was bought, templated or downloaded." },
      { h: "How I work now", p: "I work at the speed of a small studio, because I build systems that handle the heavy lifting. My time goes where it matters most: judgement, taste and finish." },
    ],
    modules: ["timeline"],
    facts: ["Toronto, CA", "B.Eng — Ryerson University", "Open to roles", "Willing to relocate"],
    links: ["observatory", "workshop", "studio", "lighthouse"],
  },
  {
    key: "workshop", name: "The Workshop", kicker: "Industrial design — Elevety",
    pos: [17.5, 1, 0], r: 3.3,
    tagline: "Beautiful and buildable are the same problem.",
    lead: "Here, sketches become objects. I take products from the first napkin line to production drawings — and I stay on the phone with the supplier until it's right.",
    sections: [
      { h: "The object", p: "Lumen is a lamp-speaker concept, drawn the way I'd present it to a factory. Scrub through it: loose sketch, honest dimensions, a full teardown, then the finished thing. The design story is in the annotations." },
      { h: "The habit", p: "I design the disassembly as carefully as the product. Fewer parts, fewer screws, fewer ways to fail — and a cheaper bill of materials, which is the part everyone remembers." },
    ],
    modules: ["lumen"],
    facts: ["SolidWorks", "CATIA V5", "CNC", "Body engineering", "DFM / DFA", "GD&T"],
    links: ["line", "arena", "observatory"],
  },
  {
    key: "line", name: "The Line", kicker: "Production engineering — Weston Foods",
    pos: [11, -1.5, 13.5], r: 3.4,
    tagline: "Nothing humbles a design like a production line.",
    lead: "Ten thousand units an hour teaches you what 'uptime' really means — and that most lost time isn't work. It's searching.",
    sections: [
      { h: "Line 4", p: "Changeovers were eating a full shift every week. I stood on the floor with a stopwatch for two weeks, then designed quick-release fixtures and a colour-coded tooling cart, so nothing ever had to be found again." },
      { h: "Try it", p: "Every fit is a decision. Find the clearance where the part slides in but doesn't rattle. That's the feeling I chase in everything I ship." },
    ],
    modules: ["tolerance"],
    facts: ["Time studies", "Fixture design", "Lean / SMED", "Root-cause analysis"],
    links: ["workshop", "arena"],
  },
  {
    key: "arena", name: "The Arena", kicker: "Robotics — VEX & Solus Robots",
    pos: [-3, 0.5, 17.5], r: 3.1,
    tagline: "A design isn't done until it survives contact with an opponent.",
    lead: "Where it started. Team 356 was part of the winning alliance at the 2014 Ontario Provincial VEX Robotics Championship. We rebuilt drivetrains between matches.",
    sections: [
      { h: "Then, for real", p: "At Solus Robots I designed mechanisms and enclosures for robots that left the lab and went to work. It was the first time my CAD had a customer — and the customer had opinions." },
      { h: "Gear it", p: "Every robot is a trade between speed and strength. Pick a ratio and see what it's good for." },
    ],
    modules: ["gears"],
    facts: ["Mechanism design", "Drivetrains", "Rapid iteration", "Ontario champions '14"],
    links: ["workshop", "hack"],
  },
  {
    key: "hack", name: "The Hack Lab", kicker: "Startups & hackathons — iBoost, HackPrinceton",
    pos: [-15, 2, 9], r: 3.0,
    tagline: "Constraints aren't walls. They're rocket fuel.",
    lead: "At Ryerson's iBoost accelerator, I turned pitch decks into prototypes in days, not quarters. At HackPrinceton, my team took Best Overall Hack.",
    sections: [
      { h: "Wayfinder — 36 hours", p: "A wristband that guides you with taps instead of a screen. Hour 1: paper taped to a wrist. Hour 6: motors on a breadboard. Hour 30: a 3D-printed band talking to a phone. We tested on strangers in the hallway every few hours." },
      { h: "Prototype ugly. Finish beautiful.", p: "The first version should be fast and a little embarrassing. The last one should feel quiet and inevitable. Drag between them." },
    ],
    modules: ["frames", "wipe"],
    facts: ["Best Overall Hack", "Hardware + software", "Founder speed", "User testing"],
    links: ["studio", "arena", "observatory"],
  },
  {
    key: "studio", name: "The Studio", kicker: "Creative technology — this world",
    pos: [-16.5, -0.5, -7.5], r: 3.2,
    tagline: "I don't just make things. I make the machines that make things.",
    lead: "This world is generative. Every island grows from a seed, and every landmark is assembled from primitives in code. Go on, regrow it.",
    sections: [
      { h: "Why build it this way", p: "It's how I work everywhere now. I design the system once, then it produces a hundred options in the time it used to take to draw one. The taste is still mine; the system just gives it more to choose from." },
      { h: "Under the hood", p: "Three.js and hand-written GLSL, with procedural geometry, seeded randomness and no imported assets. One person, one codebase. Every place you've visited was made this way." },
    ],
    modules: ["engine"],
    facts: ["Three.js", "GLSL", "Procedural systems", "HTML / CSS", "Figma", "Automation"],
    links: ["hack", "observatory"],
  },
  {
    key: "observatory", name: "The Observatory", kicker: "How I think",
    pos: [-5, 3, -16.5], r: 2.9,
    tagline: "See the shape before it exists.",
    lead: "Every project starts as scattered dots: a customer complaint, a supplier constraint, a weird idea at 2 a.m. My job is to see the line through them before anyone else can.",
    sections: [
      { h: "Four moves, every time", p: "Start with a feeling, not a feature. Then make it honest — every line gets a number. Take it apart before the world does. Then make it real: the finish is where trust is earned." },
      { h: "Bilingual", p: "I translate between engineering, design and business, so nothing gets lost between the whiteboard and the warehouse." },
    ],
    modules: ["dots"],
    facts: ["Systems thinking", "Design reviews", "Stakeholder translation", "Storytelling"],
    links: ["workshop", "studio", "hack"],
  },
  {
    key: "lighthouse", name: "The Lighthouse", kicker: "Now & next — BOLO, Toronto",
    pos: [9.5, 0, -14.5], r: 2.7,
    tagline: "You're the next dot.",
    // PLACEHOLDER: replace with the real BOLO role
    lead: "Right now I'm at BOLO in Toronto, where every dot before this one is paying compound interest. Next, I'm looking for a team that builds real things — on shelves or on screens.",
    sections: [
      { h: "What I'm after", p: "Hard problems that need someone who can sketch it, engineer it, prototype it and tell its story — then make the team around them faster." },
    ],
    modules: ["contact"],
    facts: ["Open to roles", "Willing to relocate", "Toronto — EST"],
    links: ["origin", "workshop", "studio"],
  },
];

export const BYKEY = Object.fromEntries(PLACES.map((p) => [p.key, p]));

// Career dots (the timeline at The Dot)
export const DOTS = [
  { y: "2014", place: "arena", t: "VEX Robotics, Team 356", l: "A design isn't done until it survives contact with an opponent." },
  { y: "2015", place: "arena", t: "Solus Robots — mechanical design", l: "Tolerances are a love language." },
  { y: "2016", place: "hack", t: "iBoost, Ryerson — design", l: "Momentum is a feature." },
  { y: "2016→", place: "workshop", t: "Elevety — industrial design", l: "Beautiful and buildable are the same problem." },
  { y: "2017", place: "line", t: "Weston Foods — production", l: "Nothing humbles a design like a production line." },
  { y: "36h", place: "hack", t: "HackPrinceton — Best Overall", l: "Constraints are rocket fuel." },
  { y: "Now", place: "lighthouse", t: "BOLO — Toronto", l: "The next dot is wherever you are." },
];

// Hidden field notes, floating between islands
export const NOTES = [
  "Ask 'why' five times. The fourth answer is usually the real brief.",
  "If the prototype isn't a little embarrassing, I waited too long.",
  "Count the screws. Then ask which ones can go.",
  "Good tools make you faster. Great systems make you braver.",
  "Watch people use it before you ask what they think.",
  "Taste is the one thing you can't automate. So I automate everything else.",
];

// Knowledge for "Ask the world"
export const KNOWLEDGE = [
  { k: "cad solidworks catia 3d model modelling modeling surfacing drawings", a: "SolidWorks and CATIA V5 are home turf — from concept surfacing to production drawings.", place: "workshop" },
  { k: "industrial design product designer form sketch sketching aesthetic", a: "Product design from sketch to shelf at Elevety. The Workshop has a full teardown you can scrub through.", place: "workshop" },
  { k: "manufacturing dfm dfa production factory assembly parts cost bom", a: "Design for manufacture is a habit: fewer parts, fewer screws, a cheaper BOM. Seen in the Workshop and on the Line.", place: "workshop" },
  { k: "lean process improvement efficiency operations uptime changeover smed weston", a: "Production engineering at Weston Foods: time studies, quick-release fixtures, changeover reduction.", place: "line" },
  { k: "tolerance gdt gd&t precision fit clearance", a: "Tolerances are a love language. There's a fit-and-clearance toy on the Line.", place: "line" },
  { k: "robot robotics vex mechanism mechanisms drivetrain solus", a: "Robotics since 2014: VEX Ontario provincial champions (alliance), then mechanical design at Solus Robots.", place: "arena" },
  { k: "code coding developer program programming javascript web frontend three webgl glsl css html technical", a: "Yes — this world is the code sample. Three.js, GLSL and hand-written HTML/CSS. The Studio shows the engine.", place: "studio" },
  { k: "ai automation tools workflow systems generative procedural fast speed productivity leverage scale", a: "I build systems that do the heavy lifting, so one person can work at the speed of a small studio. Regrow this world in the Studio to see one.", place: "studio" },
  { k: "hackathon startup startups founder accelerator iboost princeton prototype prototyping wayfinder", a: "Best Overall Hack at HackPrinceton, and prototypes-in-days at the iBoost accelerator. That's the Hack Lab.", place: "hack" },
  { k: "think thinking process approach philosophy method principles how vision", a: "Four moves: feeling before features, make it honest, take it apart, make it real. The Observatory has the rest.", place: "observatory" },
  { k: "team leadership lead collaborate collaboration communication stakeholders cross functional", a: "I'm bilingual in engineering, design and business, so I translate between them and make teams faster.", place: "observatory" },
  { k: "contact email hire hiring reach resume cv interview call talk", a: "The Lighthouse has everything: email, LinkedIn and the résumé. One click.", place: "lighthouse" },
  { k: "available availability open looking job role roles start notice", a: "Open to new roles now, and happy to talk anytime.", place: "lighthouse" },
  { k: "relocate relocation remote location where based toronto canada move", a: "Based in Toronto and willing to relocate for the right team.", place: "origin" },
  { k: "education degree school university ryerson engineering bachelor", a: "B.Eng from Ryerson University (now Toronto Metropolitan University).", place: "origin" },
  { k: "current now bolo today present", a: "Currently at BOLO in Toronto. The Lighthouse has the latest.", place: "lighthouse" },
  { k: "award awards win wins won achievement champion championship trophy", a: "Ontario provincial VEX champions (alliance, 2014) and Best Overall Hack at HackPrinceton.", place: "arena" },
  { k: "who about nehal background story experience career history timeline", a: "Robots, then products, then production lines, then this. The Dot has the whole timeline.", place: "origin" },
];

export function ask(query) {
  const q = query.toLowerCase().replace(/[^a-z0-9&\s]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  if (!q.length) return [];
  const results = [];
  for (const item of KNOWLEDGE) {
    const words = item.k.split(" ");
    let score = 0;
    for (const t of q) {
      for (const w of words) {
        if (w === t) score += 3;
        else if (t.length >= 3 && (w.startsWith(t) || t.startsWith(w)) && w.length >= 3) score += 1.5;
      }
    }
    if (score > 0) results.push({ ...item, score });
  }
  // direct place-name hits
  for (const p of PLACES) {
    const n = p.name.toLowerCase().replace("the ", "");
    if (q.some((t) => n.includes(t) && t.length > 2)) results.push({ a: p.tagline, place: p.key, score: 2.5 });
  }
  results.sort((a, b) => b.score - a.score);
  const seen = new Set();
  return results.filter((r) => (seen.has(r.a) ? false : seen.add(r.a))).slice(0, 3);
}
