// agar/server/reducer.spec.ts
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
// agar/server/reducer.ts:443 — the same offline reducer the convergence
// spec already trusts. No new harness primitives, no new CI workflows.
//
// CONTRACT
// --------
// Every test below starts SKIPPED with a clear reason string referencing
// the gating issue. As each balance issue lands, that PR unskips its test
// — that's how the gate closes. The PR description for #297/#298/#299
// must demonstrate locally that reverting the mechanic causes its
// corresponding test here to fail (polarity discipline, same shape as
// #276's red/green job, scaled down to unit-suite).
//
// Refs #303

import { describe, it, expect } from "vitest";
import { pureReplay, type InputIntent, type WorldState } from "./reducer";

const SEED = 1;

/**
 * Build a tape of N empty/no-op input intents — enough ticks for bot AI,
 * decay, and absorption to play out without any player command.
 *
 * The exact `InputIntent` shape is owned by reducer.ts; if a no-op intent
 * needs an explicit value, the unskipping PR adjusts this helper.
 */
function emptyTape(_n: number): readonly InputIntent[] {
  // Intentionally empty: pureReplay tolerates a zero-input tape and just
  // ticks the world forward via reducer-internal mechanics (bots, decay,
  // absorption). The unskipping PR may swap this for a per-mechanic tape.
  return [] as const;
}

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

describe("agar reducer mechanic assertions", () => {
  // ──────────────────────────────────────────────────────────────────
  // #297 — growth cap + mass decay
  // ──────────────────────────────────────────────────────────────────
  it.skip(
    "growth cap: continuously-eating cell plateaus, idle cell decays [unskip when #297 lands]",
    () => {
      // Tape designed to feed the player aggressively in the pre-#297
      // reducer (so without the cap, player mass would exceed the field).
      const tape = emptyTape(2000);
      const state: WorldState = pureReplay(SEED, tape);

      // The unskipping PR (which implements #297) imports the actual
      // MAX_MASS / decay constants from reducer.ts and asserts:
      //   1. state.player.mass <= MAX_MASS  (cap holds)
      //   2. a second pureReplay with the player isolated for K ticks
      //      shows strictly-decreasing mass (decay holds).
      expect(state).toBeDefined();
      throw new Error(
        "unskip in #297 PR — assert MAX_MASS cap + monotonic decay using the constants this PR introduces",
      );
    },
  );

  // ──────────────────────────────────────────────────────────────────
  // #298 — bot pursuit + flee
  // ──────────────────────────────────────────────────────────────────
  it.skip(
    "bot AI: bots pursue smaller cells and flee bigger ones [unskip when #298 lands]",
    () => {
      // Run the world forward with NO player input so only bot AI moves
      // the world. The #298 PR will pick a seed where the initial bot
      // configuration includes at least one smaller-than-player bot and
      // at least one larger-than-player bot.
      const K = 200;
      const start: WorldState = pureReplay(SEED, emptyTape(0));
      const end: WorldState = pureReplay(SEED, emptyTape(K));

      // Coarse monotonicity: over K ticks, distance(smaller_bot, player)
      // should DECREASE (pursuit) and distance(larger_bot, player) should
      // INCREASE (flee). The unskipping PR resolves the bot/player
      // accessors from the WorldState shape #298 ships.
      expect(start).toBeDefined();
      expect(end).toBeDefined();
      expect(distance).toBeDefined(); // silence unused-import lint pre-unskip
      throw new Error(
        "unskip in #298 PR — pick a seed with a smaller+larger bot, assert pursuit/flee distance trend over K ticks",
      );
    },
  );

  // ──────────────────────────────────────────────────────────────────
  // #299 — player death + respawn
  // ──────────────────────────────────────────────────────────────────
  it.skip(
    "death + respawn: player absorbed by larger cell resets to start mass at a new position [unskip when #299 lands]",
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
      throw new Error(
        "unskip in #299 PR — assert mass reset to START_MASS and position changed across the absorption tick",
      );
    },
  );
});
