import { expect, test } from "@playwright/test";

const parsePx = (value: string | null) => {
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace("px", ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseOpacity = (value: string | null) => {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

test.describe("AFTERSIGN packet cancel reduced-motion failure sting", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });

  test("real drag-cancel keeps the flash/drop acknowledgement while suppressing lateral shake", async ({ page }) => {
    await page.goto("/aftersign/?slot=packet-cancel-reduced-motion-failure-sting-played");

    await page.waitForFunction(() => window.__game?.scene?.ready === true);
    await page.evaluate(async () => {
      await window.__game.resetSliceSave();
    });

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible();

    const box = await packetButton.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // The packet-intent cancel threshold is 14px; a 34px played drift
    // is deliberate enough to cancel without relying on harness input.
    await page.mouse.move(startX + 34, startY, { steps: 4 });
    await page.mouse.up();

    await expect
      .poll(async () => page.evaluate(() => window.__game?.interaction?.lastAction))
      .toBe("packet-cancelled");

    const failure = await page.evaluate(() => window.__game.interaction.failureFeedback);
    expect(failure).toMatchObject({
      active: true,
      durationMs: 180,
      hudShakePx: 8,
      hudDropPx: 2,
      flashAlpha: 0.34,
      easing: "easeOutQuad",
      kind: "packet-cancelled",
    });

    const liveReducedMotionSting = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const sting = document.querySelector<HTMLElement>(".failure-sting");
      return {
        shakeX: root.getPropertyValue("--confirm-shake-x"),
        shakeY: root.getPropertyValue("--confirm-shake-y"),
        opacity: sting ? getComputedStyle(sting).opacity : "0",
      };
    });

    expect(parsePx(liveReducedMotionSting.shakeX)).toBe(0);
    expect(parsePx(liveReducedMotionSting.shakeY)).toBeGreaterThan(0);
    expect(parsePx(liveReducedMotionSting.shakeY)).toBeLessThanOrEqual(2);
    expect(parseOpacity(liveReducedMotionSting.opacity)).toBeGreaterThan(0);
    expect(parseOpacity(liveReducedMotionSting.opacity)).toBeLessThanOrEqual(0.34);

    await expect
      .poll(async () => page.evaluate(() => window.__game.interaction.failureFeedback.active), {
        timeout: 1200,
      })
      .toBe(false);
  });
});

declare global {
  interface Window {
    __game: {
      scene: { ready: boolean };
      resetSliceSave: () => Promise<void>;
      interaction: {
        lastAction: string | null;
        failureFeedback: {
          active: boolean;
          durationMs: number;
          hudShakePx: number;
          hudDropPx: number;
          flashAlpha: number;
          easing: string;
          kind: string | null;
        };
      };
    };
  }
}
