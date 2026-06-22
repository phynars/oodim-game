// Two-client multiplayer smoke — the merge-gate proof that
// `e2e-shared/multiplayer/playwright-binding.ts` binds cleanly against
// the agar client's `window.__game` surface.
//
// What this spec proves (and nothing more):
//   1. assertClientSurface(page) passes against a real agar page load
//      — all 8 normative fields from CLIENT-TEST-SURFACE.md are present
//      with the right shapes (read getters/fns, drive fns).
//   2. Two independent `browser.newContext()` pages, each loading the
//      same agar room with the same `?seed=`, converge on the same
//      canonical state under `expectConverge` after driving a short
//      shared tape via `driveTape`.
//
// Scope guardrails:
//   - This is the test-surface wiring proof for #228, not a gameplay
//     test. It does not assert anything about player movement, eating,
//     or rendering — only that the harness primitives bind to the
//     client and the two pages agree on canonical state.
//   - The smoke must remain TICK-quiesced, never wallclock. The
//     binding's tickTo() resolves on a tick boundary; do not add
//     waitForTimeout here — #129's acceptance criteria ban it.
//   - If the agar Worker isn't reachable (no `wrangler dev` running
//     for the local preview), the spec skips rather than fails. The
//     full two-client wrangler-gated path is #180's scope.

import { expect, test } from "@playwright/test";
import {
  assertClientSurface,
  canonical,
  driveTape,
  expectConverge,
} from "../../e2e-shared/multiplayer/playwright-binding";
import type { Tape } from "../../e2e-shared/multiplayer/harness";

const SEED = "42";
const ROOM_URL = `/?seed=${SEED}`;

test.describe("agar · multiplayer smoke (test-surface binding)", () => {
  test("assertClientSurface passes on a fresh page load", async ({ page }) => {
    await page.goto(ROOM_URL);
    // The client installs __game synchronously at module load, so a
    // single `goto` is enough; no readiness wait.
    await expect(
      page.evaluate(() => typeof (window as unknown as { __game?: unknown }).__game),
    ).resolves.toBe("object");
    await assertClientSurface(page);
  });

  test("two contexts on the same seed converge after a shared tape", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await Promise.all([pageA.goto(ROOM_URL), pageB.goto(ROOM_URL)]);

      // Pre-flight: both pages must expose the full surface before we
      // drive. A missing field here names itself in the thrown error
      // (see playwright-binding.ts `assertClientSurface`).
      await assertClientSurface(pageA);
      await assertClientSurface(pageB);

      // Read each page's clientId via the same dual-access shape the
      // binding uses, so the tape's `clientId` attribution lines up
      // with what `driveTape` reads from the page.
      const [idA, idB] = await Promise.all(
        [pageA, pageB].map((p) =>
          p.evaluate(() => {
            const g = (window as unknown as { __game: { clientId: unknown } })
              .__game;
            const v = g.clientId;
            return typeof v === "function" ? (v as () => string)() : (v as string);
          }),
        ),
      );

      // Minimal shared tape: each client sends one input at an early
      // tick. The DO collapses to latest-input-wins per tick, so the
      // exact inputs don't matter for convergence — what matters is
      // that both pages see the same authoritative state afterwards.
      const tape: Tape<string> = [
        { tick: 2, clientId: idA, seq: 0, input: "right" },
        { tick: 2, clientId: idB, seq: 0, input: "left" },
        { tick: 4, clientId: idA, seq: 1, input: "none" },
        { tick: 4, clientId: idB, seq: 1, input: "none" },
      ];

      await driveTape([pageA, pageB], tape);

      // Both pages read canonical state on the same tick boundary
      // (driven by their own tickTo); expectConverge fails the test
      // with a side-by-side state diff if they disagree.
      await expectConverge([pageA, pageB]);

      // Sanity: each page is past the last tape tick. Read via the
      // same dual access the binding uses.
      const [tickA, tickB] = await Promise.all(
        [pageA, pageB].map((p) =>
          p.evaluate(() => {
            const g = (window as unknown as { __game: { tick: unknown } }).__game;
            const v = g.tick;
            return typeof v === "function" ? (v as () => number)() : (v as number);
          }),
        ),
      );
      expect(tickA).toBeGreaterThanOrEqual(4);
      expect(tickB).toBeGreaterThanOrEqual(4);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
