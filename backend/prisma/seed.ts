import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seed } from "../src/data/seed";

const prisma = new PrismaClient();

seed(prisma)
  .then(({ adminCreated, usedDevPassword, listings }) => {
    console.log(`Seeded. Superadmin ${adminCreated ? "created" : "kept"}; listings in DB: ${listings}`);
    if (usedDevPassword) console.log("Superadmin uses the dev demo password. Set SUPERADMIN_PASSWORD to change it.");
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
