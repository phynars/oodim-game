// Issue #78 — Enemy death + scoring. Locks in the FULL death contract beyond
// the broader scaffold test in doom.spec.ts: a `forceHit` lethal enough to kill
// must (a) flip the targeted enemy to 'dead', (b) award exactly its
// archetype's SCORE_BY_KIND value, and (c) have the enemy CULLED from the
// roster after one fixed-step tick. The roster cull is the load-bearing
// "removed" half of the issue's acceptance — the existing spec only sampled
// inside the same synchronous publish as forceHit, so it never observed the
// removal. This file asserts both halves.
//
// THE CONTRACT IS STATE, NOT PIXELS — see doom/docs/ARCHITECTURE.md. We drive
// outcomes through `window.__doomInternals` and read `window.__doom`.

import { expect, test } from "@playwright/test";

import { SCORE_BY_KIND } from "../src/game/types";
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
    // Sample WITHIN the same evaluate, while the enemy is still on the roster
    // (the cull runs on the next fixed-step tick — see the next test).
    const after = window.__doom!.enemies.find((e) => e.id === id) ?? null;
    return {
      ok: true as const,
      id,
      kind,
      scoreBefore,
      scoreAfter: window.__doom!.score,
      stateAfter: after ? after.state : null,
      hpAfter: after ? after.hp : null,
    };
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  // Death contract: lethal hit → state 'dead' + hp clamped at 0.
  expect(result.stateAfter).toBe("dead");
  expect(result.hpAfter).toBe(0);
  // Scoring contract: exactly the imp's point value, not more, not less.
  expect(result.scoreAfter - result.scoreBefore).toBe(SCORE_BY_KIND.imp);
});

test("a killed enemy is REMOVED from the roster after one fixed-step tick", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  const result = await page.evaluate(() => {
    const imp = window.__doom!.enemies.find((e) => e.kind === "imp");
    if (!imp) return { ok: false as const, why: "no imp seeded" };
    const id = imp.id;
    // Kill it.
    window.__doomInternals!.forceHit({ enemyId: id });
    const presentBefore = window.__doom!.enemies.some((e) => e.id === id);
    // Pump exactly one fixed-step — the cull runs at the end of update().
    // No movement keys; the dead enemy is the only target of the cull.
    window.__doomInternals!.advance({ steps: 1 });
    const presentAfter = window.__doom!.enemies.some((e) => e.id === id);
    return { ok: true as const, presentBefore, presentAfter };
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  // Right after the kill, the dead entry is still on the roster (so consumers
  // can observe the transition). One tick later, it's gone.
  expect(result.presentBefore).toBe(true);
  expect(result.presentAfter).toBe(false);
});
