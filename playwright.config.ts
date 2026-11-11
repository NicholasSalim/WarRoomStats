import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

// Smoke tests run against a production build in fixture mode (COC_API_MOCK=1),
// so they need no API token, never hit the real API, and test what visitors
// get. (`next dev` sometimes stalled on in-app navigations under parallel
// tests, for over 90 s on CI; the live site takes about 1 s.)
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
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
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { COC_API_MOCK: "1" },
  },
});
