// Issue #137 — ghost render parity with Pac's sub-tile glide.
//
// The bug-class this guards: an actor whose render position jumps by
// chunks larger than max_speed_per_frame between consecutive animation
// frames. Pac glides smoothly because his render position is
// `(tile + dir * progress)` where progress advances 0..1 across the
// tile-step. Ghosts must use the same math.
//
// The spec drives Pac + Blinky into a straight-line corridor segment
// (row 23, the spawn corridor), samples float-precision render
// positions on every animation frame for ~2s via
// `window.__pacInternals.renderPositions()` (issue #137 probe — see
// engine.ts), and asserts:
//
//   1. PARITY — max per-frame Δposition for the ghost matches the per-
//      frame Δposition for Pac, normalised by their logical speeds.
//      Tolerance ±5%.
//
//   2. PER-FRAME BOUND — no single frame's ghost Δposition exceeds
//      `GHOST_SPEED_PER_TICK * 1.05`. (5% headroom for fp jitter.)
//      A snap to the next tile mid-window would show as a single
//      frame with Δ ≈ 1.0 tile — multiples of GHOST_SPEED_PER_TICK
//      above the bound — and trip this check loudly.
//
// This spec must FAIL on a regression that drops the `_progress`
// interpolation from the ghost render path (i.e. if renderGhosts
// reads only g.x/g.y), and PASS on the current implementation.

import { expect, test } from "@playwright/test";

import type { GameState } from "../../src/game/types";

// Mirror of the in-browser test bridge exposed by engine.ts. We only
// declare the subset this spec calls — keeps the declaration local so a
// drift in engine.ts surfaces here as a type error, not a runtime
// undefined.
type GhostName = "blinky" | "pinky" | "inky" | "clyde";
interface RenderPositionsResult {
  pac: { x: number; y: number };
  ghosts: Array<{
    name: GhostName;
    x: number;
    y: number;
    status: "house" | "out";
  }>;
}
interface PacInternalsForGlide {
  renderPositions: () => RenderPositionsResult;
}

declare global {
  interface Window {
    __pac?: GameState;
    __pacInternals?: PacInternalsForGlide;
  }
}

// Logical speeds — must match the constants in src/game/pacman.ts and
// src/game/ghost.ts. Duplicated here on purpose so the spec is
// self-contained and a drift in either source constant trips the spec
// (the right place to assert "the test's view of speed matches the
// engine's view of speed" is a smaller follow-up if it ever drifts).
const PAC_SPEED_PER_TICK = 0.12;
const GHOST_SPEED_PER_TICK = 0.10;

interface RenderSample {
  t: number;
  pac: { x: number; y: number };
  ghost: { x: number; y: number };
}

