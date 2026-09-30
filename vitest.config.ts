import { defineConfig } from "vitest/config";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { testDatabaseUrl } from "./src/test/db-url";

const dbUrl = testDatabaseUrl();

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      ...(dbUrl ? { DATABASE_URL: dbUrl } : {}),
      // Файлы КП в тестах — во временной папке.
      UPLOAD_DIR: mkdtempSync(path.join(tmpdir(), "tender-test-")),
      TZ: "Europe/Moscow",
    },
  },
});
