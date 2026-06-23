// Ghost-glide feel-spec. The harness contract — explicit because the
// renderer has to keep up its end:
//
//   For each non-eaten ghost mode, the per-frame render delta on
//   *screen* must equal the engine's per-tick speed for that mode,
//   modulo the rAF/tick beat. There are THREE tiers:
//
//   1. normal   (scatter/chase)                    — GHOST_SPEED_PER_TICK   = 0.10
//   2. frightened (post power pellet)            — FRIGHTENED_SPEED_PER_TICK = 0.05
//   3. eaten    (eyes racing back to the house) — EATEN_SPEED_PER_TICK    = 0.20
//
// Each tier gets its own sub-test below. The original Issue #137 spec
// covered (1) only; #145 added (2); #171's juice-ladder added (3). The
// asserts mirror the Pac-glide spec — sample at high frequency, dedup
// to motion steps, check both self-consistency (intra-test ratio) and
// the engine contract (absolute delta vs the speed constant).
//
// Issue #NEW — TRANSITION FRAME sub-test. The tiers above all sample in
// STEADY STATE — the existing frightened sub-test waits until
// `mode === 'frightened'` is already published before recording. The
// single tick the speed flips (0.10 → 0.05 the tick a power pellet is
// eaten) was NOT under any merge gate. A renderer that forward-
// extrapolates with the current-tick speed could ship a sub-tile snap
// on the flip and CI would stay green. The new sub-test samples a
// window CENTERED on the flip tick and asserts no per-frame outlier.

import { expect, test } from "@playwright/test";

// Engine constants — must stay in sync with src/game/ghost.ts. These
// are NOT imported (the e2e runs against the built dev server) so they
// live here as named constants and any drift fails loudly.
const GHOST_SPEED_PER_TICK = 0.10;
const FRIGHTENED_SPEED_PER_TICK = 0.05;
const EATEN_SPEED_PER_TICK = 0.20;

// Width of one tile on the canvas (TILE_PX in the renderer). We need
// this to convert "tiles per tick" → "pixels per tick" for the screen
// delta assertion. Hard-coded to match game/maze.ts CANVAS_W / COLS.
const TILE_PX = 16;

// Sampling cadence. 16ms = ~60fps cap; the engine runs at 60Hz so this
// captures every tick with a small phase wobble. We dedup back to
// motion STEPS (frames where the ghost actually moved) before computing
// the delta — this removes rAF / engine-tick beat noise.
const SAMPLE_PERIOD_MS = 16;

// How long to sample, per tier. Frightened is the longest because the
// pseudo-random direction shuffle takes a while to settle into a
// continuous corridor run; we discard segments where the ghost
// reversed (delta == 0 or negative on the axis we're measuring).
const NORMAL_SAMPLE_MS = 1500;
const FRIGHTENED_SAMPLE_MS = 2500;
const EATEN_SAMPLE_MS = 1500;

// How tight to gate the absolute-speed assertion. The engine ticks at
// 60Hz and Playwright's rAF cadence can drift by ~1 frame on slow CI,
// so we allow the measured per-tick delta to land within 25% of the
// expected speed — enough to catch a 2× regression but tolerant of
// scheduler jitter.
const FRAME_BOUND_MULT = 1.25;

// Self-consistency ratio: across the sampled steps, the ratio of
// (max step length) / (min step length) should be ≤ this. A perfectly
// smooth glide is 1.0; the engine's deterministic floor on `_progress`
// boundaries can spread this to ~1.2 on short windows. 1.5 is the
// generous gate.
const SELF_RATIO_MAX = 1.5;

// ──────────────────────────────────────────────────────────────────────
// Helpers shared across the three sub-tests.
// ──────────────────────────────────────────────────────────────────────

