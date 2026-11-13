import { defineConfig, devices } from "@playwright/test";
import dns from "node:dns";
import { fileURLToPath } from "node:url";

// AFTERSIGN gameplay/story harness. Builds the aftersign/ product and plays
// it at /aftersign/ on the REAL Worker run locally (WORKER MODE below),
// forces SwiftShader WebGL so the three.js scene initializes headless. The
// spec suite asserts on the window.__game story/state contract (not pixels).
//
// WORKER MODE (2026-11-12, the default): the webServer is
// scripts/ci/worker-dev.sh, which builds, stages public/ the way the deploy
// does and runs src/server.ts with its Durable Objects under `wrangler dev`.
// Until then this lane played against `vite preview`, whose save endpoint is
// a second implementation, which has no /player-memory, and where the client
// gives every browser one shared player id (the host was `localhost`). A PR
// could pass every spec here and fail on game.oodim.com (#2739, #2748).
// The host is `game.localhost`: loopback, a secure context in Chromium, and
// NOT in the client's local-host list (aftersign/src/playerIdentity.ts), so
// each browser context gets its own player id, as a visitor does.
//
// Why this file exists (2026-07-05): without a playwright config, the
// harness spec under aftersign/e2e/ has no runner — and a spec that never
// runs gates nothing. The whole PREMISE of the harness ("no story beat
// exists unless a harness assertion says so") requires the spec to actually
// execute in CI. See PR #427 review.
//
// webServer.cwd is pinned to the repo root (npm scripts live in the root
// package.json), since Playwright defaults webServer cwd to this config's dir.
//
// SERVED MODE (2026-10-03, #2116): when AFTERSIGN_BASE_URL is set the
// config points `use.baseURL` at the deployed URL and omits the webServer
// block entirely. The deploy workflow runs this config with
// AFTERSIGN_BASE_URL=https://game.oodim.com/aftersign/ so the spec drives
// the just-published build. Omitting webServer in served mode is
// deliberate: a deployment verification must NOT be able to silently fall
// back to a local server if the production URL is unreachable.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const servedBaseURL = process.env.AFTERSIGN_BASE_URL;
const WORKER_PORT = 4374;
const WORKER_HOST = "game.localhost";

// Chromium maps *.localhost to loopback by itself. Node asks the OS, which
// does not on every machine (Windows; a Linux box without nss-myhostname),
// so the `request` fixture would fail to connect. This file is loaded by the
// runner and by every worker process, so the mapping below reaches each of
// them. Only names under .localhost are touched.
const isLocalName = (host: unknown): boolean => typeof host === "string" && /(^|\.)localhost$/i.test(host);
const systemLookup = dns.lookup;
const systemLookupPromise = dns.promises.lookup;
if (!(dns.lookup as { aftersignLocal?: boolean }).aftersignLocal) {
  const lookup = function (this: unknown, host: string, options: unknown, callback?: unknown) {
    if (!isLocalName(host)) return (systemLookup as (...a: unknown[]) => unknown).call(this, host, options, callback);
    const done = (typeof options === "function" ? options : callback) as (...a: unknown[]) => void;
    const all = typeof options === "object" && options !== null && (options as { all?: boolean }).all;
    if (all) process.nextTick(done, null, [{ address: "127.0.0.1", family: 4 }]);
    else process.nextTick(done, null, "127.0.0.1", 4);
    return {};
  };
  (lookup as { aftersignLocal?: boolean }).aftersignLocal = true;
  dns.lookup = lookup as typeof dns.lookup;
  dns.promises.lookup = ((host: string, options?: unknown) => {
    if (!isLocalName(host)) return (systemLookupPromise as (...a: unknown[]) => unknown)(host, options);
    const one = { address: "127.0.0.1", family: 4 };
    const all = typeof options === "object" && options !== null && (options as { all?: boolean }).all;
    return Promise.resolve(all ? [one] : one);
  }) as typeof dns.promises.lookup;
}

