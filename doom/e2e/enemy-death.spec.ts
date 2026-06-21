// Issue #78 — Enemy death + scoring. Locks in the death contract: a
// `forceHit` lethal enough to kill must (a) flip the targeted enemy to
// 'dead', (b) award exactly its archetype's SCORE_BY_KIND value, and (c)
// have the enemy CULLED from the roster — but only after the CORPSE BEAT
// (#194) elapses, not on the next tick.
//
// Issue #194 — Doom enemy DEATH amplification. The killing blow stacks
// HEAVY juice on top of #166's universal connect feedback: longer
// hitstop, a third (bigger) shake channel, a blood-spray particle burst
// distinct from the orange impact sparks, and a corpse hold + alpha
// fade that lets the body LAND before vanishing.
//
// THE CONTRACT IS STATE, NOT PIXELS — see doom/docs/ARCHITECTURE.md. We
// drive outcomes through `window.__doomInternals` and read `window.__doom`.

import { expect, test } from "@playwright/test";

import {
  BLOOD_DROP_COUNT,
  CORPSE_HOLD_TICKS,
  HITSTOP_TICKS_ON_HIT,
  KILL_HITSTOP_TICKS,
  KILL_SHAKE_TICKS,
  SCORE_BY_KIND,
} from "../src/game/types";
import type { DoomInternals, DoomState } from "../src/game/types";

declare global {
  interface Window {
    __doom?: DoomState;
    __doomInternals?: DoomInternals;
  }
}

test("forceHit kills the seeded imp: state flips to 'dead' AND score rises by exactly SCORE_BY_KIND.imp", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // The seeded first enemy is an imp (HP_BY_KIND.imp=30 < PLAYER_SHOT_DAMAGE=50)
  // so a single forceHit is lethal — exactly what the harness contract spec
  // promises in types.ts.
  const result = await page.evaluate(() => {
    const target = window.__doom!.enemies.find((e) => e.kind === "imp");
    if (!target) return { ok: false as const, why: "no imp seeded" };
    const id = target.id;
    const kind = target.kind;
    const scoreBefore = window.__doom!.score;
    window.__doomInternals!.forceHit({ enemyId: id });
    const after = window.__doom!.enemies.find((e) => e.id === id) ?? null;
    return {
      ok: true as const,
      id,
      kind,
      scoreBefore,
      scoreAfter: window.__doom!.score,
      stateAfter: after ? after.state : null,
      hpAfter: after ? after.hp : null,
      deathTicksAfter: after ? after.deathTicks ?? null : null,
    };
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.stateAfter).toBe("dead");
  expect(result.hpAfter).toBe(0);
  expect(result.scoreAfter - result.scoreBefore).toBe(SCORE_BY_KIND.imp);
  // #194 — the killing blow arms the corpse-beat counter at 0 so the
  // engine can hold the body for CORPSE_HOLD_TICKS before culling.
  expect(result.deathTicksAfter).toBe(0);
});

test("#194: lethal hit clamps hitstop UP to KILL_HITSTOP_TICKS (heavier than the connect-hit hitstop)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  const result = await page.evaluate(() => {
    const imp = window.__doom!.enemies.find((e) => e.kind === "imp");
    if (!imp) return { ok: false as const };
    window.__doomInternals!.forceHit({ enemyId: imp.id });
    return {
      ok: true as const,
      hitstop: window.__doom!.hitstopTicks,
      killShake: window.__doom!.killShakeTicks,
      bloodCount: window.__doom!.bloodDrops.length,
    };
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  // Hitstop must be at LEAST the kill value — applyHitJuice already
  // clamped to HITSTOP_TICKS_ON_HIT (2), then damageEnemy's kill branch
  // clamps UP to KILL_HITSTOP_TICKS (6). Math.max semantics → the final
  // value is the larger one.
  expect(result.hitstop).toBe(KILL_HITSTOP_TICKS);
  expect(KILL_HITSTOP_TICKS).toBeGreaterThan(HITSTOP_TICKS_ON_HIT);
  // Kill-shake fires on lethal only.
  expect(result.killShake).toBe(KILL_SHAKE_TICKS);
  // Blood spray fires on lethal only — 14 drops per BLOOD_DROP_COUNT.
  expect(result.bloodCount).toBe(BLOOD_DROP_COUNT);
});

test("#194: corpse HOLDS for CORPSE_HOLD_TICKS frames before the engine culls it", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  const result = await page.evaluate(
    (CORPSE_HOLD: number) => {
      const imp = window.__doom!.enemies.find((e) => e.kind === "imp");
      if (!imp) return { ok: false as const };
      const id = imp.id;
      window.__doomInternals!.forceHit({ enemyId: id });
      const presentBefore = window.__doom!.enemies.some((e) => e.id === id);
      // Pump one tick — the corpse should STILL be there (corpse hold).
      // Note: advance() respects hitstop — frozen ticks don't tick the
      // corpse counter. So we pump enough ticks to clear hitstop AND
      // cover the full corpse hold window. CORPSE_HOLD + KILL_HITSTOP
      // is a safe upper bound; we sample at one tick to prove the body
      // is still there, then at the upper bound to prove the cull fired.
      window.__doomInternals!.advance({ steps: 1 });
      const presentAfterOne = window.__doom!.enemies.some((e) => e.id === id);
      // Now pump well past the corpse hold (+ hitstop budget).
      window.__doomInternals!.advance({ steps: CORPSE_HOLD + 12 });
      const presentAfterBeat = window.__doom!.enemies.some(
        (e) => e.id === id,
      );
      return {
        ok: true as const,
        presentBefore,
        presentAfterOne,
        presentAfterBeat,
      };
    },
    CORPSE_HOLD_TICKS,
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  // Right after the kill the corpse is on the roster (was already true
  // pre-#194). One tick later it is STILL on the roster (the heavy
  // genre's "body lands" beat — #194 changed this from a 1-tick cull).
  expect(result.presentBefore).toBe(true);
  expect(result.presentAfterOne).toBe(true);
  // After the full corpse beat the engine has freed the model + rig
  // and pruned the entry.
  expect(result.presentAfterBeat).toBe(false);
});