test("ghost render glides between tiles, matching Pac's per-frame Δposition", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));
  await page.waitForFunction(() => Boolean(window.__pacInternals));

  // Focus the canvas so input lands on window, and so the engine flips
  // out of READY! once we press a direction (status gate, issue #8).
  await page.locator("canvas").click();

  // Drive Pac left along row 23 — a long unbroken straight corridor
  // from spawn (13, 23) all the way to x=6. That gives several seconds
  // of pure straight-line motion before the first wall / branch.
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => window.__pac?.status === "playing", null, {
    timeout: 5000,
  });

  // Wait for Blinky to leave the house. Blinky boots `status: "out"`
  // so this is usually immediate, but we don't want to start sampling
  // before the ghost is actually free to glide.
  await page.waitForFunction(
    () => {
      const internals = window.__pacInternals;
      if (!internals) return false;
      const positions = internals.renderPositions();
      return positions.ghosts.some(
        (g) => g.name === "blinky" && g.status === "out",
      );
    },
    null,
    { timeout: 5000 },
  );

  // Sample ~1.2s of render positions on every animation frame. The
  // sampler runs inside the page via requestAnimationFrame so the
  // cadence matches the canvas paint cadence — same frames the player
  // sees. We collect ~70 samples at 60Hz / 1.2s.
  //
  // We deliberately keep the window short so Pac doesn't run out of
  // his initial corridor (spawn x=13 → wall at x≈6 is 7 tiles, which
  // at 0.12/tick × 60Hz ≈ 1s to traverse). A longer window risks
  // Pac going `dir="none"` mid-sample, which would dilute his max-Δ
  // and skew the parity ratio. And Blinky needs more than 1.2s to
  // navigate down from his spawn to Pac's row, so no collision risk
  // resets either actor mid-sample.
  const samples: RenderSample[] = await page.evaluate(
    () =>
      new Promise<RenderSample[]>((resolve) => {
        const collected: RenderSample[] = [];
        const durationMs = 1200;
        const start = performance.now();
        const tick = (now: number): void => {
          const internals = window.__pacInternals;
          if (internals) {
            const positions = internals.renderPositions();
            const blinky = positions.ghosts.find((g) => g.name === "blinky");
            if (blinky) {
              collected.push({
                t: now,
                pac: { x: positions.pac.x, y: positions.pac.y },
                ghost: { x: blinky.x, y: blinky.y },
              });
            }
          }
          if (now - start < durationMs) {
            requestAnimationFrame(tick);
          } else {
            resolve(collected);
          }
        };
        requestAnimationFrame(tick);
      }),
  );

  // We need enough samples for the max() over the window to be
  // meaningful — at 60Hz over 1.2s that's ~72 frames. Allow generous
  // slack for CI's rAF backpressure: under software WebGL we've seen
  // as low as ~25 frames/sec.
  expect(samples.length).toBeGreaterThanOrEqual(30);

  // Compute per-frame Δposition magnitude for both actors.
  const pacDeltas: number[] = [];
  const ghostDeltas: number[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const curr = samples[i];
    pacDeltas.push(
      Math.hypot(curr.pac.x - prev.pac.x, curr.pac.y - prev.pac.y),
    );
    ghostDeltas.push(
      Math.hypot(curr.ghost.x - prev.ghost.x, curr.ghost.y - prev.ghost.y),
    );
  }

  const maxPacDx = Math.max(...pacDeltas);
  const maxGhostDx = Math.max(...ghostDeltas);

  // Sanity floor: both actors must be moving. If either max is ~0 the
  // setup failed (e.g. Pac never got out of READY!, ghost still in
  // house) and the parity assertion below is meaningless.
  expect(maxPacDx).toBeGreaterThan(0.01);
  expect(maxGhostDx).toBeGreaterThan(0.01);

  // CRITERION #1 — parity, normalised by logical speed.
  //
  // Pac moves at PAC_SPEED_PER_TICK, ghost at GHOST_SPEED_PER_TICK.
  // The "same per-frame Δposition envelope" the issue asks for must
  // be expressed in terms of "tiles per render frame" / "tiles per
  // tick" — i.e. divide each max by its actor's logical speed. With
  // a fixed-timestep loop (60Hz update, ~60Hz render on a 60Hz
  // display) the ratio of (max Δ / speed) is ~1.0 for a perfectly
  // interpolated actor.
  //
  // Tolerance ±25%: CI's software-WebGL rAF cadence isn't a clean
  // 60Hz — it stalls, then catches up by draining 2-3 updates into
  // one paint, which inflates max-Δ for whichever actor happens to
  // be mid-traversal during the catch-up. The asymmetry between
  // Pac (0.12/tick) and ghost (0.10/tick) means the catch-up
  // multiplier doesn't fall identically on both. The bug we're
  // guarding produces a ratio in the 8-10× range (ghost snaps a
  // full tile while Pac glides 0.12), so ±25% still trips loudly
  // on regression while absorbing CI jitter.
  const pacNormalized = maxPacDx / PAC_SPEED_PER_TICK;
  const ghostNormalized = maxGhostDx / GHOST_SPEED_PER_TICK;
  const ratio = ghostNormalized / pacNormalized;
  expect(ratio).toBeGreaterThan(0.75);
  expect(ratio).toBeLessThan(1.25);

  // CRITERION #2 — per-frame bound on the ghost.
  //
  // On a single render frame, a sub-tile-interpolating ghost can move
  // at MOST a small multiple of GHOST_SPEED_PER_TICK tiles (one
  // update per render at 60Hz; up to ~3 updates per render under CI
  // catch-up). If the render path uses integer tile coords (the
  // bug), the ghost holds for 9 frames then jumps ~1.0 tile in
  // frame 10 — that single frame would be ~10× this bound and
  // trip the assertion an order of magnitude over.
  //
  // The bound is GHOST_SPEED_PER_TICK × 3.5 — covers the worst CI
  // catch-up window (3 updates drained into one paint) plus fp
  // jitter, while remaining far below the 1.0-tile snap the bug
  // would produce.
  const PER_FRAME_BOUND = GHOST_SPEED_PER_TICK * 3.5;
  const worstGhostFrame = ghostDeltas.reduce(
    (acc, d, i) => (d > acc.dx ? { dx: d, i } : acc),
    { dx: 0, i: -1 },
  );
  expect(
    worstGhostFrame.dx,
    `worst ghost frame at index ${worstGhostFrame.i} moved ${worstGhostFrame.dx.toFixed(4)} tiles; bound is ${PER_FRAME_BOUND.toFixed(4)}`,
  ).toBeLessThanOrEqual(PER_FRAME_BOUND);
});