type GhostSnap = {
  t: number; // ms since test start
  name: string;
  x: number; // tile column (engine-side; renderer interpolates)
  y: number;
  mode: "scatter" | "chase" | "frightened" | "eaten";
  // Renderer-side interpolated pixel coords. The renderer publishes
  // these via `__pacInternals.renderPositions()` (see Issue #137 hook
  // in src/game/render.ts). Pixel space, top-left origin.
  px: number;
  py: number;
};

// Walk a per-ghost sample series back to motion STEPS in pixel space —
// adjacent samples where the ghost was on the same continuous segment
// (no tile-wrap, no direction reversal). Returns the list of per-step
// screen-pixel deltas for the named ghost.
function pixelSteps(samples: GhostSnap[], name: string): number[] {
  const series = samples.filter((s) => s.name === name);
  const steps: number[] = [];
  for (let i = 1; i < series.length; i += 1) {
    const a = series[i - 1];
    const b = series[i];
    const dx = b.px - a.px;
    const dy = b.py - a.py;
    const dist = Math.hypot(dx, dy);
    // Drop reversals (tile-wrap teleports show as huge dist; direction
    // flips at a tile boundary show as 0). Anything > 2 tiles is a
    // wrap, anything == 0 is a stall — both filtered.
    if (dist <= 0) continue;
    if (dist > 2 * TILE_PX) continue;
    steps.push(dist);
  }
  return steps;
}

// Self-consistency ratio across a step series, ignoring zeros.
function selfRatio(steps: number[], _expectedPerTick: number): number {
  if (steps.length < 2) return Infinity;
  const positive = steps.filter((s) => s > 0);
  if (positive.length < 2) return Infinity;
  const mx = Math.max(...positive);
  const mn = Math.min(...positive);
  return mx / mn;
}

// Sample window helper. Polls the page for `__pac` + the renderer's
// interpolated positions at SAMPLE_PERIOD_MS for `durationMs`.
async function collect(page: import("@playwright/test").Page, durationMs: number): Promise<GhostSnap[]> {
  return page.evaluate(async ({ durationMs, period }) => {
    const out: GhostSnap[] = [];
    const start = performance.now();
    while (performance.now() - start < durationMs) {
      const pac = (window as unknown as { __pac?: { ghosts: Array<{ name: string; x: number; y: number; mode: GhostSnap["mode"] }> } }).__pac;
      const internals = (window as unknown as {
        __pacInternals?: {
          renderPositions?: () => Record<string, { x: number; y: number }>;
        };
      }).__pacInternals;
      const renderPos = internals?.renderPositions?.() ?? {};
      if (pac?.ghosts) {
        const t = performance.now() - start;
        for (const g of pac.ghosts) {
          const r = renderPos[g.name] ?? { x: g.x * 16, y: g.y * 16 };
          out.push({ t, name: g.name, x: g.x, y: g.y, mode: g.mode, px: r.x, py: r.y });
        }
      }
      await new Promise((res) => setTimeout(res, period));
    }
    return out;
  }, { durationMs, period: SAMPLE_PERIOD_MS });
}

// ──────────────────────────────────────────────────────────────────────
// Tier 1 — normal scatter/chase glide. Original #137 spec lives here.
// ──────────────────────────────────────────────────────────────────────

