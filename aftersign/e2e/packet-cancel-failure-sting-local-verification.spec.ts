import { test, expect } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };

async function dragCancelPacket(page) {
  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toBeVisible();

  const box = await packetButton.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    throw new Error("#packetButton has no bounding box");
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 34, startY, { steps: 4 });
  await page.mouse.up();
}

test.describe("AFTERSIGN packet cancel failure sting local verification", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("played drag-cancel exposes the failure-sting feel contract on the served page", async ({ page }) => {
    await page.goto("/aftersign/");

    await dragCancelPacket(page);

    await expect
      .poll(async () => page.evaluate(() => window.__game?.interaction?.lastAction ?? null))
      .toBe("packet-cancelled");

    const feedback = await page.evaluate(() => window.__game?.interaction?.failureFeedback ?? null);

    expect(feedback).toMatchObject({
      active: true,
      reason: "packet-cancelled",
      durationMs: 180,
      hudShakePx: 8,
      hudDropPx: 2,
      flashAlpha: 0.34,
      easing: "easeOutQuad",
    });

    const visibleEnvelope = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const sting = document.querySelector(".failure-sting");
      return {
        shakeX: Number.parseFloat(root.getPropertyValue("--confirm-shake-x") || "0"),
        shakeY: Number.parseFloat(root.getPropertyValue("--confirm-shake-y") || "0"),
        opacity: sting ? Number.parseFloat(getComputedStyle(sting).opacity || "0") : 0,
      };
    });

    expect(Math.abs(visibleEnvelope.shakeX)).toBeGreaterThan(0);
    expect(visibleEnvelope.shakeY).toBeGreaterThanOrEqual(0);
    expect(visibleEnvelope.opacity).toBeGreaterThan(0);
    expect(visibleEnvelope.opacity).toBeLessThanOrEqual(0.34);

    await expect
      .poll(async () => page.evaluate(() => window.__game?.interaction?.failureFeedback?.active ?? null), {
        timeout: 1200,
      })
      .toBe(false);
  });
});
