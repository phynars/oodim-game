import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// agar gameplay harness — slice 2/4 (DO echo). Two webServers run in
// parallel under the merge gate:
//   1) vite preview at :4274 serving the built /agar/ static bundle, and
//   2) wrangler dev at :8787 hosting the Worker + EchoRoom Durable Object.
// The echo e2e opens one page at /agar/, which connects a WebSocket to
// ws://localhost:8787/ws and asserts the round-trip lands. Playwright
// waits on BOTH urls before running tests; if either fails to come up,
// the suite fails before any spec runs.
//
// webServer.cwd is pinned to the repo root (npm scripts live in the
// root package.json), since Playwright defaults webServer cwd to this
// config's dir.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4274/agar/",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      cwd: repoRoot,
      command:
        "npm run build:agar && npm run preview:agar -- --host localhost --port 4274 --strictPort",
      url: "http://localhost:4274/agar/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      cwd: repoRoot,
      // `wrangler dev` boots the Worker locally with the DO binding from
      // agar/wrangler.toml. --port pins to 8787 (matches the client URL
      // builder in agar/src/main.ts). --local keeps state on-box so CI
      // never hits the real Cloudflare edge.
      command:
        "wrangler dev --config agar/wrangler.toml --port 8787 --local",
      url: "http://localhost:8787/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // The Worker returns 404 for GET / (only /ws is routed), which is
      // a healthy signal — Playwright treats any HTTP response as "up".
      ignoreHTTPSErrors: true,
    },
  ],
});
