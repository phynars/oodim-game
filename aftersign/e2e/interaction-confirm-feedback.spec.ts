import { test, expect } from "@playwright/test";

test.describe("AFTERSIGN interaction confirm feel contract", () => {
  test("deliver action emits 220ms confirm feedback with tuned camera/hud coupling", async ({
    page,
  }) => {
    await page.goto(`/aftersign/?slot=confirm-feedback-${Date.now()}`);
    await page.waitForFunction(() => window.__game?.version === 1);

    const before = await page.evaluate(() => ({
      beat: window.__game!.scene.beat,
      confirmCount: window.__game!.interaction.confirmCount,
    }));
    expect(before.beat).toBe("packet-offered");

    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.waitForFunction(() => window.__game?.scene.beat === "packet-delivered");

    const during = await page.evaluate(() => ({
      beat: window.__game!.scene.beat,
      delivered: window.__game!.packet.delivered,
      lastAction: window.__game!.interaction.lastAction,
      confirmCount: window.__game!.interaction.confirmCount,
      confirmFeedback: window.__game!.interaction.confirmFeedback,
    }));

    expect(during.beat).toBe("packet-delivered");
    expect(during.delivered).toBe(true);
    expect(during.lastAction).toBe("contract-input");
    expect(during.confirmCount).toBe(before.confirmCount + 1);

    expect(during.confirmFeedback.durationMs).toBe(220);
    expect(during.confirmFeedback.easing).toBe("easeOutCubic");
    expect(during.confirmFeedback.cameraKickDeg).toBeCloseTo(1.4, 3);
    expect(during.confirmFeedback.cameraKickWorldX).toBeCloseTo(0.055, 3);
    expect(during.confirmFeedback.hudShakePx).toBe(10);
    expect(during.confirmFeedback.hudLiftPx).toBe(3);
    expect(during.confirmFeedback.active).toBe(true);
    expect(during.confirmFeedback.remainingMs).toBeGreaterThan(0);
    expect(during.confirmFeedback.remainingMs).toBeLessThanOrEqual(220);

    await page.waitForFunction(() => window.__game?.interaction.confirmFeedback.active === false);

    const after = await page.evaluate(() => window.__game!.interaction.confirmFeedback);
    expect(after.active).toBe(false);
    expect(after.remainingMs).toBe(0);
  });
});
