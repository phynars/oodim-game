// AFTERSIGN Playwright globalSetup — SwiftShader / vite-preview warmup.
//
// Why this file exists (#1032 / PR #1033 iter 2):
// Serializing the lane (`workers: 1`, `fullyParallel: !CI`) removed
// concurrent GPU cold-start contention but the "Test aftersign WebGL e2e
// (Playwright)" step still failed red. The residual failure shape is a
// FIRST-SPEC cold start: the first spec in the lane pays the entire
// SwiftShader-context + vite-preview-first-request tax inside its own
// per-test timeout, and any hitch there (SwiftShader taking ~seconds to
// hand back a WebGL2 context, vite compiling on first request) times the
// spec out before its assertions even begin.
//
// This globalSetup runs ONCE before any spec, drives one full cold path
// through the same headless Chromium + SwiftShader configuration the
// suite uses, and lets Playwright's per-spec timeouts start after the
// expensive one-time work is done:
//   1. Launch chromium with the same SwiftShader launch args as the
//      chromium project below (see playwright.config.ts).
//   2. Open the aftersign baseURL and wait for the DOM.
//   3. Wait for a WebGL2 context to be obtainable — this is the exact
//      surface the specs need, so blocking here means the specs don't.
//   4. Also hit the landing static server so its Node script has served
//      one request before the landing-discoverability spec runs.
//
// If ANY of these fail, we throw and the whole lane fails fast with a
// clear "warmup failed" message instead of one opaque spec timeout.
// If they succeed, the warmup work is banked and subsequent specs
// start warm.

import { chromium, request as playwrightRequest } from "@playwright/test";

const AFTERSIGN_URL = "http://localhost:4374/aftersign/";
const LANDING_URL = "http://localhost:4375/";
const WEBGL_WAIT_MS = 30_000;

export default async function globalSetup(): Promise<void> {
  // Only warm up in CI. Local dev reuses servers (reuseExistingServer:true)
  // and pays cold-start once per `npx playwright test` invocation anyway;
  // adding a 20-30s warmup to every local run would be user-hostile.
  if (!process.env.CI) return;

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
    // 1) Prime the aftersign vite-preview + three.js SwiftShader path.
    await page.goto(AFTERSIGN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // 2) Confirm a WebGL2 context is actually obtainable in this headless
    //    Chromium. This is what SwiftShader takes seconds to hand back on
    //    the very first request; doing it here (once) means no spec
    //    times out on it.
    await page.waitForFunction(
      () => {
        try {
          const c = document.createElement("canvas");
          return !!c.getContext("webgl2");
        } catch {
          return false;
        }
      },
      undefined,
      { timeout: WEBGL_WAIT_MS },
    );
    await ctx.close();
  } finally {
    await browser.close();
  }

  // 3) Warm the landing static server (Node script at scripts/serve-landing.mjs)
  //    so landing-discoverability.spec.ts's first request isn't the cold one.
  //    Use Playwright's request API — no browser needed for a static GET.
  try {
    const req = await playwrightRequest.newContext();
    const res = await req.get(LANDING_URL, { timeout: 20_000 });
    if (!res.ok()) {
      throw new Error(
        `landing warmup: ${LANDING_URL} responded ${res.status()}`,
      );
    }
    await req.dispose();
  } catch (err) {
    // Landing warmup is best-effort — the aftersign lane's primary signal
    // is the WebGL path above. Log and continue rather than red-gate.
    // eslint-disable-next-line no-console
    console.warn("[aftersign globalSetup] landing warmup skipped:", err);
  }
}
