import { PrismaClient } from "@prisma/client";
import { seed } from "./seed-core";

// CLI seed (always re-seeds): `npm run db:seed`.
const prisma = new PrismaClient();

seed(prisma)
  .then(async (r) => {
    console.log("Seeded: season, %d programs, 2 courts, 3 classes, 2 offers, 1 booking.", r.programs);
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
