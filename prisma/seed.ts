import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// NOTE: ages/cadence here are intentionally soft guidance, not hard brackets —
// Game6 places kids by skill at the in-person evaluation, not by a fixed
// age-and-time grid. These values are editable per season (admin, later pass).
const programs = [
  {
    slug: "g6bl",
    name: "G6BL — Game6 Basketball League",
    blurb: "Our house league. Boys & girls, elementary and high school.",
    details:
      "The Game6 Basketball League is where it all happens. Boys and girls house league across elementary and high school divisions — one game every Saturday plus one weeknight practice. This is the league: structured, competitive, and built to develop every player who walks through the door.",
    weeklyCadence: "1 Saturday game + 1 weeknight practice",
    ageHint: "Elementary through high school",
    imagePath: "/images/program-g6bl.svg",
    sortOrder: 1,
  },
  {
    slug: "junior-ball",
    name: "Junior Ball",
    blurb: "Beginners. Fundamentals first — handling, shooting, passing.",
    details:
      "Junior Ball is where new players fall in love with the game. We build the fundamentals — ball handling, shooting, passing, footwork — in a fun, high-energy environment. Run 1x or 2x weekly depending on the season.",
    weeklyCadence: "1x or 2x weekly",
    ageHint: "Beginners, younger players",
    imagePath: "/images/program-junior.svg",
    sortOrder: 2,
  },
  {
    slug: "training-academy",
    name: "Training Academy",
    blurb: "Advanced players. Small group, high-level coaching.",
    details:
      "The Training Academy is for advanced players who want to take their game to the next level. Small-group, high-level coaching focused on skill refinement, basketball IQ, and athletic development.",
    weeklyCadence: "Small group sessions",
    ageHint: "Advanced players",
    imagePath: "/images/program-academy.svg",
    sortOrder: 3,
  },
  {
    slug: "lions-rep",
    name: "Lions Rep Program",
    blurb: "Selective competitive rep team. Exposure in Ontario leagues.",
    details:
      "The Lions are our selective competitive rep program — for players ready to compete at the highest level with exposure across Ontario leagues. Tryout-based. This is where serious players go to be seen.",
    weeklyCadence: "Competitive season schedule",
    ageHint: "Selective / tryout-based",
    imagePath: "/images/program-lions.svg",
    sortOrder: 4,
  },
  {
    slug: "camps-clinics",
    name: "Camps & Clinics",
    blurb: "Summer, winter break & March break. With Nike Sports Camp Canada.",
    details:
      "Three times a year — summer, winter break, and March break — we run camps and clinics in partnership with Nike Sports Camp Canada. Full-day and half-day options. High energy, high reps, unforgettable.",
    weeklyCadence: "Seasonal — 3x per year",
    ageHint: "All levels",
    imagePath: "/images/program-camps.svg",
    sortOrder: 5,
  },
  {
    slug: "girls-program",
    name: "Girls Program",
    blurb: "A positive, supportive environment built for girls.",
    details:
      "Our Girls Program creates a positive, supportive environment for girls to grow as players and as people. Skill development, confidence, and community — on and off the court.",
    weeklyCadence: "Seasonal schedule",
    ageHint: "Girls, all levels",
    imagePath: "/images/program-girls.svg",
    sortOrder: 6,
  },
];

const offers = [
  {
    label: "Free League Drop-In — Ages 14 to 16",
    ageRangeLabel: "Ages 14–16",
    mappedClassNote: "Maps to Tue/Thu HS practice (existing class)",
    sortOrder: 1,
  },
  {
    label: "Free Evaluation Class — Ages 9 to 11",
    ageRangeLabel: "Ages 9–11",
    mappedClassNote: "Maps to Wed elementary practice (existing class)",
    sortOrder: 2,
  },
];

async function main() {
  // Active season — edit label / year / registrationStatus here until the
  // admin UI lands. Only one season should have isActive = true.
  await prisma.season.deleteMany();
  await prisma.season.create({
    data: {
      label: "Spring",
      year: 2026,
      registrationStatus: "OPEN",
      headline: null,
      isActive: true,
    },
  });

  const programRecords: Record<string, string> = {};
  for (const p of programs) {
    const rec = await prisma.program.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    });
    programRecords[p.slug] = rec.id;
  }

  // Base inventory layer: courts, and the recurring classes that consume them.
  await prisma.booking.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.classSession.deleteMany();
  await prisma.court.deleteMany();

  const court1 = await prisma.court.create({ data: { name: "Court 1", sortOrder: 1 } });
  const court2 = await prisma.court.create({ data: { name: "Court 2", sortOrder: 2 } });

  // A few sample recurring classes (weekday: 0=Sun..6=Sat).
  const hsTue = await prisma.classSession.create({
    data: {
      name: "High School Practice",
      weekday: 2,
      startTime: "18:00",
      endTime: "20:00",
      capacity: 24,
      ageHint: "High school",
      programId: programRecords["g6bl"],
      courtId: court1.id,
    },
  });
  await prisma.classSession.create({
    data: {
      name: "High School Practice",
      weekday: 4,
      startTime: "18:00",
      endTime: "20:00",
      capacity: 24,
      ageHint: "High school",
      programId: programRecords["g6bl"],
      courtId: court1.id,
    },
  });
  const elemWed = await prisma.classSession.create({
    data: {
      name: "Elementary Practice",
      weekday: 3,
      startTime: "17:00",
      endTime: "18:30",
      capacity: 20,
      ageHint: "Elementary",
      programId: programRecords["junior-ball"],
      courtId: court2.id,
    },
  });

  // Offers map onto existing classes (the facade mechanic).
  await prisma.offer.create({
    data: {
      label: "Free League Drop-In — Ages 14 to 16",
      ageRangeLabel: "Ages 14–16",
      mappedClassNote: "Tue/Thu HS practice",
      classSessionId: hsTue.id,
      sortOrder: 1,
    },
  });
  await prisma.offer.create({
    data: {
      label: "Free Evaluation Class — Ages 9 to 11",
      ageRangeLabel: "Ages 9–11",
      mappedClassNote: "Wed elementary practice",
      classSessionId: elemWed.id,
      sortOrder: 2,
    },
  });

  // A sample owner-logged court rental (internal only).
  await prisma.booking.create({
    data: {
      title: "Adult Rental — Riconosciuto group",
      type: "RENTAL",
      date: new Date(),
      startTime: "21:00",
      endTime: "22:30",
      contact: "416-555-0148",
      courtId: court2.id,
    },
  });

  console.log("Seeded: season, %d programs, 2 courts, 3 classes, 2 offers, 1 booking.", programs.length);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
