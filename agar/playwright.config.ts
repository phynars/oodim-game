import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// agar gameplay harness — slice 4/4 (multi-client merge gate). Two
// webServers run in parallel:
//   1) vite preview at :4274 serving the built /agar/ static bundle, and
//   2) wrangler dev at :8787 hosting the Worker + EchoRoom Durable Object.
//
// FIXTURE SWITCH (#180 requirement)
//
// `AGAR_SERVER_FIXTURE=desync-broken` boots the deliberately-broken DO
// at `agar/server/fixture/desync-broken/worker.ts` instead of the
// production one — same baseURL, same port, same spec. The fixture
// drops every 7th input, so `agar/e2e/two-client.spec.ts`'s
// `expectConverge`/`expectOrderingInvariant` go RED against it and
// GREEN against `main`. This is the receipt that the rung is
// falsifiable.
//
// We choose between two npm scripts (`dev:agar-server` and
// `dev:agar-server-fixture`) rather than threading flags into a single
// script — wrangler dev's `--main` override is the cleanest way to swap
// the worker entry without forking wrangler.toml. The npm script keeps
// the command shape identical to the other webServers in this repo.
//
// webServer.cwd is pinned to the repo root (npm scripts live in the
// root package.json).
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const fixture = process.env.AGAR_SERVER_FIXTURE ?? "";
const useFixture = fixture === "desync-broken";
if (fixture !== "" && !useFixture) {
  // Fail fast on a typo'd fixture name — silently falling back to
  // production would hide a broken merge gate.
  throw new Error(
    `agar/playwright.config.ts: unknown AGAR_SERVER_FIXTURE=${JSON.stringify(
      fixture,
    )}. Known values: "" (production), "desync-broken".`,
  );
}
const serverScript = useFixture
  ? "npm run dev:agar-server-fixture"
  : "npm run dev:agar-server";

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
      // `npm run dev:agar-server` boots the production Worker;
      // `npm run dev:agar-server-fixture` boots the desync-broken
      // fixture worker (same wrangler.toml, different --main). Host +
      // port live in wrangler.toml's [dev] block (ip=127.0.0.1,
      // port=8787) — single source of truth — so the script stays
      // shape-identical to the pacman/galaga/doom webServers.
      command: serverScript,
      // Probe 127.0.0.1 — matches the wrangler [dev] ip exactly. The
      // 200 health endpoint (GET / in both worker.ts files) is
      // unambiguous proof the listener is up AND the worker module
      // compiled AND the request loop is running.
      url: "http://127.0.0.1:8787/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        // Wrangler prompts for telemetry opt-in on first invocation; in
        // a fresh CI sandbox that prompt hangs on stdin and the
        // webServer never reports "up". Belt-and-suspenders.
        WRANGLER_SEND_METRICS: "false",
        CI: "true",
      },
      ignoreHTTPSErrors: true,
    },
  ],
});
