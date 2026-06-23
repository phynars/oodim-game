// agar/e2e/reducer.spec.ts
//
// Mechanic-assertion harness for the agar reducer.
//
// WHY THIS FILE EXISTS
// --------------------
// The two-client convergence spec (`agar/e2e/multiplayer-convergence.spec.ts`)
// proves DETERMINISM: clientA.canonical === clientB.canonical when both fold
// the same appliedLog. It does NOT prove MECHANIC CORRECTNESS. A reducer
// that no-ops the growth cap, a bot AI that just wanders, a death handler
// that freezes the player in place — all three still produce identical
// canonical state across clients. They pass convergence. The mechanic is
// silently broken.
//
// This file closes that gap for the balance chain (#297/#298/#299) using
// the existing `pureReplay(seed, tape): WorldState` export at
// agar/server/reducer.ts — the same offline reducer the convergence
// spec already trusts. No new harness primitives, no new CI workflows.
//
// LANE
// ----
// This spec runs in agar's existing Playwright lane (the same one that
// runs `tick.spec.ts`). It uses `@playwright/test` — the only test
// runner shipped in this repo — and it does NOT touch `page`, so it
// completes in milliseconds and adds negligible cost to the lane. The
// Playwright webServers still boot, but that's fixed overhead the lane
// already pays for tick.spec / multiplayer-convergence.spec.
//
// CONTRACT
// --------
// Every test below starts SKIPPED with a clear reason string referencing
// the gating issue. As each balance issue lands, that PR unskips its
// test — that's how the gate closes. The PR description for #297/#298/
// #299 must demonstrate locally that reverting the mechanic causes its
// corresponding test here to fail (polarity discipline, same shape as
// #276's red/green job, scaled down to unit-suite).
//
// POLARITY GUARD
// --------------
// Each skipped body ends in `expect(…).toBe("unskip-and-rewrite-…")`.
// If a future PR flips `test.skip` → `test` WITHOUT rewriting the body,
// the assertion fails red — exactly the signal we want. An empty
// passing body on unskip would be a silent regression.
//
// Refs #303

import { test, expect } from "@playwright/test";
import {
  pureReplay,
  type InputIntent,
  type WorldState,
} from "../server/reducer";

const SEED = 1;

/**
 * Build a tape of N empty/no-op input intents — enough ticks for bot AI,
 * decay, and absorption to play out without any player command.
 *
 * The exact `InputIntent` shape is owned by reducer.ts; if a no-op
 * intent needs an explicit value, the unskipping PR adjusts this helper.
 */
function emptyTape(_n: number): readonly InputIntent[] {
  // Intentionally empty: pureReplay tolerates a zero-input tape and just
  // ticks the world forward via reducer-internal mechanics (bots, decay,
  // absorption). The unskipping PR may swap this for a per-mechanic tape.
  return [] as const;
}

// ────────────────────────────────────────────────────────────────────
// #297 — growth cap + mass decay
// ────────────────────────────────────────────────────────────────────
test.skip(
  "agar reducer: growth cap — eating cell plateaus, idle cell decays [unskip when #297 lands]",
  () => {
    // Tape designed to feed the player aggressively in the pre-#297
    // reducer (so without the cap, player mass would exceed the field).
    const tape = emptyTape(2000);
    const state: WorldState = pureReplay(SEED, tape);
    expect(state).toBeDefined();

    // The unskipping PR (which implements #297) imports the actual
    // MAX_MASS / decay constants from reducer.ts and asserts:
    //   1. state.player.mass <= MAX_MASS  (cap holds)
    //   2. a second pureReplay with the player isolated for K ticks
    //      shows strictly-decreasing mass (decay holds).
    //
    // Polarity guard: this fails on unskip until the body is rewritten.
    expect("placeholder").toBe(
      "unskip-and-rewrite-#297-with-MAX_MASS-and-decay-assertions",
    );
  },
);

// ────────────────────────────────────────────────────────────────────
// #298 — bot pursuit + flee
// ────────────────────────────────────────────────────────────────────
test.skip(
  "agar reducer: bot AI — bots pursue smaller cells and flee bigger ones [unskip when #298 lands]",
  () => {
    // Run the world forward with NO player input so only bot AI moves
    // the world. The #298 PR will pick a seed where the initial bot
    // configuration includes at least one smaller-than-player bot and
    // at least one larger-than-player bot.
    const K = 200;
    const start: WorldState = pureReplay(SEED, emptyTape(0));
    const end: WorldState = pureReplay(SEED, emptyTape(K));
    expect(start).toBeDefined();
    expect(end).toBeDefined();

    // Coarse monotonicity: over K ticks, distance(smaller_bot, player)
    // should DECREASE (pursuit) and distance(larger_bot, player) should
    // INCREASE (flee). The unskipping PR resolves the bot/player
    // accessors from the WorldState shape #298 ships.
    //
    // Polarity guard: this fails on unskip until the body is rewritten.
    expect("placeholder").toBe(
      "unskip-and-rewrite-#298-with-pursuit-and-flee-distance-trends",
    );
  },
);

// ────────────────────────────────────────────────────────────────────
// #299 — player death + respawn
// ────────────────────────────────────────────────────────────────────
test.skip(
  "agar reducer: death + respawn — absorbed player resets mass + position [unskip when #299 lands]",
  () => {
    // The #299 PR picks a seed + tape where a larger bot absorbs the
    // player at a known tick T. Three assertions:
    //   1. state at tick T-1: player.mass is the accumulated (large) mass
    //   2. state at tick T+1: player.mass === START_MASS (genuine reset)
    //   3. state at tick T+1: player.position !== state at T-1's position
    //      (genuine respawn, not freeze-in-place)
    const stateBefore: WorldState = pureReplay(SEED, emptyTape(50));
    const stateAfter: WorldState = pureReplay(SEED, emptyTape(60));
    expect(stateBefore).toBeDefined();
    expect(stateAfter).toBeDefined();

    // Polarity guard: this fails on unskip until the body is rewritten.
    expect("placeholder").toBe(
      "unskip-and-rewrite-#299-with-mass-reset-and-position-change-assertions",
    );
  },
);