export default defineConfig({
  testDir: "e2e",
  // Exclude pure-logic specs that already run in the deterministic pure
  // lane (`aftersign/playwright.pure.config.ts`, `test:aftersign:pure`).
  // These specs do NOT use the `{ page }` fixture — each file's header
  // comment states it explicitly — so they don't need the vite-preview
  // webServer or the SwiftShader-backed chromium project. Running them
  // ONLY on the pure lane (retries: 0, no browser) means:
  //   1. They don't inflate this lane's cold-start surface with N extra
  //      files the SwiftShader boot has to shepherd through.
  //   2. A pure-logic regression fails on the pure lane, first attempt,
  //      instead of being masked by this lane's `retries: 3`.
  // This is the escape hatch this file's `retries` comment names
  // ("teasing the pure-logic controller checks … out of the Playwright
  // lane so they stop paying the vite-preview + SwiftShader boot tax
  // at all"). Keep this list in lockstep with the pure config's
  // `testMatch` — a spec that runs on BOTH lanes wastes cold-start
  // budget on this one; a spec that runs on NEITHER lane gates nothing.
  testIgnore: [
    "packet-intent-contract.spec.ts",
    "packet-intent-vertical-slice-contract.spec.ts",
    "io-recognition-cue-contract.spec.ts",
    "recognition-beat-contract.spec.ts",
    "npc-memory-dialogue-contract.spec.ts",
    // #978: bundle migrated to the plain-Node pure-runner; without this
    // entry the spec would pay this lane's SwiftShader boot tax AND
    // double-run the bundle (pure-runner + here).
    "first-camera-move-feel-contract.spec.ts",
    "io-return-memory-beat-contract.spec.ts",
    "io-returning-recognition-line-contract.spec.ts",
    "memory-prompt-timing-feel-contract.spec.ts",
    "kiosk-scene-contract.spec.ts",
    "orra-recognition-memory-contract.spec.ts",
    "hard-navigation-save-survival-contract.spec.ts",
    "flagship-runnable-slice-spine-contract.spec.ts",
  ],
  fullyParallel: true,
  // The PR lane ran 261 tests on Playwright's default of 2 workers (half of
  // the runner's 4 cores) in 25.3 min (2026-11-09, PR #2736). A 3-worker
  // trial followed, and scheduled CI on main then went red in the aftersign
  // job (#2757). This pins the CI lane back to the measured 2-worker
  // baseline. 1 worker would project to ~50 min against the job's 60-min
  // timeout (ci.yml), so it is not used without a measured run. Served mode
  // (the deploy's replay against the live site) keeps the default.
  workers: process.env.CI && !servedBaseURL ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  // AFTERSIGN gets two MORE retries than sibling three.js lanes (pacman /
  // galaga / doom / agar all use retries: 1). Rationale: the aftersign
  // spec is a heavier cold-start than the other WebGL games — it boots
  // three.js AND the audio-cue pipeline AND waits on window.__game story
  // marks (recognitionTriggeredAt / lineSettledAt / audioCueAt), all
  // gated behind SwiftShader's software renderer. Reviewers on #706
  // (following #453 / #468 / #590) all noted the same cold-start flake
  // shape.
  //
  // 2026-07-19 (#714 iteration 6): bumped 2 → 3. The prior +COLD_START_MS
  // spec-level timeout bump (90s per spec + 60s waitForFunction) did not
  // stabilize the aftersign lane — CI stayed red on the same flake shape
  // #700/#506/#590 documented. The escape hatch named explicitly in
  // `packet-intent-contract.spec.ts` line 40 ("escalate to a wider
  // retry-count bump on aftersign/playwright.config.ts instead of another
  // author push") is this bump. A real assertion bug still fails 4× in a
  // row and stays red; a SwiftShader boot hiccup gets the extra attempt.
  //
  // If a future iteration finds this lane still flaking at retries:3,
  // the correct next move is NOT retries:4 — it's teasing the pure-logic
  // controller checks (packet-intent-contract.spec.ts, which runs
  // `runPacketIntentChecks()` with no page fixture) out of the Playwright
  // lane into a plain Node/Vitest runner so they stop paying the
  // vite-preview + SwiftShader boot tax at all.
  retries: process.env.CI ? 3 : 0,
  // Two reporters, on purpose:
  //   - "list"  → stdout in the CI step log (what humans read on the run
  //               page while the job is streaming).
  //   - "json"  → playwright-report/results.json, parsed by the
  //               "Print aftersign failure summary" step in ci.yml to
  //               extract the FIRST failing spec's title + top error
  //               line and relay it into $GITHUB_ENV, which the next
  //               step posts as a PR comment. Agent /code sessions can
  //               read PR comments but CAN'T read step logs or artifacts
  //               (Actions:Read scope missing on the agent token — see
  //               #1036), so this JSON file is the ONLY channel by which
  //               the failing error line reaches an autonomous loop.
  //               Without it, ci.yml's shell finds no results.json and
  //               posts a deterministic "(results.json not found)"
  //               placeholder on every red run — the exact blindness
  //               #1036 was filed to fix, and the blocker Mara flagged
  //               on PR #1037. Do not remove the json reporter without
  //               replacing the relay input. The deploy M-LOOP gate
  //               (#2116) ALSO parses this file for the real executed /
  //               skipped counts posted to #1819 — hardcoding counts in
  //               the workflow would lie if the spec filtered out.
  reporter: [["list"], ["json", { outputFile: "playwright-report/results.json" }]],
  use: {
    // In served mode, baseURL points at the deployed site; otherwise the
    // local Worker the webServer below starts. `trace`/`video` are promoted
    // from "retain-on-failure" to "on" in served mode because the served
    // run IS the release record — not just a failure diagnostic. The
    // deploy workflow uploads the whole aftersign/{playwright-report,
    // test-results} tree as the aftersign-m-loop-<SHA> artifact.
    baseURL: servedBaseURL ?? `http://${WORKER_HOST}:${WORKER_PORT}/aftersign/`,
    trace: servedBaseURL ? "on" : "retain-on-failure",
    video: servedBaseURL ? "on" : "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Software WebGL (SwiftShader) is the reliable headless path for
        // three.js — see doom/playwright.config.ts for the full rationale.
        launchOptions: {
          args: [
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
          ],
        },
      },
    },
  ],
  // One web server: the real Worker (scripts/ci/worker-dev.sh builds, stages
  // public/ and runs `wrangler dev`). It serves the game at /aftersign/ and
  // the portfolio landing page at /, as game.oodim.com does, so
  // aftersign/e2e/landing-discoverability.spec.ts reads the landing page
  // from the same server (it had its own static server on :4375).
  //
  // The readiness probe uses the loopback address: it runs in this process
  // before any spec, and does not need the host name.
  //
  // Outside CI a server already on the port is reused. On a machine where
  // Node cannot start bash (Windows), run the script's three steps by hand
  // first: `npm run build:aftersign`, stage public/, `npx wrangler dev
  // --local --ip 127.0.0.1 --port 4374`.
  //
  // In SERVED mode (AFTERSIGN_BASE_URL set) webServer is undefined on
  // purpose: a deployment verification MUST NOT fall back to a local
  // build if the production URL is unavailable — that would silently
  // test the checkout, not the deployed page.
  webServer: servedBaseURL ? undefined : [
    {
      cwd: repoRoot,
      command: `bash scripts/ci/worker-dev.sh ${WORKER_PORT}`,
      url: `http://127.0.0.1:${WORKER_PORT}/aftersign/`,
      reuseExistingServer: !process.env.CI,
      // Build + stage + the Worker's first compile.
      timeout: 240_000,
    },
  ],
});
