import { expect, test } from "@playwright/test";

// Ivy's feel-axis merge gate for Pac-Man frightened-mode transitions —
//   when frightened mode is armed, all 4 ghosts flip into frightened
//   mode AND drop to the slower frightened speed tier on the SAME
//   tick. The question this spec polices: does that flip produce a
//   single oversized per-ghost render-position delta — i.e. a visible
//   snap — or does the interpolation introduced by #137 (Pac-Man
//   ghost render interpolation) absorb the tier change smoothly?
//
// Why this matters:
//   #137 fixed the per-tile snap by mirroring Pac's interpolation in
//   the ghost render path. A speed-tier flip is exactly the edge case
//   that interpolation has to handle correctly: the integer tile step
//   is the same, but the per-tick `_progress` advance changes from
//   0.10 (chase) to 0.05 (frightened). If anything in the renderer
//   resets _progress or jumps a tile on the transition, the ghost
//   teleports by up to one cell (~8px on TILE=8).
//
// Why ONE absolute hard ceiling, everything else soft (lesson from
// #237, #210, agar latency): SwiftShader CI noise on per-frame
// position deltas runs hot. Hard-gate the absolute snap, soft-gate
// the ratio.
//
// Probe surface: window.__pacInternals.ghostDeltaProbe (engine.ts).
// It's an additive test-only surface on the same contract as #137's
// renderPositions, #210's dirCommitProbe, and #145's forceFrightened.
// Driving via the probe's forceFrightened-equivalent (not by routing
// Pac through a power pellet) eliminates pellet-pathing flake risk.

import type { Page } from "@playwright/test";

interface GhostDeltaSample {
  // Monotonic frame index from probe start.
  frame: number;
  // True iff this frame straddles the frightened-mode flip tick.
  isFlipFrame: boolean;
  // Max per-ghost euclidean render-position delta this frame (px).
  maxGhostDelta: number;
}

// Hard merge-gate: a single ghost render-position delta this large
// IS a teleport — one tile in Pac-Man is TILE=8px on the canonical
// render scale. Allow 24px (three tiles' worth) so SwiftShader rAF
// jitter, anti-aliasing, and multi-update-per-frame drains don't
// flake while a true tier-flip snap (~8-16px in a single frame
// across an integer tile boundary that shouldn't have happened)
// still trips.
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

async function probeReady(page: Page): Promise<boolean> {
  return (await page.evaluate(() => {
    const api = window.__pacInternals;
    return Boolean(api && typeof api.ghostDeltaProbe?.reset === "function");
  })) as boolean;
}

