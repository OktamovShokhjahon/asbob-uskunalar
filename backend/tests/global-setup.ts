import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { TEST_ENV } from "../vitest.config";

/**
 * Starts every run from an empty test database (prisma/test.db only — dev.db is
 * never touched) and an empty public/test-uploads folder, applies the schema and
 * seeds the superadmin + 6 tools.
 */
export default function setup() {
  const env = { ...process.env, ...TEST_ENV };
  for (const f of ["test.db", "test.db-journal"]) {
    rmSync(path.join(__dirname, "..", "prisma", f), { force: true });
  }
  rmSync(path.join(__dirname, "..", TEST_ENV.UPLOAD_DIR), { recursive: true, force: true });
  execSync("npx prisma db push --skip-generate", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
}
