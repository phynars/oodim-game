// AFTERSIGN Playwright globalSetup — real cold-start warmup (#1032 iter 4).
//
// Iter-1 (workers:1) removed concurrent SwiftShader contention. Iter-2
// added a globalSetup that waited on `document.createElement("canvas")
// .getContext("webgl2")` — synthetic, didn't exercise three.js. Iter-3
// drove the real `__game.version === 1` wait in warmup — correct
// contract, but the warmup was FATAL (rethrew on any failure), so if
// the warmup itself timed out at the 120s budget the whole lane died
// with no spec output.  That is strictly worse than the pre-warmup
// baseline for the "warmup thesis is incomplete" case.
//
// Iter-4 fix: keep the warmup, but make it BEST-EFFORT.  A completed
// warmup still pays the vite-preview + SwiftShader + three.js boot
// cost outside any per-test budget (the whole point).  A failed or
// timed-out warmup logs `[aftersign globalSetup]` diagnostics and
// returns without throwing, so the lane falls through to its
// spec-level `retries: 3` instead of hard-failing on a setup step.
// This preserves the win when the thesis is right and stops making
// things worse when it isn't.
//
// The specs (aftersign/e2e/*.spec.ts) all block on the same readiness
// signal: `window.__game?.version === 1` (48+ matches in e2e/).  That
// signal is set AFTER the aftersign bundle boots, three.js constructs
// its renderer against SwiftShader, and the scene mounts.  If ANY of
// those steps take seconds on cold start — vite-preview compiling the
// first request, SwiftShader initializing its software renderer,
// three.js building buffers — the first spec eats the whole cost
// inside its own per-test timeout and times out before its assertions
// begin.
//
// So this globalSetup drives the EXACT same wait the specs do, once,
// with a generous timeout, before any spec claims the clock:
//   1. Launch chromium with the same SwiftShader args the chromium
//      project uses (keep in sync with playwright.config.ts).
//   2. Navigate to the aftersign baseURL.
//   3. Wait for `window.__game?.version === 1` — the actual readiness
//      contract every spec asserts on.  Best-effort.
//   4. Best-effort warm the landing static server so its first request
//      isn't a spec's request.
//
// Failure surfaces with a "[aftersign globalSetup]" prefix so a future
// CI red gives the reviewer a diagnosable line — you can grep the job
// log for that prefix to see whether the warmup succeeded, warmed
// partially, or timed out entirely.

import { chromium, request as playwrightRequest } from "@playwright/test";

const AFTERSIGN_URL = "http://localhost:4374/aftersign/";
const LANDING_URL = "http://localhost:4375/";
// Cold-start budget for the real __game.version=1 wait. Specs use
// timeouts in the 60_000ms range; this needs to be generous enough that
// the FIRST cold boot (vite-preview + SwiftShader + three.js + scene
// mount) fits comfortably.
const GAME_READY_WAIT_MS = 120_000;
const NAV_TIMEOUT_MS = 90_000;

// Local `window.__game` shape — we only touch `version`; the real
// contract lives across aftersign/src/. Keep this minimal to avoid a
// cross-package type import in a Playwright globalSetup file.
declare global {
  interface Window {
    __game?: { version?: number };
  }
}

export default async function globalSetup(): Promise<void> {
  // Local dev reuses servers (`reuseExistingServer: !process.env.CI`) and
  // typically already has a warm preview; adding a 30-120s warmup to
  // every `npx playwright test` run would be user-hostile. CI is where
  // the cold-start tax bites.
  if (!process.env.CI) return;

  const startedAt = Date.now();
  const browser = await chromium.launch({
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    ],
  });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Surface page errors during warmup so a red CI shows the actual
    // failure (uncaught exception in aftersign boot) instead of a bare
    // timeout on __game.version.
    page.on("pageerror", (err) => {
      // eslint-disable-next-line no-console
      console.error("[aftersign globalSetup] pageerror:", err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        // eslint-disable-next-line no-console
        console.error("[aftersign globalSetup] console.error:", msg.text());
      }
    });

    await page.goto(AFTERSIGN_URL, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });

    // The REAL readiness contract — the same predicate every spec waits
    // on. If this returns within budget, subsequent specs start warm and
    // their per-test timeouts cover only the beat-specific work.
    await page.waitForFunction(() => window.__game?.version === 1, undefined, {
      timeout: GAME_READY_WAIT_MS,
    });

    // eslint-disable-next-line no-console
    console.log(
      `[aftersign globalSetup] __game.version=1 ready in ${Date.now() - startedAt}ms`,
    );

    await ctx.close();
  } catch (err) {
    // BEST-EFFORT: do NOT rethrow.  A rethrow here kills the whole lane
    // on a warmup step and gives zero spec-level signal — strictly worse
    // than letting the specs run with their own `retries: 3` budget.
    // Iter-3 rethrew and produced red CI even in cases where the specs
    // themselves would have passed on retry.  Log the diagnostic prefix
    // (grep `[aftersign globalSetup] warmup did not complete` in the job
    // log to distinguish "warmup helped" from "warmup itself failed") and
    // fall through.
    const elapsedMs = Date.now() - startedAt;
    // eslint-disable-next-line no-console
    console.warn(
      `[aftersign globalSetup] warmup did not complete after ${elapsedMs}ms — falling through to spec-level retries. This is not a lane failure; specs will retry on their own budget.`,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    await browser.close();
  }

  // Landing warmup is best-effort — the primary signal is the WebGL/game
  // path above. If the landing static server hiccups here, log and let
  // landing-discoverability.spec.ts's own retries cover it.
  try {
    const req = await playwrightRequest.newContext();
    const res = await req.get(LANDING_URL, { timeout: 20_000 });
    if (!res.ok()) {
      // eslint-disable-next-line no-console
      console.warn(
        `[aftersign globalSetup] landing warmup: ${LANDING_URL} responded ${res.status()}`,
      );
    }
    await req.dispose();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[aftersign globalSetup] landing warmup skipped:", err);
  }
}
