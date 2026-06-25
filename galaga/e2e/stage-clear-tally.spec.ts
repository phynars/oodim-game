// Stage-clear bonus tally count-up (#273) — the celebratory beat between
// NON-challenging stages, mirroring Pac-Man's level-clear cinematic (#183).
// On a normal stage clear the engine commits the bonus to `state.score`
// ONCE, then holds the field for a 6-frame hitstop followed by a 24-tick
// linear tally window during which the HUD animates the displayed score up
// to the committed total. This spec proves that sequence against the public
// contract + the `displayScore()` probe — no canvas pixel reads.
//
// House-style note (#313): NO `page.waitForTimeout`. Every wait below is a
// state-quiesced `waitForFunction` keyed on the engine's own counters
// (`stageBonusTallyTicks`, `displayScore()`), so the assertions track the
// real tally as wall time drives the rAF loop's fixed-step ticks.

import { expect, test } from "@playwright/test";

import type { GalagaInternals, GameState } from "../src/game/types";
import { STAGE_BONUS } from "../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
    __galagaInternals?: GalagaInternals;
  }
}

test("stage clear holds a hitstop, then counts the score up to the committed bonus before the next stage spawns (#273)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(
    () => window.__galaga?.status === "playing",
    null,
    { timeout: 5000 },
  );
  await page.waitForFunction(() => Boolean(window.__galagaInternals), null, {
    timeout: 5000,
  });

  // Wait for the entire formation to spawn + settle so `isEmpty()` is true
  // once we kill them all and the stage-clear path actually fires (same gate
  // the stage-clear + #65 tests use).
  await page.waitForFunction(
    () => {
      const enemies = window.__galaga?.enemies ?? [];
      return (
        enemies.length > 0 && enemies.every((e) => e.state === "formation")
      );
    },
    null,
    { timeout: 15000 },
  );

  const before = await page.evaluate(() => ({
    stage: window.__galaga!.stage,
    score: window.__galaga!.score,
    // No tally is armed before the clear — the fields default to 0.
    tallyTicks: window.__galaga!.stageBonusTallyTicks,
  }));
  expect(before.stage).toBe(1);
  expect(before.tallyTicks).toBe(0);

  // Drive the clear in ONE evaluate so the rAF loop can't tick the tally
  // down between the final kill and our snapshot. After the last enemy is
  // removed, `forceHit` → `maybeAdvanceStage` runs SYNCHRONOUSLY: it commits
  // the bonus to `state.score`, arms the 6-frame hitstop, and arms the
  // 24-tick tally. We read the just-armed state in the same JS turn (before
  // any rAF), so `displayScore()` is still at the pre-bonus baseline — the
  // count-up hasn't advanced yet (the tally only counts down once the
  // hitstop releases on a later tick).
  const armed = await page.evaluate(async () => {
    // Mop up the whole formation. forceHit re-reads ids each pass because
    // the controller can re-emit not-yet-spawned roster members.
    for (let i = 0; i < 200; i++) {
      const enemies = window.__galaga?.enemies ?? [];
      if (enemies.length === 0) break;
      window.__galagaInternals!.forceHit({
        target: "enemy",
        enemyId: enemies[0].id,
      });
      // Yield only when enemies remain — if the roster emptied (tally armed),
      // we want the synchronous post-arm snapshot below, NOT a ticked-down one.
      if ((window.__galaga?.enemies ?? []).length > 0) {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
    }
    const s = window.__galaga!;
    return {
      score: s.score,
      scoreBeforeBonus: s.scoreBeforeBonus,
      tallyTotal: s.stageBonusTallyTotal,
      tallyTicks: s.stageBonusTallyTicks,
      hitstopTicks: s.feedback.hitstopTicks,
      stage: s.stage,
      displayScore: window.__galagaInternals!.displayScore(),
    };
  });

  // The bonus committed ATOMICALLY at clear (#65 hit-miss bonus + the flat
  // STAGE_BONUS). The score is already final — the tally is display-only.
  expect(armed.tallyTotal).toBeGreaterThanOrEqual(STAGE_BONUS);
  expect(armed.score).toBe(armed.scoreBeforeBonus + armed.tallyTotal);
  // Stage incremented synchronously (the #65 test depends on this too).
  expect(armed.stage).toBe(before.stage + 1);
  // Tally + hitstop are armed.
  expect(armed.tallyTicks).toBeGreaterThan(0);
  expect(armed.hitstopTicks).toBeGreaterThan(0);
  // AC: at the moment of clear (and through the hitstop) the DISPLAY score is
  // still the pre-bonus baseline X — the digits haven't started ticking up.
  expect(armed.displayScore).toBe(armed.scoreBeforeBonus);

  const X = armed.scoreBeforeBonus;
  const finalScore = armed.score;

  // AC: hitstop hold — while the clear hitstop is still draining, the tally
  // counter does NOT count down, so the displayed score stays pinned at X.
  // Catch it mid-hitstop (hitstopTicks still > 0) and confirm the hold.
  const duringHitstop = await page.evaluate(() => {
    const s = window.__galaga!;
    return {
      hitstopTicks: s.feedback.hitstopTicks,
      tallyTicks: s.stageBonusTallyTicks,
      displayScore: window.__galagaInternals!.displayScore(),
    };
  });
  if (duringHitstop.hitstopTicks > 0) {
    // Still frozen by the hitstop → tally untouched, display held at X.
    expect(duringHitstop.tallyTicks).toBe(armed.tallyTicks);
    expect(duringHitstop.displayScore).toBe(X);
  }

  // AC: mid-tally — once the hitstop releases the count-up animates. Wait for
  // a frame where the displayed score is STRICTLY BETWEEN X and the final
  // total (monotonic linear lerp), proving the digits visibly tick up.
  await page.waitForFunction(
    ({ x, total }) => {
      const d = window.__galagaInternals!.displayScore();
      return d > x && d < total;
    },
    { x: X, total: finalScore },
    { timeout: 3000 },
  );

  // AC: post-tally — wait for the tally window to close. The displayed score
  // then equals the authoritative `state.score` (= X + total), and the next
  // stage's formation begins entering.
  await page.waitForFunction(
    () => (window.__galaga?.stageBonusTallyTicks ?? 1) === 0,
    null,
    { timeout: 3000 },
  );

  const post = await page.evaluate(() => ({
    score: window.__galaga!.score,
    displayScore: window.__galagaInternals!.displayScore(),
    tallyTicks: window.__galaga!.stageBonusTallyTicks,
    stage: window.__galaga!.stage,
  }));
  expect(post.tallyTicks).toBe(0);
  // Display has caught up to the committed total.
  expect(post.displayScore).toBe(finalScore);
  expect(post.score).toBe(finalScore);
  // Stage stayed advanced (it incremented at clear, not at tally end).
  expect(post.stage).toBe(before.stage + 1);

  // The next stage's formation spawns once the tally freeze releases — the
  // field was held during the count-up, now it breathes again.
  await page.waitForFunction(
    () => (window.__galaga?.enemies?.length ?? 0) > 0,
    null,
    { timeout: 15000 },
  );
  const stage2 = await page.evaluate(() => window.__galaga!.enemies.length);
  expect(stage2).toBeGreaterThan(0);
});

