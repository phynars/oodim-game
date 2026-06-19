// Boss two-hit armor (#68). A boss Galaga survives its FIRST player-bullet
// hit: the hit flips the public `damaged` flag false→true, awards NO score,
// and leaves the boss in `__galaga.enemies` (so it keeps blocking
// stage-advance). The SECOND hit removes it and awards the kill score via
// `scoreFor` — 150 for a formation boss, 400 for a diving boss.
//
// This lives in its OWN spec file (not appended to galaga.spec.ts) on purpose:
// the shared spec is large and append-collisions there are how a prior
// autonomous attempt regressed neighboring tests. Playwright's testDir is
// `e2e`, so this *.spec.ts is auto-discovered alongside galaga.spec.ts.
//
// Determinism: every place where the rAF loop could race a score/roster read
// between two forceHit calls is collapsed into a SINGLE page.evaluate — the
// same pattern galaga.spec.ts uses for the per-state scoring + accuracy tests.

import { expect, test } from "@playwright/test";

import type { GalagaInternals, GameState } from "../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
    __galagaInternals?: GalagaInternals;
  }
}

/** Boot the game out of READY and wait for the WHOLE formation to settle.
 *  Waiting for every enemy to reach 'formation' guarantees a full roster
 *  (the top row is bosses), so we always have several bosses to target and
 *  the choreography can't race the assertion. */
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

test("a formation boss takes two hits: first damages (no score, stays), second kills (+150)", async ({
  page,
}) => {
  await bootToSettledFormation(page);

  // Drive both hits + all the reads inside ONE evaluate so the rAF loop can't
  // re-emit / move the roster between the damage hit and the kill hit.
  const result = await page.evaluate(() => {
    const boss = window.__galaga!.enemies.find((e) => e.kind === "boss");
    if (!boss) return { ok: false as const };
    // Make sure we're scoring the FORMATION value (150), not the diving one.
    boss.state = "formation";
    const bossId = boss.id;

    const scoreStart = window.__galaga!.score;

    // --- First hit: damages, no score, boss stays in the roster. ---
    window.__galagaInternals!.forceHit({ target: "enemy", enemyId: bossId });
    const afterDamage = window.__galaga!.enemies.find((e) => e.id === bossId);
    const damage = {
      stillPresent: Boolean(afterDamage),
      damaged: afterDamage?.damaged,
      scoreDelta: window.__galaga!.score - scoreStart,
    };

    // --- Second hit: kills, removes from the roster, awards the kill score. ---
    window.__galagaInternals!.forceHit({ target: "enemy", enemyId: bossId });
    const kill = {
      stillPresent: Boolean(
        window.__galaga!.enemies.find((e) => e.id === bossId),
      ),
      scoreDelta: window.__galaga!.score - scoreStart,
    };

    return { ok: true as const, damage, kill };
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  // First hit: boss STILL in the roster, flagged damaged, score UNCHANGED.
  expect(result.damage.stillPresent).toBe(true);
  expect(result.damage.damaged).toBe(true);
  expect(result.damage.scoreDelta).toBe(0);

  // Second hit: boss removed, score up by the formation kill value (150).
  expect(result.kill.stillPresent).toBe(false);
  expect(result.kill.scoreDelta).toBe(150);
});

test("a diving boss takes two hits: second kill awards the diving value (+400)", async ({
  page,
}) => {
  await bootToSettledFormation(page);

  const result = await page.evaluate(() => {
    const boss = window.__galaga!.enemies.find((e) => e.kind === "boss");
    if (!boss) return { ok: false as const };
    // Score the DIVING value (400) on the kill — killEnemy reads e.state off
    // this same snapshot object, so mutating it here is enough.
    boss.state = "diving";
    const bossId = boss.id;
    const scoreStart = window.__galaga!.score;

    // First hit damages (no score); keep it diving for the kill hit.
    window.__galagaInternals!.forceHit({ target: "enemy", enemyId: bossId });
    const damaged = window.__galaga!.enemies.find((e) => e.id === bossId);
    const afterDamageScore = window.__galaga!.score - scoreStart;
    // Re-assert the state in case any tick touched it (defensive — single
    // evaluate, so it shouldn't, but the kill must score the diving value).
    if (damaged) damaged.state = "diving";

    // Second hit kills + scores.
    window.__galagaInternals!.forceHit({ target: "enemy", enemyId: bossId });
    return {
      ok: true as const,
      damagedPresent: Boolean(damaged),
      damagedFlag: damaged?.damaged,
      afterDamageScore,
      killPresent: Boolean(
        window.__galaga!.enemies.find((e) => e.id === bossId),
      ),
      killScoreDelta: window.__galaga!.score - scoreStart,
    };
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.damagedPresent).toBe(true);
  expect(result.damagedFlag).toBe(true);
  expect(result.afterDamageScore).toBe(0);
  expect(result.killPresent).toBe(false);
  expect(result.killScoreDelta).toBe(400);
});

test("a non-boss enemy is unaffected: dies + scores on the first hit, never 'damaged'", async ({
  page,
}) => {
  await bootToSettledFormation(page);

  const result = await page.evaluate(() => {
    const nonBoss = window.__galaga!.enemies.find((e) => e.kind !== "boss");
    if (!nonBoss) return { ok: false as const };
    nonBoss.state = "formation";
    const id = nonBoss.id;
    const scoreStart = window.__galaga!.score;
    window.__galagaInternals!.forceHit({ target: "enemy", enemyId: id });
    return {
      ok: true as const,
      stillPresent: Boolean(window.__galaga!.enemies.find((e) => e.id === id)),
      scoreDelta: window.__galaga!.score - scoreStart,
    };
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  // One hit: gone from the roster and the score went up immediately.
  expect(result.stillPresent).toBe(false);
  expect(result.scoreDelta).toBeGreaterThan(0);
});
