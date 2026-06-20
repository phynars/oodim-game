// Ghost-glide feel parity spec (#145, extending #137).
//
// The render layer interpolates Pac and ghosts between integer tile commits
// using `_progress: 0..1`. This spec asserts that the per-frame visual
// motion of each actor tracks its OWN engine speed constant — across
// THREE tiers and the cornering case:
//
//   1. straight-corridor normal (scatter/chase)  — GHOST_SPEED_PER_TICK = 0.10
//   2. frightened (post power pellet)            — FRIGHTENED_SPEED_PER_TICK = 0.05
//   3. eaten / eyes returning                    — EATEN_SPEED_PER_TICK = 0.20
//   4. cornering parity                          — per-frame bound on commit
//
// CORRECTION over the first draft: the original spec wrongly assumed
// ghost speed == Pac speed (it asserted a ratio of pac steps to ghost
// steps ≈ 1.0). The engine constants disagree — Pac is 0.12/tick,
// normal ghosts are 0.10/tick. The correct contract is SELF-PARITY:
// each actor's total Euclidean displacement over N sampled logical
// ticks should equal (SPEED_PER_TICK * N) within a tolerance band that
// absorbs CI rAF jitter.
//
// PRECONDITION: this file depends on `__pacInternals.renderPositions()` —
// a read-only probe that returns the float sub-tile draw positions for Pac
// and every ghost (mirroring renderPac / renderGhosts math). If it is
// absent at runtime, every sub-test fails fast with a clear message.
// `__pacInternals.forceFrightened()` and `__pacInternals.setGhostEaten()`
// are spec-only mode-warp probes.

import { test, expect, type Page } from "@playwright/test";

// Per-tick normalized advance for each mode, MATCHING ghost.ts + pacman.ts
// constants exactly. If those drift, this spec must drift with them in
// lockstep — that's the contract.
const PAC_SPEED_PER_TICK = 0.12;
const GHOST_SPEED_PER_TICK = 0.10;
const FRIGHTENED_SPEED_PER_TICK = 0.05;
const EATEN_SPEED_PER_TICK = 0.2;

// Acceptance bands for the self-ratio (observed displacement / expected).
// Loose enough to absorb CI's software-WebGL rAF jitter (verified ±25%
// is the right shape from earlier feel-specs in this suite), tight enough
// to catch a real regression (a 2× drift or a stall).
const RATIO_LO = 0.75;
const RATIO_HI = 1.25;
// Per-frame bound: the float draw position must not advance by more than
// (speed_per_tick * 3.5) on any single render frame — accounts for
// software-WebGL rAF jitter in CI (the 3.5x headroom mirrors the pacman
// e2e feel-spec convention I locked in across the suite).
const FRAME_BOUND_MULT = 3.5;

// Minimum logical-tick samples a tier needs before computing a ratio.
// Tick-dedup can drop frames when the rAF rate undershoots 60Hz; a hard
// floor below 20 gives the eaten tier (which races home in ~30 ticks
// before flipping back to scatter/chase at the revive tile) room to
// finish without tripping the floor before we can truncate to the
// contiguous-mode prefix.
const MIN_SAMPLES = 10;

type RenderSample = {
  tick: number;
  pac: { x: number; y: number };
  ghosts: Array<{ name: string; x: number; y: number; mode: string }>;
};

// Sampler: poll renderPositions every animation frame for N frames, return
// the chronological array. We sample by tick — consecutive frames with the
// same tick are deduped (one logical step = one sample).
async function sampleRenderPositions(
  page: Page,
  frames: number,
): Promise<RenderSample[]> {
  return await page.evaluate(async (n: number) => {
    const api = (window as unknown as {
      __pacInternals?: {
        renderPositions?: () => {
          tick: number;
          pac: { x: number; y: number };
          ghosts: Array<{ name: string; x: number; y: number; mode: string }>;
        };
      };
    }).__pacInternals;
    if (!api || typeof api.renderPositions !== "function") {
      throw new Error(
        "ghost-glide spec requires __pacInternals.renderPositions() (#137 prerequisite)",
      );
    }
    const out: Array<{
      tick: number;
      pac: { x: number; y: number };
      ghosts: Array<{ name: string; x: number; y: number; mode: string }>;
    }> = [];
    let lastTick = -1;
    for (let i = 0; i < n; i += 1) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const snap = api.renderPositions!();
      if (snap.tick !== lastTick) {
        out.push(snap);
        lastTick = snap.tick;
      }
    }
    return out;
  }, frames);
}

