import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// BASE_URL=https://… runs the suite against a deployment instead of a local build.
const remote = process.env.BASE_URL;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  // A cold deployment has to fetch the 13 MB WebAssembly runtime; give it room.
  timeout: remote ? 60_000 : 30_000,
  reporter: "list",
  use: { baseURL: remote ?? `http://localhost:${PORT}` },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Tests run against the production build, not next dev.
  webServer: remote
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
