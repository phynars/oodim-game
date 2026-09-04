import { expect, test, type Page } from "@playwright/test";

type FailureSnapshot = {
  lastAction: string | null;
  failureFeedback: Record<string, unknown> | null;
  shakeX: number;
  shakeY: number;
  stingOpacity: number;
};

// Atomic poll: capture `lastAction` and the failure-sting envelope inside a
// SINGLE page.evaluate so the 180ms rAF decay can't race between the "cancel
// confirmed" check and the state read. Playwright's own expect.poll would
// require two round-trips (one to confirm, one to snapshot) — that gap is the
// race the reviewer flagged.
async function pollForCancelSnapshot(
  page: Page,
  { timeoutMs = 5000, intervalMs = 25 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<FailureSnapshot> {
  const deadline = Date.now() + timeoutMs;
  let last: FailureSnapshot | null = null;
  while (Date.now() < deadline) {
    const snapshot = await page.evaluate(() => {
      const game = window.__game;
      const lastAction = game?.interaction?.lastAction ?? null;
      const failureFeedback = game?.interaction?.failureFeedback ?? null;
      const rootStyle = getComputedStyle(document.documentElement);
      const sting = document.querySelector<HTMLElement>(".failure-sting");
      const stingStyle = sting ? getComputedStyle(sting) : null;
      return {
        lastAction,
        failureFeedback,
        shakeX:
          Number.parseFloat(rootStyle.getPropertyValue("--confirm-shake-x")) || 0,
        shakeY:
          Number.parseFloat(rootStyle.getPropertyValue("--confirm-shake-y")) || 0,
        stingOpacity: stingStyle ? Number.parseFloat(stingStyle.opacity) || 0 : 0,
      } as FailureSnapshot;
    });
    last = snapshot;
    if (snapshot.lastAction === "packet-cancelled") return snapshot;
    // pacing
    await page.waitForTimeout(intervalMs);
  }
  throw new Error(
    `Timed out waiting for packet-cancelled; last snapshot: ${JSON.stringify(last)}`,
  );
}

test("packet cancel plays the served failure sting from a real pointer gesture", async ({ page }) => {
  await page.goto("/");

  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toBeVisible();

  const box = await packetButton.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 34, startY, { steps: 6 });
  await page.mouse.up();

  const failureSnapshot = await pollForCancelSnapshot(page);

  // Pin the non-decaying feel constants — these are spread from
  // FAILURE_FEEDBACK at trigger time and never mutate during the envelope.
  // We deliberately do NOT assert `active: true` because the 180ms rAF fold
  // can flip it to false on a slow runner before the assertion executes,
  // even though the snapshot was captured atomically with the cancel confirm.
  expect(failureSnapshot.failureFeedback).toMatchObject({
    kind: "packet-cancelled",
    durationMs: 180,
    hudShakePx: 8,
    hudDropPx: 2,
    flashAlpha: 0.34,
    easing: "easeOutQuad",
  });

  await expect
    .poll(
      async () =>
        page.evaluate(
          () => window.__game?.interaction?.failureFeedback?.active ?? false,
        ),
      { timeout: 1200 },
    )
    .toBe(false);
});
