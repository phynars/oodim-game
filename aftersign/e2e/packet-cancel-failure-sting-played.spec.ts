import { expect, test } from "@playwright/test";

const slot = `failure-sting-played-${Date.now()}`;

const readFailureFeedback = async (page) =>
  page.evaluate(() => {
    const game = window.__game;
    return {
      lastAction: game?.interaction?.lastAction ?? null,
      feedback: game?.interaction?.failureFeedback ?? null,
      flashOpacity: Number.parseFloat(
        getComputedStyle(document.querySelector(".failure-sting")).opacity || "0",
      ),
      shakeX: getComputedStyle(document.documentElement)
        .getPropertyValue("--confirm-shake-x")
        .trim(),
      shakeY: getComputedStyle(document.documentElement)
        .getPropertyValue("--confirm-shake-y")
        .trim(),
    };
  });

test.describe("packet cancel failure sting — played surface", () => {
  test("a real drift-cancel tap arms the 180ms/8px/0.34 failure sting on the served page", async ({
    page,
  }) => {
    await page.goto(`/aftersign/?slot=${slot}`);
    await page.waitForFunction(() => window.__game?.scene?.ready === true);

    const packet = page.locator("#packetButton");
    await expect(packet).toBeVisible();

    const box = await packet.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 34, startY, { steps: 3 });

    await expect
      .poll(() => readFailureFeedback(page), { timeout: 1000 })
      .toMatchObject({
        lastAction: "packet-cancelled",
        feedback: {
          active: true,
          remainingMs: expect.any(Number),
          hudShakePx: 8,
          hudDropPx: 2,
          flashAlpha: 0.34,
          durationMs: 180,
          easing: "easeOutQuad",
        },
      });

    const armed = await readFailureFeedback(page);
    expect(armed.feedback.remainingMs).toBeGreaterThan(0);
    expect(armed.feedback.remainingMs).toBeLessThanOrEqual(180);
    expect(Math.abs(Number.parseFloat(armed.shakeX))).toBeGreaterThan(0);
    expect(Number.parseFloat(armed.shakeY)).toBeGreaterThanOrEqual(0);
    expect(armed.flashOpacity).toBeGreaterThan(0);
    expect(armed.flashOpacity).toBeLessThanOrEqual(0.34);

    await expect
      .poll(async () => (await readFailureFeedback(page)).feedback.active, {
        timeout: 1200,
      })
      .toBe(false);

    await page.mouse.up();
  });
});
