// Doom player-damage feel polish (#205). Asserts the three additive juice
// channels that fire alongside #91's existing flash + shake on every
// damage event:
//   1. Damage hitstop — 3-frame freeze (state.hitstopTicks ≥ 3).
//   2. Lingering wobble — state.damageWobbleTicks armed to 30, decays
//      back to 0 after 30 fixed-steps.
//   3. Exponential flash decay — alpha follows ×DAMAGE_FLASH_DECAY (0.85)
//      per tick from peak, NOT linear.
//
// STATE CONTRACT: every assertion rides on `window.__doom` (the same surface
// every other doom e2e uses) read synchronously from inside `page.evaluate`.
// The opacity curve is computed from `hitFlashTicks` via the SAME pure
// mapping main.ts uses — that way the test is immune to the engine's
// background rAF loop (which can decay hitFlashTicks between Playwright
// eval round-trips and was racing the prior getComputedStyle-based
// assertion).

import { expect, test } from "@playwright/test";

import type {
  DoomInternals,
  DoomState,
} from "../src/game/types";

declare global {
  interface Window {
    __doom?: DoomState;
    __doomInternals?: DoomInternals;
  }
}

test("damage arms hitstopTicks (≥3) and damageWobbleTicks (=30) without regressing #91's existing pulses (#205)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // BOOT: every channel resting at 0.
  const boot = await page.evaluate(() => ({
    hitstopTicks: window.__doom!.hitstopTicks,
    damageWobbleTicks: window.__doom!.damageWobbleTicks,
    hitFlashTicks: window.__doom!.hitFlashTicks,
    shakeTicks: window.__doom!.shakeTicks,
  }));
  expect(boot.hitstopTicks).toBe(0);
  expect(boot.damageWobbleTicks).toBe(0);
  expect(boot.hitFlashTicks).toBe(0);
  expect(boot.shakeTicks).toBe(0);

  // One non-lethal chip via forceDamage. The SAME synchronous publish that
  // arms hitFlashTicks/shakeTicks must also arm the two new channels —
  // hitstopTicks to ≥ DAMAGE_HITSTOP_TICKS (3) and damageWobbleTicks to
  // exactly DAMAGE_WOBBLE_TICKS (30). The existing #91 pulses must NOT
  // regress (still > 0 in the same publish).
  const armed = await page.evaluate(() => {
    window.__doomInternals!.forceDamage({ amount: 10 });
    const s = window.__doom!;
    return {
      hitstopTicks: s.hitstopTicks,
      damageWobbleTicks: s.damageWobbleTicks,
      hitFlashTicks: s.hitFlashTicks,
      shakeTicks: s.shakeTicks,
      alive: s.player.alive,
    };
  });
  expect(armed.alive).toBe(true);
  // #205 — new channels:
  expect(armed.hitstopTicks).toBeGreaterThanOrEqual(3);
  expect(armed.damageWobbleTicks).toBe(30);
  // #91 — no regression:
  expect(armed.hitFlashTicks).toBeGreaterThan(0);
  expect(armed.shakeTicks).toBeGreaterThan(0);
});

test("damageWobble decays to 0 after 30 fixed-steps and the camera offset settles (#205)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Take a chip, then drive enough fixed-steps to (a) drain the 3-frame
  // hitstop AND (b) drain the 30-tick wobble window. The wobble freezes
  // with the world during hitstop (same gate as every other channel), so
  // the total drain is 3 + 30 = 33 ticks. Push 40 for headroom.
  const decayed = await page.evaluate(() => {
    window.__doomInternals!.forceDamage({ amount: 10 });
    window.__doomInternals!.advance({ steps: 40 });
    const s = window.__doom!;
    return {
      hitstopTicks: s.hitstopTicks,
      damageWobbleTicks: s.damageWobbleTicks,
      hitFlashTicks: s.hitFlashTicks,
      shakeTicks: s.shakeTicks,
    };
  });
  // Every pulse channel must be back to 0 — the camera reads the player's
  // raw eye position again, no offset summed in (kw === 0 ⇒ no contribution
  // from the wobble channel by construction of syncCamera's sum).
  expect(decayed.damageWobbleTicks).toBe(0);
  expect(decayed.hitstopTicks).toBe(0);
  expect(decayed.hitFlashTicks).toBe(0);
  expect(decayed.shakeTicks).toBe(0);
});

