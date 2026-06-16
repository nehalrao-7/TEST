import { PrismaClient } from "@prisma/client";
import { seed } from "./seed-core";

// Deploy-safe seed: only seeds when the database is empty, so redeploys never
// wipe content Game6 has edited in the admin. Used by the Vercel build command.
const prisma = new PrismaClient();

async function run() {
  const existing = await prisma.season.count();
  if (existing > 0 && process.env.FORCE_SEED !== "1") {
    console.log("ensure-seed: database already initialized, skipping.");
    return;
  }
  const r = await seed(prisma);
  console.log("ensure-seed: seeded database (%d programs).", r.programs);
}

run()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("ensure-seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
