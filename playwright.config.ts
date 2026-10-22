import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import process from "node:process";

loadEnvConfig(process.cwd());
const testPort = process.env.E2E_PORT;
const testBaseUrl = process.env.E2E_BASE_URL ||
  (testPort ? `http://localhost:${testPort}` : process.env.NEXTAUTH_URL) ||
  "http://localhost:3000";
const resolvedTestPort = new URL(testBaseUrl).port || "3000";
const testDistDir = `.next-e2e-${resolvedTestPort}`;
process.env.NEXTAUTH_URL = testBaseUrl;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: testBaseUrl,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npm run dev -- --hostname localhost --port ${resolvedTestPort}`,
    url: testBaseUrl,
    env: { NEXT_DIST_DIR: testDistDir, NEXTAUTH_URL: testBaseUrl },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});