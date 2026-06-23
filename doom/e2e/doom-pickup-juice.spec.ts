// Doom pickup feel (#230). Asserts the affirmative beat that lands every
// time `applyPickup()` grants a pickup: the vignette flash + per-kind tint
// cue + stat scale-pop, expressed on the state contract as two new fields:
//   - `pickupFlashTicks`: number, clobbered to PICKUP_FLASH_TICKS on arm,
//     decays one per fixed-step in the same `!frozen` block every other
//     channel uses.
//   - `pickupKindFlash`: 'health'|'armor'|'ammo'|null, the kind cue. Set
//     in lockstep with the counter; null whenever pickupFlashTicks===0.
//
// STATE CONTRACT: every assertion rides on `window.__doom`, read
// synchronously inside `page.evaluate` so the engine's background rAF loop
// can't slip a tick between Playwright eval round-trips (the same race
// pattern doom-damage-juice.spec.ts dodges).
//
// CLOBBER semantics — NOT Math.max — are load-bearing here: a second
// pickup grant DURING a live flash must switch the kind cue, otherwise
// the vignette would lie about the new grant (eg. green stays even though
// the player just grabbed armor). The clamp pattern that's correct for
// anonymous magnitude channels (shake/hitstop) is WRONG for single-channel
// identity cues. This spec proves the engine clobbers.

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

test("forcePickup() arms pickupFlashTicks AND pickupKindFlash in the SAME synchronous publish (#230)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // BOOT: both pickup channels resting.
  const boot = await page.evaluate(() => ({
    pickupFlashTicks: window.__doom!.pickupFlashTicks,
    pickupKindFlash: window.__doom!.pickupKindFlash,
  }));
  expect(boot.pickupFlashTicks).toBe(0);
  expect(boot.pickupKindFlash).toBeNull();

  // Force the first un-taken pickup (the scaffold seeds 'health' first; see
  // SEED_PICKUPS in engine.ts). The forcePickup hook publishes synchronously
  // AFTER applyPickup() runs the new arm; the same publish must carry both
  // fields, so a single read of __doom sees the armed state.
  const armed = await page.evaluate(() => {
    const target = window.__doom!.pickups.find((p) => !p.taken)!;
    window.__doomInternals!.forcePickup({ id: target.id });
    const s = window.__doom!;
    return {
      kind: target.kind,
      pickupFlashTicks: s.pickupFlashTicks,
      pickupKindFlash: s.pickupKindFlash,
      pickupMessage: s.pickupMessage,
      pickupMessageTicks: s.pickupMessageTicks,
      taken: s.pickups.find((p) => p.id === target.id)!.taken,
    };
  });

  // Pickup was actually applied (#80 acceptance — no regression).
  expect(armed.taken).toBe(true);
  // #230 — both fields armed in the same publish.
  expect(armed.pickupFlashTicks).toBe(24); // PICKUP_FLASH_TICKS
  expect(armed.pickupKindFlash).toBe(armed.kind);
  // #281 — message + counter armed in the SAME synchronous publish as the
  // flash. First seeded pickup is 'health' → "Patched up." (locked copy).
  expect(armed.pickupMessage).toBe("Patched up.");
  expect(armed.pickupMessageTicks).toBe(24);
});

test("pickupFlashTicks decays to 0 within PICKUP_FLASH_TICKS+1 ticks and pickupKindFlash clears to null (#230)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Arm via forcePickup, then drive the fixed-step sim forward PICKUP_FLASH_TICKS
  // steps via the synchronous advance hook (rAF + wall-clock free). The
  // pickup channel does NOT arm hitstop (gift, not punch), so the decay
  // proceeds one-per-tick from the very next update().
  const decayed = await page.evaluate(() => {
    const target = window.__doom!.pickups.find((p) => !p.taken)!;
    window.__doomInternals!.forcePickup({ id: target.id });
    // advance() will flip status ready→playing internally if needed; the
    // pickup arm above sets the contract fields independent of status.
    window.__doomInternals!.advance({
      steps: 25, // PICKUP_FLASH_TICKS (24) + 1 for headroom
      forward: false,
      back: false,
      left: false,
      right: false,
    });
    const s = window.__doom!;
    return {
      pickupFlashTicks: s.pickupFlashTicks,
      pickupKindFlash: s.pickupKindFlash,
      pickupMessage: s.pickupMessage,
      pickupMessageTicks: s.pickupMessageTicks,
    };
  });
  expect(decayed.pickupFlashTicks).toBe(0);
  expect(decayed.pickupKindFlash).toBeNull();
  // #281 — message decays in the same `!frozen` block, clears to null
  // when its counter hits 0 (mirrors the kind cue's contract at L65/L73).
  expect(decayed.pickupMessageTicks).toBe(0);
  expect(decayed.pickupMessage).toBeNull();
});

