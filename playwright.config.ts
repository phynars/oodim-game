import { defineConfig, devices } from "@playwright/test";

// The gameplay harness runs against a live Vite build. CI builds first, then
// `vite preview` serves it under the /pacman/ base; Playwright drives that.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173/pacman/",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173/pacman/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
