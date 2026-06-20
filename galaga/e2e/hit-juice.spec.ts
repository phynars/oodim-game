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
//
// READINESS / TIMING (this file's earlier revisions were CI-red on cold
// runners — three concrete fixes vs. v1):
//   1. Mirror boss-two-hit.spec.ts's `bootToSettledFormation` exactly:
//      wait for __galaga → click canvas → press ArrowLeft → wait
//      status==='playing' → wait __galagaInternals → wait whole formation
//      settled. v1 raced the entrance choreography: it waited only for
//      "some non-boss enemy on stage", which can resolve while enemies
//      are still in `entering` state and `__galagaInternals` may not
//      yet exist on a slow boot.
//   2. waitForFunction ceilings sized for cold CI: 5s for status flip
//      and internals attach (sub-second on warm; cold rAF can take ~2s),
//      20s for the full formation to settle (the entrance choreography
//      is multiple seconds of staggered fly-ins).
//   3. The 16-tick decay wait now allows 10s (was 5s). 16 sim ticks is
//      ~267ms of in-game time, but cold rAF on CI throttles aggressively;
//      a generous ceiling still fails fast if the loop genuinely stalls
//      (e.g. hitstop accumulation freezing the spawn scheduler).

import { expect, test } from "@playwright/test";

import type { GalagaInternals, GameState } from "../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
    __galagaInternals?: GalagaInternals;
  }
}

/** Boot the game out of READY and wait for the full enemy formation to
 *  settle. Copied (intentionally) from boss-two-hit.spec.ts because that
 *  spec has been CI-stable across hundreds of runs — the readiness
 *  sequence (status flip → internals attach → every enemy reaches
 *  formation) is the only pattern proven to avoid the race-with-entrance
 *  flakiness on cold CI. */
async function bootToSettledFormation(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => window.__galaga?.status === "playing", null, {
    timeout: 5000,
  });
  await page.waitForFunction(() => Boolean(window.__galagaInternals), null, {
    timeout: 5000,
  });
  await page.waitForFunction(
    () => {
      const enemies = window.__galaga?.enemies ?? [];
      return (
        enemies.length > 0 && enemies.every((e) => e.state === "formation")
      );
    },
    null,
    { timeout: 20000 },
  );
}

test.describe("Galaga bullet→enemy hit juice (#133)", () => {
  test("non-boss kill writes hitstop, shake, sparks, and a popup on the feedback channel", async ({
    page,
  }) => {
    await bootToSettledFormation(page);

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
      // `juice: true` opts THIS forceHit into writing hitstop/shake/sparks/
      // popup onto `state.feedback` (the channel #133 introduced). The
      // default is `false` so EXISTING mass-kill harness patterns (perfect-
      // stage drain, challenging-stage drain, formation clear) don't pin
      // `hitstopTicks > 0` across rAF yields and starve the spawn scheduler
      // / `maybeAdvanceStage` of simulation ticks. See `forceHit` jsdoc
      // in galaga/src/game/types.ts.
      window.__galagaInternals!.forceHit({
        target: "enemy",
        enemyId: target.id,
        juice: true,
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
    await bootToSettledFormation(page);

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
      // Opt in to juice writes for this measurement. See the opt-in
      // rationale above (and the `forceHit` jsdoc in types.ts).
      window.__galagaInternals!.forceHit({
        target: "enemy",
        enemyId: target.id,
        juice: true,
      });
      return window.__galaga!.tick;
    });

    // Wait for tick to advance 16 ticks past the kill. 16 ticks at 60Hz is
    // ~267ms in-game time, but cold-boot CI throttles rAF aggressively —
    // 10s is a generous ceiling that still fails fast if the loop genuinely
    // stalls (e.g. hitstop accumulation freezing the spawn scheduler).
    // The hitstop pause itself is only 2 ticks; the remaining 14 ticks of
    // decay are normal sim time.
    await page.waitForFunction(
      (kt) => {
        const s = window.__galaga;
        if (!s) return false;
        return s.tick - kt >= 16;
      },
      killTick,
      { timeout: 10000 },
    );

    const finalShake = await page.evaluate(
      () => window.__galaga!.feedback.shakeAmplitude,
    );
    expect(finalShake).toBeLessThan(0.1);
  });
});