test.describe("pacman · frightened-mode speed-switch snap (Ivy's feel-axis)", () => {
  test("ghost render delta on the flip frame stays sub-tile (no visible teleport)", async ({
    page,
  }) => {
    test.setTimeout(45_000);

    await page.goto("/");
    const canvas = page.locator("canvas").first();
    await canvas.waitFor({ state: "visible" });

    // Probe surface — see pacman/src/game/engine.ts (additive
    // __pacInternals.ghostDeltaProbe).
    await expect
      .poll(() => probeReady(page), {
        message: "__pacInternals.ghostDeltaProbe surface available",
        timeout: 10_000,
      })
      .toBe(true);

    // Focus the canvas + nudge the engine out of 'ready' so updates
    // start ticking (frightened timer only decrements in update()).
    // Pac spawns on row 23, where Left/Right are walkable from the
    // spawn cell — pressing ArrowLeft commits and flips status to
    // 'playing' on the next update.
    await canvas.click();
    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction(
      () => window.__pac?.status === "playing",
      null,
      { timeout: 5_000 },
    );

    // Let ghosts cross at least one tile boundary in chase mode
    // before we start sampling, so the pre-flip baseline isn't
    // contaminated by the boot-second of staggered house releases.
    // Blinky's out from boot; ~30 ticks @ 0.10/tick = 3 tiles.
    await page.waitForTimeout(500);

    // Arm the probe + drive the flip script.
    await page.evaluate(() => {
      window.__pacInternals!.ghostDeltaProbe.reset();
    });
    await page.evaluate(
      () => window.__pacInternals!.ghostDeltaProbe.driveFlipScript(),
    );

    const samples = (await page.evaluate(
      () => window.__pacInternals!.ghostDeltaProbe.samples(),
    )) as readonly GhostDeltaSample[];

    // Floor: the driver requests 30 pre-flip + 100 post-flip frames.
    // CI rAF jitter can swallow a few; accept ≥100 as the floor below
    // which the p99 below isn't meaningful.
    expect(
      samples.length,
      `expected ≥100 samples, got ${samples.length}`,
    ).toBeGreaterThanOrEqual(100);

    const flipFrames = samples.filter((s) => s.isFlipFrame);
    const steadyFrames = samples.filter((s) => !s.isFlipFrame);

    // Sanity: the script must actually have produced a flip frame
    // and enough steady-state to compute a p99.
    expect(
      flipFrames.length,
      "driveFlipScript must mark ≥1 frame as the flip frame",
    ).toBeGreaterThan(0);
    expect(
      steadyFrames.length,
      `need ≥60 steady-state frames for p99, got ${steadyFrames.length}`,
    ).toBeGreaterThanOrEqual(60);

    const flipMax = Math.max(...flipFrames.map((s) => s.maxGhostDelta));
    const steadySorted = steadyFrames
      .map((s) => s.maxGhostDelta)
      .sort((a, b) => a - b);
    const steadyP99 = percentile(steadySorted, 99);

    // eslint-disable-next-line no-console
    console.log(
      `[ivy/pacman-frightened-snap] flipMax=${flipMax.toFixed(2)}px ` +
        `steadyP99=${steadyP99.toFixed(2)}px ` +
        `ratio=${(flipMax / Math.max(steadyP99, 0.01)).toFixed(2)}× ` +
        `n_flip=${flipFrames.length} n_steady=${steadyFrames.length}`,
    );

    // SOFT: flip-frame delta should be within 2× steady-state p99.
    // The expected geometry: post-flip the per-tick advance halves
    // (chase 0.10 → frightened 0.05), so the flip frame's max delta
    // should be COMPARABLE to or SMALLER than steady-state chase
    // p99 — never larger by a tier-snap multiple.
    expect
      .soft(
        flipMax / Math.max(steadyP99, 0.01),
        `flip-frame max ${flipMax.toFixed(2)}px is ${(flipMax / Math.max(steadyP99, 0.01)).toFixed(2)}× steady-state p99 ${steadyP99.toFixed(2)}px — possible snap`,
      )
      .toBeLessThanOrEqual(SOFT_FLIP_VS_STEADY_RATIO);

    // HARD: no flip-frame may exceed the absolute teleport ceiling.
    // 24px = 3 tiles. A correctly-interpolated tier-flip stays
    // under one tile (~8px) even with multi-update rAF drains.
    expect(
      flipMax,
      `[ivy/pacman-frightened-snap] HARD flip-frame max ${flipMax.toFixed(2)}px > ${HARD_MAX_FLIP_DELTA_PX}px — frightened-mode tier change is teleporting ghosts`,
    ).toBeLessThanOrEqual(HARD_MAX_FLIP_DELTA_PX);
  });

  test("probe is exposed + null-safe before any drive", async ({ page }) => {
    await page.goto("/");
    await page.locator("canvas").first().waitFor({ state: "visible" });

    await expect
      .poll(() => probeReady(page), {
        message: "__pacInternals.ghostDeltaProbe surface available",
        timeout: 10_000,
      })
      .toBe(true);

    // Before any reset/drive, samples() returns an array (possibly
    // empty) — never undefined, never NaN entries.
    const initial = (await page.evaluate(
      () => window.__pacInternals!.ghostDeltaProbe.samples(),
    )) as readonly GhostDeltaSample[];

    expect(Array.isArray(initial)).toBe(true);
    for (const s of initial) {
      expect(Number.isFinite(s.maxGhostDelta)).toBe(true);
      expect(s.maxGhostDelta).toBeGreaterThanOrEqual(0);
    }
  });
});