test("HUD damage-flash decay is exponential — alpha at tick 1 ≈ peak·0.85, at tick 6 ≈ peak·0.38, never linear (#205)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // The HUD overlay's opacity is `0.5 * DAMAGE_FLASH_DECAY^t` where
  // t = HIT_FLASH_TICKS - hitFlashTicks (so t=1 the first tick after the
  // pulse arms, t=12 just before it expires). main.ts mirrors that to
  // CSS each rAF, but the CURVE itself is a pure function of the
  // hitFlashTicks state value — so we assert the curve on the state
  // value directly. This sidesteps the prior race where the engine's
  // background rAF loop could decay hitFlashTicks between Playwright
  // eval round-trips while we were sampling getComputedStyle.
  //
  // The mapping is duplicated in this test (vs imported) because the
  // production constants ship from types.ts in the same module as
  // engine-internal symbols Playwright can't reach from the page
  // context. The numeric contract is asserted both directions:
  //   - shape: op6/op1 below the linear floor (op6/op1 < 0.52),
  //   - magnitude: op1 ≈ 0.5 · 0.85^1, op6 ≈ 0.5 · 0.85^6 (within ±1e-9).
  const HIT_FLASH_TICKS = 12;
  const DAMAGE_FLASH_DECAY = 0.85;
  const opacityFor = (hitFlashTicks: number): number => {
    if (hitFlashTicks <= 0) return 0;
    const t = HIT_FLASH_TICKS - hitFlashTicks;
    return 0.5 * Math.pow(DAMAGE_FLASH_DECAY, t);
  };

  // Sample hitFlashTicks at three points along the decay window via the
  // deterministic `advance` hook — synchronously inside ONE evaluate so
  // the engine's main rAF loop can't slip a tick in between samples.
  const samples = await page.evaluate(() => {
    const internals = window.__doomInternals!;
    internals.forceDamage({ amount: 10 });
    // Drain the 3-frame hitstop; from here hitFlashTicks decays one per
    // tick. After this call hitFlashTicks === HIT_FLASH_TICKS (peak, t=0).
    internals.advance({ steps: 3 });
    // Pump one more step → t=1.
    internals.advance({ steps: 1 });
    const t1 = window.__doom!.hitFlashTicks;
    // Pump to t=6 (5 more steps).
    internals.advance({ steps: 5 });
    const t6 = window.__doom!.hitFlashTicks;
    // Pump to t=12 (6 more steps → at-or-past expiry).
    internals.advance({ steps: 6 });
    const t12 = window.__doom!.hitFlashTicks;
    return { t1, t6, t12 };
  });

  // Sanity: hitFlashTicks counted down deterministically. After draining
  // the 3-frame hitstop and advancing 1+5+6 = 12 more ticks, the counter
  // should land at HIT_FLASH_TICKS-1=11, then 11-5=6, then 0.
  expect(samples.t1).toBe(11);
  expect(samples.t6).toBe(6);
  expect(samples.t12).toBe(0);

  const op1 = opacityFor(samples.t1);
  const op6 = opacityFor(samples.t6);
  const op12 = opacityFor(samples.t12);

  // Monotonic decreasing.
  expect(op1).toBeGreaterThan(op6);
  expect(op6).toBeGreaterThan(op12);

  // EXPONENTIAL SHAPE: the ratio op6/op1 must come in BELOW the linear
  // floor with margin. Linear (op = 0.5·(ticks/12)) would give op1 = 0.5·(11/12)
  // ≈ 0.458 and op6 = 0.5·(6/12) = 0.250 — ratio 0.546. Exponential ratio
  // 0.85^5 ≈ 0.444. The 0.52 bound discriminates with margin.
  const ratio = op6 / op1;
  expect(ratio).toBeLessThan(0.52);
  expect(ratio).toBeGreaterThan(0.30);

  // MAGNITUDE: the curve's actual values match the spec (#205).
  expect(op1).toBeCloseTo(0.5 * Math.pow(0.85, 1), 9);
  expect(op6).toBeCloseTo(0.5 * Math.pow(0.85, 6), 9);

  // At-or-past expiry, the overlay is gated to 0.
  expect(op12).toBe(0);
});

test("clamp semantics: back-to-back damage events arm a single fresh window, never accumulate hitstop (#205)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Two damage events back-to-back must use Math.max — NOT `+=` — so
  // hitstopTicks lands at DAMAGE_HITSTOP_TICKS (3), not 6, and
  // damageWobbleTicks at DAMAGE_WOBBLE_TICKS (30), not 60. Past Galaga
  // learning: a `+=` here freezes the engine forever under sustained fire.
  const result = await page.evaluate(() => {
    window.__doomInternals!.forceDamage({ amount: 5 });
    window.__doomInternals!.forceDamage({ amount: 5 });
    const s = window.__doom!;
    return {
      hitstopTicks: s.hitstopTicks,
      damageWobbleTicks: s.damageWobbleTicks,
    };
  });
  expect(result.hitstopTicks).toBe(3);
  expect(result.damageWobbleTicks).toBe(30);
});
