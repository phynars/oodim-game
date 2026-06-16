import { defineConfig, devices } from "@playwright/test";

// The gameplay harness lives in e2e/. CI runs `vite build` then `vite preview`
// via the webServer hook so the assertions exercise the real built bundle.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173/pacman/",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --host localhost --port 4173 --strictPort",
    url: "http://localhost:4173/pacman/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
