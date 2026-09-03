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

    // Real drift-cancel gesture: pointer down on the packet, drag past
    // the ~34px cancel threshold, then release. Releasing INSIDE the
    // gesture (rather than at test end) matters — the failure envelope
    // is triggered at commit time (packet-cancelled) and decays on the
    // wall clock, but we don't want to hold the button across the
    // full 180ms decay window: a shipped player lifts their finger
    // after a mis-swipe, and the rAF loop needs to sample the envelope
    // post-release to flip `active=false`.
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 34, startY, { steps: 3 });
    await page.mouse.up();

    // Poll for the armed envelope. The commit fires on pointerup at
    // the latest, so this is the first frame `failureFeedback.active`
    // should be true with the pinned feel numbers on state.
    await expect
      .poll(() => readFailureFeedback(page), { timeout: 1500 })
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
    expect(Math.abs(Number.parseFloat(armed.shakeX))).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(armed.shakeY)).toBeGreaterThanOrEqual(0);
    expect(armed.flashOpacity).toBeGreaterThan(0);
    expect(armed.flashOpacity).toBeLessThanOrEqual(0.34);

    // Envelope decays on the wall clock from trigger time. Budget:
    // 180ms envelope + up to one rAF frame (~17ms) to sample the
    // deactivation + generous scheduling headroom for a slow CI
    // worker. 2500ms is well past the mathematical floor and well
    // under Playwright's default expect timeout.
    await expect
      .poll(async () => (await readFailureFeedback(page)).feedback.active, {
        timeout: 2500,
        intervals: [50, 100, 200],
      })
      .toBe(false);
  });
});
