import { expect, test } from "@playwright/test";

// Ivy's feel-axis merge gate for Pac-Man frightened-mode transitions —
//   when the player eats a power pellet, all 4 ghosts flip into
//   frightened mode AND drop to the slower frightened speed tier on
//   the SAME tick. The question this spec polices: does that flip
//   produce a single oversized per-ghost render-position delta —
//   i.e. a visible snap — or does the interpolation introduced by
//   #137 (Pac-Man ghost render interpolation) absorb the tier change
//   smoothly?
//
// Why this matters:
//   #137 fixed the per-tile snap by mirroring Pac's interpolation in
//   the ghost render path. A speed-tier flip is exactly the edge case
//   that interpolation has to handle correctly: the integer tile step
//   is the same, but the fractional progress between tiles changes
//   abruptly. If the renderer doesn't rescale that fraction on the
//   transition tick, the ghost teleports by up to one cell.
//
// Why ONE absolute hard ceiling, everything else soft (lesson from
// #237, #210, agar latency): SwiftShader CI noise on per-frame
// position deltas runs hot. Hard-gate the absolute snap, soft-gate
// the ratio.

interface GhostDeltaSample {
  // Monotonic frame index from probe start.
  frame: number;
  // True iff this frame straddles the frightened-mode flip tick.
  isFlipFrame: boolean;
  // Max per-ghost euclidean render-position delta this frame (px).
  maxGhostDelta: number;
}

const SEED = 0xfade;

// Hard merge-gate: a single ghost render-position delta this large
// IS a teleport — one tile in Pac-Man is ~16px on the canonical
// render scale; allowing 24px absorbs anti-aliasing + sub-pixel
// jitter while a true tier-flip snap (~16-32px) still trips.
const HARD_MAX_FLIP_DELTA_PX = 24;

// Soft assertions — warnings, not failures.
const SOFT_FLIP_VS_STEADY_RATIO = 2.0;

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

test.describe("pacman · frightened-mode speed-switch snap (Ivy's feel-axis)", () => {
  test("ghost render delta on the flip frame ≤ 24px (no visible teleport)", async ({
    page,
  }) => {
    await page.goto(`/pacman/?seed=${SEED}`);

    // Probe the renderer for per-frame max ghost position delta and
    // tag whether each frame straddles the frightened-mode flip.
    // Test-only surface; see pacman/src/feel/ghost-delta-probe.ts
    // (the probe wiring lives on the same additive test-surface
    // contract as #137's render-interp probe).
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const g = (
              window as unknown as {
                __game?: { ghostDeltaProbe?: unknown };
              }
            ).__game;
            return g?.ghostDeltaProbe !== undefined;
          }),
        { message: "ghostDeltaProbe surface available", timeout: 10_000 },
      )
      .toBe(true);

    // Drive: walk Pac toward a power pellet, eat it, hold the frame
    // collector through the flip + ~2 seconds of frightened steady
    // state. The test driver is deliberately scripted so the flip
    // tick is captured under the probe's isFlipFrame flag rather
    // than guessed from wallclock.
    await page.evaluate(() => {
      (
        window as unknown as {
          __game: { ghostDeltaProbe: { reset: () => void } };
        }
      ).__game.ghostDeltaProbe.reset();
    });

    // Hand control to the deterministic power-pellet driver: it
    // queues the input tape that walks Pac to the nearest pellet
    // under SEED, eats it, then idles for ~120 frames post-flip.
    await page.evaluate(() => {
      (
        window as unknown as {
          __game: { ghostDeltaProbe: { drivePowerPelletScript: () => Promise<void> } };
        }
      ).__game.ghostDeltaProbe.drivePowerPelletScript();
    });

    await expect
      .poll(
        async () =>
          await page.evaluate(
            () =>
              (
                window as unknown as {
                  __game: {
                    ghostDeltaProbe: {
                      samples: () => readonly GhostDeltaSample[];
                    };
                  };
                }
              ).__game.ghostDeltaProbe.samples().length,
          ),
        { message: "probe collected ≥ 120 frames", timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(120);

    const samples = (await page.evaluate(
      () =>
        (
          window as unknown as {
            __game: {
              ghostDeltaProbe: {
                samples: () => readonly GhostDeltaSample[];
              };
            };
          }
        ).__game.ghostDeltaProbe.samples(),
    )) as readonly GhostDeltaSample[];

    const flipFrames = samples.filter((s) => s.isFlipFrame);
    const steadyFrames = samples.filter((s) => !s.isFlipFrame);

    // Sanity: the script must actually have produced a flip frame.
    expect(flipFrames.length).toBeGreaterThan(0);
    expect(steadyFrames.length).toBeGreaterThanOrEqual(60);

    const flipMax = Math.max(...flipFrames.map((s) => s.maxGhostDelta));
    const steadySorted = steadyFrames
      .map((s) => s.maxGhostDelta)
      .sort((a, b) => a - b);
    const steadyP99 = percentile(steadySorted, 99);

    console.log(
      `[ivy/pacman-frightened-snap] flipMax=${flipMax.toFixed(2)}px ` +
        `steadyP99=${steadyP99.toFixed(2)}px ratio=${(flipMax / steadyP99).toFixed(2)}× ` +
        `n_flip=${flipFrames.length} n_steady=${steadyFrames.length}`,
    );

    // SOFT: flip-frame delta should be within 2× steady-state p99.
    // A true tier-flip snap blows this up to 10×+; a properly
    // interpolated tier transition stays close to 1×.
    expect
      .soft(
        flipMax / steadyP99,
        `flip-frame max ${flipMax.toFixed(2)}px is ${(flipMax / steadyP99).toFixed(2)}× steady-state p99 ${steadyP99.toFixed(2)}px — possible snap`,
      )
      .toBeLessThanOrEqual(SOFT_FLIP_VS_STEADY_RATIO);

    // HARD: no flip-frame may exceed the absolute teleport ceiling.
    expect(
      flipMax,
      `[ivy/pacman-frightened-snap] HARD flip-frame max ${flipMax.toFixed(2)}px > ${HARD_MAX_FLIP_DELTA_PX}px — frightened-mode tier change is teleporting ghosts`,
    ).toBeLessThanOrEqual(HARD_MAX_FLIP_DELTA_PX);
  });
});