// Compute axis-agnostic Euclidean step length between consecutive samples
// for an actor. Returns null for any gap where the picker can't extract
// a position (e.g. ghost not in roster, mode mismatch) — those gaps are
// skipped from the resulting steps array.
function stepsFor(
  samples: RenderSample[],
  pick: (s: RenderSample) => { x: number; y: number } | null,
): number[] {
  const out: number[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const a = pick(samples[i - 1]);
    const b = pick(samples[i]);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    out.push(Math.hypot(dx, dy));
  }
  return out;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

// Self-ratio: total displacement vs (per-tick speed × number of inter-
// sample gaps). 1.0 = perfect tracking; 0.0 = stalled; >1 = overshoot.
function selfRatio(steps: number[], speedPerTick: number): number {
  if (steps.length === 0) return 0;
  return sum(steps) / (speedPerTick * steps.length);
}

test.describe("ghost-glide feel parity (#137 + #145)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.__pacInternals));
    // First input: nudge Pac so the engine flips 'ready' → 'playing'.
    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction(() => window.__pac?.status === "playing");
  });

  test("normal tier — straight-corridor self-parity", async ({ page }) => {
    // Pac glides left along row 23 from a clean tile-center commit.
    // Sample ~60 frames (~1s wall time on a 60Hz tick).
    const samples = await sampleRenderPositions(page, 60);
    expect(samples.length).toBeGreaterThanOrEqual(MIN_SAMPLES);

    const pacSteps = stepsFor(samples, (s) => s.pac);
    const pacRatio = selfRatio(pacSteps, PAC_SPEED_PER_TICK);
    expect(pacRatio).toBeGreaterThan(RATIO_LO);
    expect(pacRatio).toBeLessThan(RATIO_HI);

    // Blinky boots already out so it's always sampled. Truncate to the
    // contiguous prefix where Blinky stays in scatter/chase — the engine
    // flips scatter↔chase every MODE_PERIOD_TICKS, but BOTH modes use
    // GHOST_SPEED_PER_TICK so we don't need to split on the flip.
    const blinkyOf = (s: RenderSample) =>
      s.ghosts.find((g) => g.name === "blinky") ?? null;
    const ghostSteps = stepsFor(samples, (s) => {
      const g = blinkyOf(s);
      if (!g) return null;
      if (g.mode !== "scatter" && g.mode !== "chase") return null;
      return { x: g.x, y: g.y };
    });
    expect(ghostSteps.length).toBeGreaterThanOrEqual(MIN_SAMPLES - 1);
    const ghostRatio = selfRatio(ghostSteps, GHOST_SPEED_PER_TICK);
    expect(ghostRatio).toBeGreaterThan(RATIO_LO);
    expect(ghostRatio).toBeLessThan(RATIO_HI);

    // Per-frame bound: no single render frame moves Pac or Blinky more
    // than 3.5× their per-tick speed (CI rAF jitter headroom).
    const pacMax = Math.max(...pacSteps);
    const ghostMax = Math.max(...ghostSteps);
    expect(pacMax).toBeLessThan(PAC_SPEED_PER_TICK * FRAME_BOUND_MULT);
    expect(ghostMax).toBeLessThan(GHOST_SPEED_PER_TICK * FRAME_BOUND_MULT);
  });

  test("frightened tier — self-parity at FRIGHTENED_SPEED_PER_TICK (#145)", async ({
    page,
  }) => {
    // Skip routing Pac through a power pellet — we use a deterministic
    // hook to flip every out-ghost to frightened instead. The render
    // contract doesn't care HOW frightened was entered, only that the
    // per-tile speed downstream matches the constant.
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
    // render channel.
    await page.waitForFunction(() => {
      const api = (window as unknown as {
        __pacInternals?: {
          renderPositions?: () => {
            ghosts: Array<{ mode: string }>;
          };
        };
      }).__pacInternals;
      const snap = api?.renderPositions?.();
      return snap?.ghosts.some((g) => g.mode === "frightened") ?? false;
    });

    const samples = await sampleRenderPositions(page, 80);
    expect(samples.length).toBeGreaterThanOrEqual(MIN_SAMPLES);

    // Pick a ghost that stays frightened through the sample window. We
    // require the FIRST sample's frightened ghost to remain frightened
    // in every subsequent sample we use — drop samples after the mode
    // flips.
    const firstFrightened = samples[0].ghosts.find(
      (g) => g.mode === "frightened",
    );
    expect(firstFrightened, "no frightened ghost in first sample").toBeTruthy();
    const name = firstFrightened!.name;

    // Truncate to the contiguous prefix where this ghost is frightened.
    let cutoff = samples.length;
    for (let i = 0; i < samples.length; i += 1) {
      const g = samples[i].ghosts.find((gg) => gg.name === name);
      if (!g || g.mode !== "frightened") {
        cutoff = i;
        break;
      }
    }
    const window_ = samples.slice(0, cutoff);
    expect(window_.length).toBeGreaterThanOrEqual(MIN_SAMPLES);

    const ghostSteps = stepsFor(window_, (s) => {
      const g = s.ghosts.find((gg) => gg.name === name);
      return g ? { x: g.x, y: g.y } : null;
    });

    const ghostRatio = selfRatio(ghostSteps, FRIGHTENED_SPEED_PER_TICK);
    expect(ghostRatio).toBeGreaterThan(RATIO_LO);
    expect(ghostRatio).toBeLessThan(RATIO_HI);

    const ghostMax = Math.max(...ghostSteps);
    expect(ghostMax).toBeLessThan(FRIGHTENED_SPEED_PER_TICK * FRAME_BOUND_MULT);
  });

  test("eaten tier — eyes-return self-parity at EATEN_SPEED_PER_TICK (#145)", async ({
    page,
  }) => {
    // Warp Blinky into eaten mode via a minimal new probe. The eyes path
    // runs fast (0.20/tick) so the contiguous-eaten window is short —
    // the ghost reaches the revive tile (13,14) and flips back to
    // scatter/chase. We sample enough frames to clear MIN_SAMPLES, then
    // truncate to the contiguous eaten prefix.
    await page.evaluate(() => {
      const api = (window as unknown as {
        __pacInternals?: { setGhostEaten?: (name: string) => void };
      }).__pacInternals;
      if (!api || typeof api.setGhostEaten !== "function") {
        throw new Error(
          "eaten sub-test requires __pacInternals.setGhostEaten() (#145)",
        );
      }
      api.setGhostEaten("blinky");
    });

    // Wait for Blinky to actually be reported as eaten on the render
    // channel — setGhostEaten warps the engine's internal state, but the
    // probe might be polled on the same animation frame before the next
    // engine tick republishes. Polling until mode==='eaten' guarantees
    // the warp has taken effect.
    await page.waitForFunction(() => {
      const api = (window as unknown as {
        __pacInternals?: {
          renderPositions?: () => {
            ghosts: Array<{ name: string; mode: string }>;
          };
        };
      }).__pacInternals;
      const snap = api?.renderPositions?.();
      const blinky = snap?.ghosts.find((g) => g.name === "blinky");
      return blinky?.mode === "eaten";
    });

    // Sample 60 frames — at 0.20/tick the eyes cover ~12 tiles which
    // overshoots the spawn-to-house distance, so we'll truncate to the
    // contiguous eaten prefix before measuring.
    const samples = await sampleRenderPositions(page, 60);
    expect(samples.length).toBeGreaterThanOrEqual(MIN_SAMPLES);

    let cutoff = samples.length;
    for (let i = 0; i < samples.length; i += 1) {
      const g = samples[i].ghosts.find((gg) => gg.name === "blinky");
      if (!g || g.mode !== "eaten") {
        cutoff = i;
        break;
      }
    }
    const window_ = samples.slice(0, cutoff);
    expect(window_.length).toBeGreaterThanOrEqual(MIN_SAMPLES);

    const ghostSteps = stepsFor(window_, (s) => {
      const g = s.ghosts.find((gg) => gg.name === "blinky");
      return g ? { x: g.x, y: g.y } : null;
    });

    const ghostRatio = selfRatio(ghostSteps, EATEN_SPEED_PER_TICK);
    expect(ghostRatio).toBeGreaterThan(RATIO_LO);
    expect(ghostRatio).toBeLessThan(RATIO_HI);

    const ghostMax = Math.max(...ghostSteps);
    expect(ghostMax).toBeLessThan(EATEN_SPEED_PER_TICK * FRAME_BOUND_MULT);
  });

  test("cornering parity — per-frame bound across a direction change (#145)", async ({
    page,
  }) => {
    // Drive Pac through a direction change. The acceptance bar here is
    // the per-frame bound on the commit frame for BOTH actors — a corner
    // shouldn't burst motion above 3.5× the per-tick speed. We don't
    // require Pac to reach a specific tile (that's terrain-dependent and
    // brittle); we just press Up and then Left after a small delay,
    // sample throughout, and verify no actor ever teleports.
    await page.keyboard.press("ArrowUp");
    // Sample a first window during the upward leg.
    const upSamples = await sampleRenderPositions(page, 20);
    await page.keyboard.press("ArrowLeft");
    // Sample a second window covering the direction change + leftward
    // travel.
    const turnSamples = await sampleRenderPositions(page, 30);

    const samples = [...upSamples, ...turnSamples];
    expect(samples.length).toBeGreaterThanOrEqual(MIN_SAMPLES);

    const pacSteps = stepsFor(samples, (s) => s.pac);
    const ghostSteps = stepsFor(samples, (s) => {
      const g = s.ghosts.find((gg) => gg.name === "blinky");
      if (!g) return null;
      // Blinky may flip scatter↔chase during the window; both share
      // GHOST_SPEED_PER_TICK so we don't need to filter on mode for the
      // per-frame bound (we're not asserting a ratio here, only the
      // teleport-free invariant).
      if (g.mode === "frightened" || g.mode === "eaten") return null;
      return { x: g.x, y: g.y };
    });

    expect(pacSteps.length).toBeGreaterThan(0);
    expect(ghostSteps.length).toBeGreaterThan(0);

    const pacMax = Math.max(...pacSteps);
    const ghostMax = Math.max(...ghostSteps);

    // Per-frame bound on the commit frame — neither actor teleports.
    expect(pacMax).toBeLessThan(PAC_SPEED_PER_TICK * FRAME_BOUND_MULT);
    expect(ghostMax).toBeLessThan(GHOST_SPEED_PER_TICK * FRAME_BOUND_MULT);
  });
});
