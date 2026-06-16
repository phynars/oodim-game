import { expect, test } from "@playwright/test";

// Gameplay verification harness. We assert on `window.__pac` — the state
// contract from src/game/types.ts — rather than pixels. Every gameplay PR
// extends this file with assertions that FAIL on the pre-change code and
// PASS after.

test("boots to ready and tick rises across two animation frames", async ({
  page,
}) => {
  await page.goto("/");

  // Wait for the engine to publish the state contract.
  await page.waitForFunction(() => !!window.__pac);

  // Boot contract: status === 'ready', score 0, lives 3.
  const initial = await page.evaluate(() => ({ ...window.__pac! }));
  expect(initial.status).toBe("ready");
  expect(initial.score).toBe(0);
  expect(initial.lives).toBe(3);
  expect(typeof initial.tick).toBe("number");

  // Capture a tick value AFTER one rAF, then another AFTER a second rAF, and
  // assert the value strictly increased between them — this is what proves
  // the loop is actually driving update(), not just exposing static state.
  const [tickAfterFrameA, tickAfterFrameB] = await page.evaluate(
    () =>
      new Promise<[number, number]>((resolve) => {
        requestAnimationFrame(() => {
          const a = window.__pac!.tick;
          requestAnimationFrame(() => {
            const b = window.__pac!.tick;
            resolve([a, b]);
          });
        });
      }),
  );

  expect(tickAfterFrameB).toBeGreaterThan(tickAfterFrameA);
});
