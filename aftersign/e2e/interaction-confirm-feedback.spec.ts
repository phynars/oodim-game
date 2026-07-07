import { test, expect } from "@playwright/test";

// Cold-start budget: SwiftShader init + esm.sh cold fetch of
// three@0.165.0 + first WebGL context routinely eats Playwright's default
// 30s test timeout on CI. Mirrors save-slot-isolation.spec.ts — the
// invariant under test is fine; the harness just needs to tolerate a
// slow first paint. See PR #477 review.
const COLD_START_MS = 90_000;
// Per-wait budget: any single window.__game observation should survive
// the first navigation's module import + WebGL bring-up.
const WAIT_MS = 60_000;

test.describe("AFTERSIGN interaction confirm feel contract", () => {
  test("deliver action emits 220ms confirm feedback with tuned camera/hud coupling", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(`/aftersign/?slot=confirm-feedback-${Date.now()}`);
    await page.waitForFunction(() => window.__game?.version === 1, undefined, {
      timeout: WAIT_MS,
    });

    const before = await page.evaluate(() => ({
      beat: window.__game!.scene.beat,
      confirmCount: window.__game!.interaction.confirmCount,
    }));
    expect(before.beat).toBe("packet-offered");

    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.waitForFunction(
      () => window.__game?.scene.beat === "packet-delivered",
      undefined,
      { timeout: WAIT_MS },
    );

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

    await page.waitForFunction(
      () => window.__game?.interaction.confirmFeedback.active === false,
      undefined,
      { timeout: WAIT_MS },
    );

    const after = await page.evaluate(() => window.__game!.interaction.confirmFeedback);
    expect(after.active).toBe(false);
    expect(after.remainingMs).toBe(0);
  });
});
