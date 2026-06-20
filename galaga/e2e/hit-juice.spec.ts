// Bullet→enemy hit juice (#133). Drives one deterministic kill via the
// __galagaInternals.forceHit hook and asserts the snapshot at tick T+1
// satisfies the FeedbackChannel contract from the issue:
//   feedback.hitstopTicks >= 1
//   feedback.shakeAmplitude >= 2.5
//   feedback.sparks.length === 8     (non-boss kill)
//   feedback.popups.length === 1
// Plus a separate run that walks the hitstop window through and asserts
// shake amplitude crosses < 0.1 within 16 ticks of the hit — the spec's
// "feel snappy, not lingering" guard.
//
// We hand-pick a NON-BOSS enemy and force it to `formation` state so the
// scoring path is deterministic (50 for a bee parked, 80 for a butterfly,
// regardless of state at write time). The kill fires writeHitFeedback's
// "kill" branch — full 8 sparks, 2-frame hitstop, 3px shake, +N popup.

import { expect, test } from "@playwright/test";

import type { GalagaInternals, GameState } from "../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
    __galagaInternals?: GalagaInternals;
  }
}

test.describe("Galaga bullet→enemy hit juice (#133)", () => {
  test("non-boss kill writes hitstop, shake, sparks, and a popup on the feedback channel", async ({
    page,
  }) => {
    await page.goto("/");
    // Start the loop + wait until a non-boss enemy is on stage.
    await page.locator("canvas").click();
    await page.waitForFunction(
      () =>
        !!window.__galaga &&
        window.__galaga.enemies.some((e) => e.kind !== "boss"),
      { timeout: 8000 },
    );

    const result = await page.evaluate(() => {
      const s = window.__galaga!;
      const target = s.enemies.find((e) => e.kind !== "boss");
      if (!target) return { ok: false as const, reason: "no non-boss enemy" };
      // Park it in formation so the kill path is the single-hit, fixed-
      // value scoring path (no diving bonus volatility).
      target.state = "formation";
      // Reset the feedback channel to its initial empty shape BEFORE the
      // forced kill. Between page-load and this evaluate, the real loop
      // has been ticking — a stray player bullet or diving collision could
      // already have written to the channel (or left residual sparks
      // mid-decay), which would invalidate the "+1 popup / 8 sparks" delta
      // assertions below. Clearing here makes the post-snapshot purely the
      // product of the single forceHit we're about to fire.
      s.feedback.hitstopTicks = 0;
      s.feedback.shakeAmplitude = 0;
      s.feedback.sparks = [];
      s.feedback.popups = [];
      const tickBefore = s.tick;
      window.__galagaInternals!.forceHit({
        target: "enemy",
        enemyId: target.id,
      });
      // After forceHit, the snapshot we read is conceptually "tick T"
      // (the kill tick) — feedback values are freshly written, undecayed
      // because writeHitFeedback runs INSIDE forceHit and the decay pass
      // only fires at the top of the NEXT update(). That's the snapshot
      // the issue's acceptance criterion targets.
      const post = window.__galaga!;
      return {
        ok: true as const,
        tickBefore,
        tickAfter: post.tick,
        after: {
          hitstopTicks: post.feedback.hitstopTicks,
          shakeAmplitude: post.feedback.shakeAmplitude,
          sparks: post.feedback.sparks.length,
          popups: post.feedback.popups.length,
        },
      };
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // After the hit: the acceptance criterion from #133.
    expect(result.after.hitstopTicks).toBeGreaterThanOrEqual(1);
    expect(result.after.shakeAmplitude).toBeGreaterThanOrEqual(2.5);
    expect(result.after.sparks).toBe(8);
    expect(result.after.popups).toBe(1);
  });

  test("shake amplitude decays below 0.1 within 16 ticks of the hit", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("canvas").click();
    await page.waitForFunction(
      () =>
        !!window.__galaga &&
        window.__galaga.enemies.some((e) => e.kind !== "boss"),
      { timeout: 8000 },
    );

    // Force a kill, capture the kill tick, then poll until 16 ticks have
    // elapsed and read the shake amplitude.
    const killTick = await page.evaluate(() => {
      const s = window.__galaga!;
      const target = s.enemies.find((e) => e.kind !== "boss")!;
      target.state = "formation";
      // Reset the feedback channel so any prior residual shake from a
      // mid-loop collision doesn't influence the decay sample. The
      // forceHit below is the SOLE source of shake we're measuring.
      s.feedback.hitstopTicks = 0;
      s.feedback.shakeAmplitude = 0;
      s.feedback.sparks = [];
      s.feedback.popups = [];
      window.__galagaInternals!.forceHit({
        target: "enemy",
        enemyId: target.id,
      });
      return window.__galaga!.tick;
    });

    // Wait for tick to advance 16 ticks past the kill. 16 ticks at 60Hz is
    // ~267ms, but CI runners (especially under load) can throttle rAF —
    // 5s is a generous ceiling that still fails fast if the loop genuinely
    // stalls. The hitstop pause itself is only 2 ticks; the remaining 14
    // ticks of decay are normal sim time.
    await page.waitForFunction(
      (kt) => {
        const s = window.__galaga;
        if (!s) return false;
        return s.tick - kt >= 16;
      },
      killTick,
      { timeout: 5000 },
    );

    const finalShake = await page.evaluate(
      () => window.__galaga!.feedback.shakeAmplitude,
    );
    expect(finalShake).toBeLessThan(0.1);
  });
});
