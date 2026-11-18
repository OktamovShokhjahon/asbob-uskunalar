import { defineConfig } from "vitest/config";

export const TEST_ENV = {
  NODE_ENV: "test",
  DATABASE_URL: "file:./test.db", // prisma/test.db, separate from dev.db
  CORS_ORIGIN: "http://localhost:3000",
  SUPERADMIN_PASSWORD: "test-admin-pass",
  DEMO_RESET_ENABLED: "true",
  UPLOAD_DIR: "public/test-uploads", // backend/public/test-uploads, emptied before each run
};

export default defineConfig({
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    env: TEST_ENV,
    // All test files share one SQLite file.
    fileParallelism: false,
  },
});