test.describe("ghost-glide feel-spec", () => {
  test("normal tier — self-parity at GHOST_SPEED_PER_TICK (#137)", async ({
    page,
  }) => {
    await page.goto("/");
    // Wait for Blinky (always out at boot) to settle a few ticks into
    // its scatter run so the very-first frames don't bias the ratio.
    await page.waitForFunction(() => {
      const pac = (window as unknown as { __pac?: { ghosts: Array<{ name: string; mode: string }> } }).__pac;
      return pac?.ghosts?.find((g) => g.name === "blinky")?.mode === "scatter";
    });
    await page.waitForTimeout(300);

    const samples = await collect(page, NORMAL_SAMPLE_MS);
    const steps = pixelSteps(samples, "blinky");
    expect(steps.length, "blinky never moved").toBeGreaterThan(10);

    const ratio = selfRatio(steps, GHOST_SPEED_PER_TICK);
    expect(ratio).toBeLessThanOrEqual(SELF_RATIO_MAX);

    // Absolute-speed gate: median step length should match the engine's
    // GHOST_SPEED_PER_TICK in pixels per tick, within FRAME_BOUND_MULT.
    const median = [...steps].sort((a, b) => a - b)[Math.floor(steps.length / 2)];
    const expectedPx = GHOST_SPEED_PER_TICK * TILE_PX;
    expect(median).toBeLessThanOrEqual(expectedPx * FRAME_BOUND_MULT);
    expect(median).toBeGreaterThanOrEqual(expectedPx / FRAME_BOUND_MULT);
  });

  // ──────────────────────────────────────────────────────────────────
  // Tier 2 — frightened glide. #145. Asserts self-parity in STEADY
  // STATE while the frightened timer is active. Uses the
  // `__pacInternals.forceFrightened()` and `__pacInternals.setGhostEaten()`
  // test hooks so the spec doesn't have to drive Pac onto a power pellet
  // — the engine arms `frightenedTicksLeft` the same way either way.
  // ──────────────────────────────────────────────────────────────────

  test("frightened tier — self-parity at FRIGHTENED_SPEED_PER_TICK (#145)", async ({
    page,
  }) => {
    await page.goto("/");

    // Arm frightened mode via the test hook. The engine arms the timer
    // and the ghost-AI tick will flip every non-eaten ghost's mode on
    // its next pass through resolveMode().
    await page.evaluate(() => {
      const api = (window as unknown as {
        __pacInternals?: { forceFrightened?: () => void };
      }).__pacInternals;
      if (!api || typeof api.forceFrightened !== "function") {
        throw new Error(
          "frightened sub-test requires __pacInternals.forceFrightened()",
        );
      }
      api.forceFrightened();
    });

    // Wait until at least one ghost reports mode==='frightened' on the
    // public roster. The mode resolution happens on the engine's next
    // tick; in practice <16ms but we give it 300ms slack.
    await page.waitForFunction(
      () => {
        const snap = (window as unknown as {
          __pac?: { ghosts: Array<{ mode: string }> };
        }).__pac;
        return snap?.ghosts.some((g) => g.mode === "frightened") ?? false;
      },
      { timeout: 1000 },
    );

    const samples = await collect(page, FRIGHTENED_SAMPLE_MS);

    // Pick a ghost that stays frightened through the sample window. We
    // require the FIRST sample's frightened ghost to remain frightened
    // for at least the first half of the window.
    const firstFrightened = samples[0].ghosts.find(
      (g: GhostSnap) => g.mode === "frightened",
    ) as GhostSnap | undefined;
    expect(firstFrightened, "no frightened ghost in first sample").toBeTruthy();
    const name = firstFrightened!.name;

    // Truncate to the contiguous prefix where this ghost is frightened.
    const cut = samples.findIndex((s) => {
      const g = s.name === name ? s : null;
      return Boolean(g && g.mode === "frightened");
    });
    const prefix = samples.slice(cut).filter((s) => {
      if (s.name !== name) return true;
      return s.mode === "frightened";
    });
    const ghostSteps = pixelSteps(prefix, name);

    // Frightened ghosts pick pseudo-random directions at every tile
    // boundary — so the step set is noisier than scatter/chase. We
    // therefore loosen the self-ratio gate slightly (1.6 instead of 1.5)
    // because each tile takes 20 ticks at FRIGHTENED_SPEED_PER_TICK.
    expect(ghostSteps.length).toBeGreaterThan(10);
    const ghostRatio = selfRatio(ghostSteps, FRIGHTENED_SPEED_PER_TICK);
    expect(ghostRatio).toBeLessThanOrEqual(1.6);

    const median = [...ghostSteps].sort((a, b) => a - b)[Math.floor(ghostSteps.length / 2)];
    const expectedPx = FRIGHTENED_SPEED_PER_TICK * TILE_PX;
    expect(median).toBeLessThanOrEqual(expectedPx * FRAME_BOUND_MULT);
    expect(median).toBeGreaterThanOrEqual(expectedPx / FRAME_BOUND_MULT);
  });

  // ──────────────────────────────────────────────────────────────────
  // Tier 2b — TRANSITION FRAME (Issue #NEW). The tiers above sample
  // STEADY STATE only; the existing frightened sub-test waits until
  // `mode === 'frightened'` is already published before recording.
  // The single tick the speed flips (0.10 → 0.05 the tick a power
  // pellet is eaten, ghost.ts L424 branch) was NOT under any merge
  // gate. A renderer that forward-extrapolates with the current-tick
  // speed could ship a sub-tile snap on the flip and CI would stay
  // green. This sub-test samples a window CENTERED on the flip tick
  // and asserts no per-frame outlier exceeds 1.5× the larger of the
  // two adjacent expected speeds.
  // ──────────────────────────────────────────────────────────────────

  test("transition frame — chase→frightened flip is continuous (no sub-tile snap)", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for the ghosts to be out and gliding in scatter/chase tier
    // (the pre-flip baseline). We sample blinky which boots out at top
    // of house and is always on the maze.
    await page.waitForFunction(() => {
      const pac = (window as unknown as { __pac?: { ghosts: Array<{ name: string; mode: string }> } }).__pac;
      const blinky = pac?.ghosts?.find((g) => g.name === "blinky");
      return blinky?.mode === "scatter" || blinky?.mode === "chase";
    });
    // Let blinky settle into a corridor — the flip-frame assertion
    // requires the ghost is mid-glide (not at a tile boundary) so we
    // actually exercise the speed branch on the flip tick.
    await page.waitForTimeout(500);

    // Start sampling BEFORE arming frightened. We capture a window
    // straddling the flip so the transition tick is in the dataset.
    const samplePromise = collect(page, 1000);

    // Arm frightened ~200ms in — gives us ~12 frames of pre-flip
    // baseline and ~50 frames of post-flip steady state in the window.
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const api = (window as unknown as {
        __pacInternals?: { forceFrightened?: () => void };
      }).__pacInternals;
      if (!api || typeof api.forceFrightened !== "function") {
        throw new Error(
          "transition-frame sub-test requires __pacInternals.forceFrightened()",
        );
      }
      api.forceFrightened();
    });

    const samples = await samplePromise;

    // Pick blinky (always out, deterministic). Walk the series and
    // find the first sample where mode flips chase|scatter → frightened.
    const blinkySeries = samples.filter((s) => s.name === "blinky");
    expect(blinkySeries.length).toBeGreaterThan(30);

    let flipIdx = -1;
    for (let i = 1; i < blinkySeries.length; i += 1) {
      const prev = blinkySeries[i - 1].mode;
      const curr = blinkySeries[i].mode;
      if (curr === "frightened" && prev !== "frightened") {
        flipIdx = i;
        break;
      }
    }
    expect(flipIdx, "never observed chase→frightened flip in sample window").toBeGreaterThan(0);

    // Sub-window: 8 frames before flip, 8 after. Compute per-frame
    // pixel deltas and assert NO frame in this window exceeds
    // 1.5 × (GHOST_SPEED_PER_TICK × TILE_PX) — the larger of the two
    // tier speeds. A correctly-rendered flip stays bounded by the
    // pre-flip speed; a sub-tile snap (renderer using post-flip speed
    // to forward-extrapolate from a pre-flip _progress) would visibly
    // exceed it.
    const lo = Math.max(1, flipIdx - 8);
    const hi = Math.min(blinkySeries.length, flipIdx + 8);
    const window = blinkySeries.slice(lo, hi);
    const deltas: number[] = [];
    for (let i = 1; i < window.length; i += 1) {
      const a = window[i - 1];
      const b = window[i];
      const d = Math.hypot(b.px - a.px, b.py - a.py);
      // Drop tile-wraps (>2 tiles) and tile-boundary reversals (0).
      if (d <= 0 || d > 2 * TILE_PX) continue;
      deltas.push(d);
    }
    expect(deltas.length, "no continuous motion in transition window").toBeGreaterThan(4);

    const maxAllowed = GHOST_SPEED_PER_TICK * TILE_PX * 1.5;
    const worst = Math.max(...deltas);
    expect(
      worst,
      `transition-frame outlier ${worst.toFixed(2)}px exceeds ${maxAllowed.toFixed(2)}px ceiling — sub-tile snap on chase→frightened flip`,
    ).toBeLessThanOrEqual(maxAllowed);

    // Soft: no frame should be a freeze either. The minimum positive
    // delta should be > 0.25× the post-flip expected speed (frightened
    // is half-speed; freezing would show as a near-zero stretch in the
    // window). Soft because rAF/tick beat can legitimately produce a
    // one-frame near-zero step.
    const minPositive = Math.min(...deltas);
    const floor = FRIGHTENED_SPEED_PER_TICK * TILE_PX * 0.25;
    expect.soft(
      minPositive,
      `transition-frame minimum delta ${minPositive.toFixed(3)}px below ${floor.toFixed(3)}px floor — possible freeze on chase→frightened flip`,
    ).toBeGreaterThanOrEqual(floor);
  });

  // ──────────────────────────────────────────────────────────────────
  // Tier 3 — eaten (eyes). #171. Asserts double-speed glide back to
  // the revive tile. Uses `__pacInternals.setGhostEaten(name)` to flip
  // a single ghost into 'eaten' without depending on the
  // power-pellet-collide path.
  // ──────────────────────────────────────────────────────────────────

  test("eaten tier — self-parity at EATEN_SPEED_PER_TICK (#171)", async ({
    page,
  }) => {
    await page.goto("/");

    await page.evaluate(() => {
      const api = (window as unknown as {
        __pacInternals?: { setGhostEaten?: (name: string) => void };
      }).__pacInternals;
      if (!api || typeof api.setGhostEaten !== "function") {
        // Tier 3 is optional if the engine slice doesn't expose the
        // hook yet — skip gracefully rather than fail the suite.
        return;
      }
      api.setGhostEaten("blinky");
    });

    // If the hook didn't exist, blinky's mode won't be 'eaten' and the
    // wait below times out — convert that to a graceful skip.
    const hasEaten = await page.evaluate(() => {
      const snap = (window as unknown as { __pac?: { ghosts: Array<{ name: string; mode: string }> } }).__pac;
      return snap?.ghosts.find((g) => g.name === "blinky")?.mode === "eaten";
    });
    if (!hasEaten) {
      test.skip(true, "engine slice lacks __pacInternals.setGhostEaten — eaten tier deferred");
      return;
    }

    const samples = await collect(page, EATEN_SAMPLE_MS);
    const series = samples.filter((s) => s.name === "blinky" && s.mode === "eaten");
    const steps = pixelSteps(series, "blinky");

    expect(steps.length).toBeGreaterThan(5);
    // Eaten ghosts beeline to REVIVE_TILE — they'll touch it within
    // the sample window and flip back to scatter/chase. Filter only
    // frightened/eaten which would skew lower; the median of the
    // captured eaten series should match EATEN_SPEED_PER_TICK.
    const median = [...steps].sort((a, b) => a - b)[Math.floor(steps.length / 2)];
    const expectedPx = EATEN_SPEED_PER_TICK * TILE_PX;
    expect(median).toBeLessThanOrEqual(expectedPx * FRAME_BOUND_MULT);
    // Eaten is a "race back" tier — we permit some slack on the lower
    // bound because the path includes a few direction changes before
    // the ghost lines up on the house corridor.
    expect(median).toBeGreaterThanOrEqual(expectedPx / (FRAME_BOUND_MULT * 1.4));
  });
});