test("a normal stage clear at zero accuracy still counts up at least the flat STAGE_BONUS (#273)", async ({
  page,
}) => {
  // Even with no real shots fired (forceHit drives the kills, which DOES bump
  // the accuracy counters in lockstep → top-tier hit-miss bonus), the flat
  // STAGE_BONUS guarantees the tally always has something to count. This test
  // pins the floor: the animated delta is never less than STAGE_BONUS.
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(
    () => window.__galaga?.status === "playing",
    null,
    { timeout: 5000 },
  );
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
    { timeout: 15000 },
  );

  const armed = await page.evaluate(async () => {
    for (let i = 0; i < 200; i++) {
      const enemies = window.__galaga?.enemies ?? [];
      if (enemies.length === 0) break;
      window.__galagaInternals!.forceHit({
        target: "enemy",
        enemyId: enemies[0].id,
      });
      if ((window.__galaga?.enemies ?? []).length > 0) {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
    }
    return {
      tallyTotal: window.__galaga!.stageBonusTallyTotal,
      tallyTicks: window.__galaga!.stageBonusTallyTicks,
    };
  });

  expect(armed.tallyTicks).toBeGreaterThan(0);
  // The flat STAGE_BONUS is the guaranteed floor of the animated delta.
  expect(armed.tallyTotal).toBeGreaterThanOrEqual(STAGE_BONUS);
});