test("clobber semantics: a second pickup mid-flash REPLACES the kind cue (NOT Math.max) (#230)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Grab two pickups of DIFFERENT kinds back-to-back. The first arms the
  // green vignette; the second must REPLACE both the counter (re-armed to
  // PICKUP_FLASH_TICKS, not Math.max which would no-op on a same-tick
  // re-arm anyway, but specifically NOT stale) AND the kind cue (which
  // must now read the SECOND pickup's kind, not the first's).
  //
  // The scaffold seeds three pickups in order: health, armor, ammo (see
  // SEED_PICKUPS in engine.ts). Grab the health one first, then the armor
  // one — both un-taken at boot, both ids stable.
  const result = await page.evaluate(() => {
    const pickups = window.__doom!.pickups;
    const health = pickups.find((p) => p.kind === "health")!;
    const armor = pickups.find((p) => p.kind === "armor")!;
    window.__doomInternals!.forcePickup({ id: health.id });
    const afterFirst = {
      ticks: window.__doom!.pickupFlashTicks,
      kind: window.__doom!.pickupKindFlash,
      message: window.__doom!.pickupMessage,
      messageTicks: window.__doom!.pickupMessageTicks,
    };
    // Second pickup BEFORE the first's flash decays — clobber path.
    window.__doomInternals!.forcePickup({ id: armor.id });
    const afterSecond = {
      ticks: window.__doom!.pickupFlashTicks,
      kind: window.__doom!.pickupKindFlash,
      message: window.__doom!.pickupMessage,
      messageTicks: window.__doom!.pickupMessageTicks,
    };
    return { afterFirst, afterSecond };
  });
  expect(result.afterFirst.kind).toBe("health");
  expect(result.afterFirst.ticks).toBe(24);
  expect(result.afterFirst.message).toBe("Patched up.");
  expect(result.afterFirst.messageTicks).toBe(24);
  // Clobbered: kind switched, counter re-armed to the full window.
  expect(result.afterSecond.kind).toBe("armor");
  expect(result.afterSecond.ticks).toBe(24);
  // #281 — message CLOBBERS too (NOT Math.max). The armor line must
  // replace the stale health line; otherwise the HUD would lie about
  // the new grant — same posture as pickupKindFlash.
  expect(result.afterSecond.message).toBe("Plate. Strap it on.");
  expect(result.afterSecond.messageTicks).toBe(24);
});

test("pickupFlashTicks does NOT decay while hitstop is frozen (same gate as every other channel) (#230)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Arm the pickup flash, then arm hitstop via forceDamage (3-frame damage
  // hitstop, #205) on the SAME tick. The pickup decay lives in the
  // `!frozen` block; during the 3-frame freeze it must hold, then resume.
  // Drive exactly 3 ticks (the hitstop duration) — the pickup counter
  // should still read PICKUP_FLASH_TICKS, because no `!frozen` step has
  // run yet.
  const sample = await page.evaluate(() => {
    const target = window.__doom!.pickups.find((p) => !p.taken)!;
    window.__doomInternals!.forcePickup({ id: target.id });
    // Damage AFTER pickup so its 3-frame hitstop freezes the world for
    // the pickup decay window's first 3 ticks. forceDamage arms
    // hitstopTicks via the Math.max clamp path; pickup never adds to
    // hitstop itself.
    window.__doomInternals!.forceDamage({ amount: 5 });
    // Drive 3 fixed-steps. update()'s hitstop gate decrements
    // hitstopTicks from 3→0 and short-circuits the `!frozen` block for
    // all 3 frames, so pickupFlashTicks should NOT have moved.
    window.__doomInternals!.advance({
      steps: 3,
      forward: false,
      back: false,
      left: false,
      right: false,
    });
    return {
      pickupFlashTicks: window.__doom!.pickupFlashTicks,
      pickupKindFlash: window.__doom!.pickupKindFlash,
      pickupMessage: window.__doom!.pickupMessage,
      pickupMessageTicks: window.__doom!.pickupMessageTicks,
      hitstopTicks: window.__doom!.hitstopTicks,
    };
  });
  // Hitstop has drained (3 frozen frames consumed it).
  expect(sample.hitstopTicks).toBe(0);
  // Pickup counter held at peak because every tick was frozen.
  expect(sample.pickupFlashTicks).toBe(24);
  expect(sample.pickupKindFlash).toBe("health");
  // #281 — message holds too. Same `!frozen` gate; the line hangs with
  // the rest of the world during the kill/damage hitstop.
  expect(sample.pickupMessageTicks).toBe(24);
  expect(sample.pickupMessage).toBe("Patched up.");
});
