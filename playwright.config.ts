import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

// Smoke tests run against `next dev` in fixture mode (COC_API_MOCK=1), so they
// need no API token and never hit the real API.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // `next dev` compiles each route on first visit, which can take a while.
  workers: process.env.CI ? 2 : 3,
  timeout: 90_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { COC_API_MOCK: "1" },
  },
});
