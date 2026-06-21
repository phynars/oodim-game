// Doom player-damage feel polish (#205). Asserts the three additive juice
// channels that fire alongside #91's existing flash + shake on every
// damage event:
//   1. Damage hitstop — 3-frame freeze (state.hitstopTicks ≥ 3).
//   2. Lingering wobble — state.damageWobbleTicks armed to 30, decays
//      back to 0 after 30 fixed-steps.
//   3. Exponential flash decay — the HUD overlay's opacity follows
//      ×DAMAGE_FLASH_DECAY (0.85) per tick from peak, NOT linear.
//
// STATE CONTRACT: assertions ride on `window.__doom` (the same surface every
// other doom e2e uses) plus a single computed-style read for the overlay's
// opacity curve. No pixel reads.

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

  // The overlay's opacity is the consumer of the curve change. main.ts
  // reads __doom.hitFlashTicks each rAF and writes `opacity = 0.5 *
  // 0.85^t` where t = HIT_FLASH_TICKS - hitFlashTicks (so t=1 the first
  // tick after the pulse arms, t=12 just before it expires). We force a
  // chip, then sample the opacity AT KNOWN TICK COUNTS by driving the
  // engine forward with `advance` and reading the HUD overlay's
  // getComputedStyle.opacity each step.
  //
  // The acceptance criterion is the SHAPE of the curve, not the exact
  // constant — assert the ratio between successive samples matches the
  // exponential, NOT the constant ramp a linear fade would give.
  const overlay = page.locator('[data-overlay="hit-flash"]');
  await expect(overlay).toHaveCount(1);

  // Sample opacity at three points along the decay window. We pump
  // fixed-steps via the deterministic `advance` hook so the assertion is
  // wall-clock-independent (under headless SwiftShader rAF cadence
  // varies). The HUD ticks every rAF, so after `advance(steps)` we
  // additionally wait for the rAF mirror to update the DOM.
  const readOpacity = async (): Promise<number> => {
    // The HUD writes opacity on the next rAF after state changes — wait
    // for that publish before reading. We assert the cell value is a
    // number string (the writer always sets a numeric string).
    const op = await page.evaluate(async () => {
      // Spin one rAF so main.ts's tickHud has a chance to mirror.
      await new Promise<void>((res) => requestAnimationFrame(() => res()));
      const el = document.querySelector<HTMLElement>(
        '[data-overlay="hit-flash"]',
      );
      return el ? parseFloat(getComputedStyle(el).opacity) : NaN;
    });
    return op;
  };

  // Arm the pulse and immediately advance ONE tick so we land on t=1 of
  // the curve. The hitstop gate freezes update() for the first 3 ticks
  // post-arm, so the hitFlashTicks counter doesn't decrement until the
  // hitstop has drained. We push past the hitstop, then sample.
  await page.evaluate(() => window.__doomInternals!.forceDamage({ amount: 10 }));
  // Drain the 3-frame hitstop; from here hitFlashTicks decays one per tick.
  await page.evaluate(() => window.__doomInternals!.advance({ steps: 3 }));
  // Now hitFlashTicks === HIT_FLASH_TICKS (peak, t=0). Pump one more
  // step → t=1.
  await page.evaluate(() => window.__doomInternals!.advance({ steps: 1 }));
  const op1 = await readOpacity();
  // Pump to t=6 (5 more steps).
  await page.evaluate(() => window.__doomInternals!.advance({ steps: 5 }));
  const op6 = await readOpacity();
  // Pump to t=12 (6 more steps → at-or-past expiry).
  await page.evaluate(() => window.__doomInternals!.advance({ steps: 6 }));
  const op12 = await readOpacity();

  // Sanity: opacity is monotonically decreasing across the three samples.
  expect(op1).toBeGreaterThan(op6);
  expect(op6).toBeGreaterThan(op12);

  // EXPONENTIAL SHAPE: the ratio op6/op1 should match 0.85^5 ≈ 0.444,
  // NOT what a linear fade would give. Linear (op = 0.5·(ticks/12)) would
  // produce op1 = 0.5·(11/12) ≈ 0.458 and op6 = 0.5·(6/12) = 0.250 — ratio
  // 0.546. Exponential ratio 0.85^5 ≈ 0.444. Allow a wide tolerance (±0.10)
  // for sampling jitter and the HUD's rAF cadence, but the exponential
  // value sits below the linear value by enough to discriminate.
  const ratio = op6 / op1;
  // Strict upper bound on the linear floor: any linear-decay curve over
  // 12 ticks gives op6/op1 >= 6/11 ≈ 0.545. Exponential MUST come in
  // below that, with margin.
  expect(ratio).toBeLessThan(0.52);
  // Loose lower bound — ratio shouldn't be near 0 (which would mean
  // off/binary, not a curve).
  expect(ratio).toBeGreaterThan(0.30);

  // After the window fully drains the overlay must be at 0 opacity (a
  // smaller test of the same curve hitting the floor).
  expect(op12).toBeLessThan(0.05);
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
