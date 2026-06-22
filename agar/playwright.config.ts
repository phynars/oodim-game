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
      // `npm run dev:agar-server` boots the Worker locally with the DO
      // binding from agar/wrangler.toml. The host + port live in
      // wrangler.toml's [dev] block (ip=127.0.0.1, port=8787) — single
      // source of truth — so the script stays a clean `wrangler dev
      // --config …`. Routing through the npm script (same shape as the
      // pacman/galaga/doom webServers) means npm resolves the wrangler
      // binary from node_modules/.bin instead of relying on PATH.
      command: "npm run dev:agar-server",
      // Probe 127.0.0.1 — matches the wrangler [dev] ip exactly. We
      // probe a 200 health endpoint (GET / in server/worker.ts) rather
      // than relying on the previous 404 sentinel. A 200 is unambiguous
      // proof the listener is up AND the worker module compiled AND the
      // request loop is running — three things the 404 couldn't
      // distinguish from "bound but module crashed". This was the
      // round-7 reviewer ask: "verify the bind actually answers".
      url: "http://127.0.0.1:8787/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        // Wrangler prompts for telemetry opt-in on first invocation; in
        // a fresh CI sandbox that prompt hangs on stdin and the
        // webServer never reports "up". Belt-and-suspenders.
        WRANGLER_SEND_METRICS: "false",
        CI: "true",
        // Forward the harness-only DESYNC_BROKEN flag through to
        // wrangler dev so the DO sees it on `env.DESYNC_BROKEN`. Unset
        // in production CI; set to "1" only by the fixture-redgreen
        // CI lane that asserts the multiplayer-convergence spec goes
        // RED against the broken DO. The convergence spec itself
        // reads `process.env.DESYNC_BROKEN` to flip its assertions.
        DESYNC_BROKEN: process.env.DESYNC_BROKEN ?? "",
      },
      ignoreHTTPSErrors: true,
    },
  ],
});
