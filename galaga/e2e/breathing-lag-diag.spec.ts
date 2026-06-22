// Diagnostic spec for the formation-breathing-lag readiness gate (#258, Step 1
// of #258's two-step plan; refs #241, #242, #255, #256).
//
// WHY THIS EXISTS (do not "tidy" by folding it into galaga.spec.ts):
//   PR #256 burned twelve+ review cycles trying to land
//   `formation-breathing-lag.spec.ts` on cold CI without ever seeing the
//   actual failing expect(). The workflow-logs endpoint 401s for the review
//   chain, so red runs are opaque. #258 AC bullet 1 isolates the FIRST
//   thing that spec waits on — the readiness gate — into a one-assertion
//   file. If THIS file goes red on cold CI, the failure mode is the boot /
//   readiness path, not the breathing math, and the next PR can target the
//   right surface instead of guessing at tolerance tuning.
//
// SCOPE — KEEP THIS FILE TIGHT:
//   * ONE test, ONE waitForFunction on the readiness gate, NO breathing
//     assertions, NO tolerance math, NO theoretical-peak envelope, no
//     forceHit, no internals.
//   * Same boot sequence and same readiness predicate as
//     boss-two-hit.spec.ts so the diagnostic exercises the SAME gate the
//     red spec is blocked on — not a parallel one.
//   * Trace + report upload is already wired in `.github/workflows/ci.yml`
//     (galaga-playwright-trace on failure); `galaga/playwright.config.ts`
//     has `trace: 'retain-on-failure'`. If this spec goes red, the
//     follow-up PR body MUST quote the actual `--reporter=list` line
//     from the failing run before re-introducing breathing assertions.

import { expect, test } from "@playwright/test";

import type { GameState } from "../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
  }
}

test("readiness gate: every enemy reaches 'formation' within 20s on cold CI", async ({
  page,
}) => {
  await page.goto("/");

  // Same staged boot sequence as boss-two-hit.spec.ts: wait for the game
  // object, click canvas to focus, nudge once to leave READY, then wait
  // for the status flip to "playing" before the readiness assertion. If
  // ANY of these intermediate waits times out before the 20s readiness
  // gate, the failure surface is upstream of the formation choreography.
  await page.waitForFunction(() => Boolean(window.__galaga));
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => window.__galaga?.status === "playing", null, {
    timeout: 5000,
  });

  // THE ONE ASSERTION this file exists for: the readiness predicate that
  // every prior breathing-lag draft waited on. No breathing math here —
  // just: does the formation actually settle within the 20s budget?
  await page.waitForFunction(
    () => {
      const enemies = window.__galaga?.enemies ?? [];
      return (
        enemies.length > 0 && enemies.every((e) => e.state === "formation")
      );
    },
    null,
    { timeout: 20000 },
  );

  // Belt-and-braces snapshot so the `--reporter=list` line on failure of a
  // later, stricter assertion (none here today) doesn't elide the roster.
  // On success this is a no-op; on a future regression it pins what the
  // gate saw.
  const settled = await page.evaluate(() => {
    const enemies = window.__galaga?.enemies ?? [];
    return {
      count: enemies.length,
      allFormation: enemies.every((e) => e.state === "formation"),
    };
  });
  expect(settled.count).toBeGreaterThan(0);
  expect(settled.allFormation).toBe(true);
});
