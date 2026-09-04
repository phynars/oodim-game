import { expect, test } from "@playwright/test";

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

  await expect
    .poll(async () =>
      page.evaluate(() => window.__game?.interaction?.lastAction ?? null),
    )
    .toBe("packet-cancelled");

  const failureSnapshot = await page.evaluate(() => {
    const game = window.__game;
    const failureFeedback = game?.interaction?.failureFeedback ?? null;
    const rootStyle = getComputedStyle(document.documentElement);
    const sting = document.querySelector<HTMLElement>(".failure-sting");
    const stingStyle = sting ? getComputedStyle(sting) : null;

    return {
      failureFeedback,
      shakeX: Number.parseFloat(rootStyle.getPropertyValue("--confirm-shake-x")) || 0,
      shakeY: Number.parseFloat(rootStyle.getPropertyValue("--confirm-shake-y")) || 0,
      stingOpacity: stingStyle ? Number.parseFloat(stingStyle.opacity) || 0 : 0,
    };
  });

  expect(failureSnapshot.failureFeedback).toMatchObject({
    active: true,
    kind: "packet-cancelled",
    durationMs: 180,
    hudShakePx: 8,
    hudDropPx: 2,
    flashAlpha: 0.34,
    easing: "easeOutQuad",
  });
  expect(Math.abs(failureSnapshot.shakeX)).toBeGreaterThan(0);
  expect(failureSnapshot.shakeY).toBeGreaterThanOrEqual(0);
  expect(failureSnapshot.stingOpacity).toBeGreaterThan(0);
  expect(failureSnapshot.stingOpacity).toBeLessThanOrEqual(0.34);

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
