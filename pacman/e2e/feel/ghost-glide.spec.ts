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
// each actor's total Euclidean displacement over N logical ticks should
// equal (SPEED_PER_TICK * N) within a tolerance band that absorbs
// CI rAF jitter.
//
// CORRECTION over the second draft: software-WebGL on CI runs rAF below
// 60Hz, but the engine still ticks at fixed 60Hz via an accumulator —
// one rAF can drain MULTIPLE update() calls. So consecutive renderPositions
// samples can have tick deltas of 2 or 3. The ratio MUST normalize by
// the actual tick-delta sum, not the gap count. The per-frame bound is
// likewise expressed per-tick.
//
// CORRECTION over the third draft (#148, this round — Mara's 3rd review):
// the CI failure shape (logs 401 from here) was unrecoverable from the
// outside, so this revision defuses every concrete failure mode I could
// identify from re-reading the engine + the maze:
//   (a) beforeEach now clicks the canvas BEFORE pressing a key — every
//       known-green keyboard-driven pacman spec does this; without it
//       the keydown can fail to land on the engine's window listener
//       and the 'ready' → 'playing' wait hangs to test timeout.
//   (b) renderPositions now reports pac.dir; the normal-tier sampler
//       TRUNCATES to the contiguous prefix where Pac is still moving.
//       From spawn (13,23) Pac walks left ~7 tiles before hitting the
//       wall at x=5 — at 0.12/tick that's ~58 ticks, well inside a
//       60-frame sample window once rAF drains multiple ticks per
//       frame on software-WebGL CI. Without truncation, post-stop
//       zero-displacement frames pull the self-ratio below RATIO_LO.
//   (c) eaten tier: the eyes-return is fundamentally a 15-tick window
//       (Blinky spawn (13,11) → REVIVE_TILE (13,14), 3 tiles ×
//       5 ticks/tile at 0.20/tick). MIN_SAMPLES dropped to 4 for this
//       tier — any more is structurally impossible. MIN_TOTAL_TICKS
//       stays at 6 (enough for a meaningful ratio).
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
// (speed_per_tick * 3.5) per LOGICAL TICK on any single render frame —
// expressed per-tick because one rAF can carry 1, 2, or 3 update() calls
// under software-WebGL on CI. With multiple ticks per frame the raw step
// scales linearly; the per-tick rate is the actual invariant.
const FRAME_BOUND_MULT = 3.5;

// Minimum logical-tick samples required before computing a ratio in the
// normal + frightened tiers. The eaten tier has a hard structural ceiling
// (~15-tick window) and uses MIN_SAMPLES_EATEN below.
const MIN_SAMPLES = 8;
const MIN_SAMPLES_EATEN = 4;
// Minimum total ticks observed across a sub-test before computing a
// ratio. This decouples sample-count (rAF-dependent) from logical-tick
// coverage (engine-determined) — a slow rAF that yielded only 8 samples
// might still cover 16 ticks, which is plenty for the ratio.
const MIN_TOTAL_TICKS = 10;
const MIN_TOTAL_TICKS_EATEN = 6;

type RenderSample = {
  tick: number;
  pac: { x: number; y: number; dir: string };
  ghosts: Array<{ name: string; x: number; y: number; mode: string }>;
};

// Sampler: poll renderPositions every animation frame for N frames, return
// the chronological array. We sample by tick — consecutive frames with the
// same tick are deduped (one logical step = one sample). Frames where the
// tick has ADVANCED BY >1 are kept (their tick delta is captured in the
// sample, used downstream to normalize the ratio).
async function sampleRenderPositions(
  page: Page,
  frames: number,
): Promise<RenderSample[]> {
  return await page.evaluate(async (n: number) => {
    const api = (window as unknown as {
      __pacInternals?: {
        renderPositions?: () => {
          tick: number;
          pac: { x: number; y: number; dir: string };
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
      pac: { x: number; y: number; dir: string };
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

// Truncate a sample array to the contiguous prefix matching a predicate.
// The FIRST sample that fails the predicate (and everything after it) is
// dropped. Used to slice off post-stop frames — once Pac hits a wall its
// dir flips to 'none' and renderPositions reports zero displacement
// forever; averaging that into a ratio pulls it below RATIO_LO.
function takeWhile<T>(arr: T[], pred: (t: T) => boolean): T[] {
  let cutoff = arr.length;
  for (let i = 0; i < arr.length; i += 1) {
    if (!pred(arr[i])) {
      cutoff = i;
      break;
    }
  }
  return arr.slice(0, cutoff);
}

// A per-gap measurement: displacement between two consecutive samples and
// the number of logical ticks the engine advanced across that gap. Under
// 60Hz rAF dTick is normally 1; under software-WebGL CI rAF, dTick can
// be 2 or 3 (the engine's fixed-step accumulator drains multiple updates
// per frame).
type StepMeasurement = { displacement: number; dTick: number };

// Compute Euclidean step length AND tick-delta between consecutive samples
// for an actor. Returns null for any gap where the picker can't extract
// a position (e.g. ghost not in roster, mode mismatch) — those gaps are
// skipped from the resulting steps array.
function stepsFor(
  samples: RenderSample[],
  pick: (s: RenderSample) => { x: number; y: number } | null,
): StepMeasurement[] {
  const out: StepMeasurement[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const a = pick(samples[i - 1]);
    const b = pick(samples[i]);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dTick = samples[i].tick - samples[i - 1].tick;
    // dTick should be >= 1 because the sampler dedups equal ticks; skip
    // any pathological zero-or-negative gap defensively.
    if (dTick <= 0) continue;
    out.push({ displacement: Math.hypot(dx, dy), dTick });
  }
  return out;
}

// Self-ratio: total displacement vs (per-tick speed × total tick delta).
// 1.0 = perfect tracking; 0.0 = stalled; >1 = overshoot. Normalises by
// the actual tick count, not the gap count — so rAF that bundles 2 ticks
// per frame doesn't artificially halve the ratio.
function selfRatio(steps: StepMeasurement[], speedPerTick: number): number {
  if (steps.length === 0) return 0;
  const totalDisp = steps.reduce((a, s) => a + s.displacement, 0);
  const totalTicks = steps.reduce((a, s) => a + s.dTick, 0);
  if (totalTicks === 0) return 0;
  return totalDisp / (speedPerTick * totalTicks);
}

// Per-tick max rate across all gaps: max(displacement / dTick). The
// teleport-free invariant: this should never exceed speed_per_tick *
// FRAME_BOUND_MULT, regardless of how many ticks the engine drained
// in a single rAF.
function maxPerTickRate(steps: StepMeasurement[]): number {
  if (steps.length === 0) return 0;
  let max = 0;
  for (const s of steps) {
    const rate = s.displacement / s.dTick;
    if (rate > max) max = rate;
  }
  return max;
}

// Total logical ticks covered by an array of step measurements.
function totalTicks(steps: StepMeasurement[]): number {
  return steps.reduce((a, s) => a + s.dTick, 0);
}

test.describe("ghost-glide feel parity (#137 + #145)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.__pacInternals));
    // Focus the canvas BEFORE dispatching keyboard input — matches every
    // known-green keyboard-driven pacman spec. Without it, the keydown
    // can miss the engine's window listener and the 'playing' wait hangs.
    await page.locator("canvas").click();
    // First input: nudge Pac so the engine flips 'ready' → 'playing'.
    // From spawn (13,23) ArrowLeft is walkable along row 23.
    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction(() => window.__pac?.status === "playing");
  });

  test("normal tier — straight-corridor self-parity", async ({ page }) => {
    // Pac glides left along row 23 from a clean tile-center commit.
    // Sample ~60 frames (~1s wall time on a 60Hz tick; ~2s under
    // software-WebGL CI rAF at 30fps). Note: from (13,23) Pac walks
    // left ~7 tiles before hitting the wall at x=5 — under multi-tick
    // rAF this can happen well inside the sample window. We truncate
    // below to the moving prefix.
    const allSamples = await sampleRenderPositions(page, 60);
    // Drop frames after Pac stops (wall-stop sets dir='none'). The
    // moving prefix is what the self-ratio applies to — Blinky keeps
    // moving regardless of Pac, so the ghost branch uses the full
    // sample window.
    const pacMovingSamples = takeWhile(allSamples, (s) => s.pac.dir !== "none");
    expect(
      pacMovingSamples.length,
      "Pac stopped before producing a measurable sample window — sample early or grow MIN_SAMPLES floor downward",
    ).toBeGreaterThanOrEqual(MIN_SAMPLES);

    const pacSteps = stepsFor(pacMovingSamples, (s) => s.pac);
    expect(totalTicks(pacSteps)).toBeGreaterThanOrEqual(MIN_TOTAL_TICKS);
    const pacRatio = selfRatio(pacSteps, PAC_SPEED_PER_TICK);
    expect(pacRatio).toBeGreaterThan(RATIO_LO);
    expect(pacRatio).toBeLessThan(RATIO_HI);

    // Blinky boots already out so it's always sampled. The engine flips
    // scatter↔chase every MODE_PERIOD_TICKS, but BOTH modes use
    // GHOST_SPEED_PER_TICK so we don't need to split on the flip.
    const blinkyOf = (s: RenderSample) =>
      s.ghosts.find((g) => g.name === "blinky") ?? null;
    const ghostSteps = stepsFor(allSamples, (s) => {
      const g = blinkyOf(s);
      if (!g) return null;
      if (g.mode !== "scatter" && g.mode !== "chase") return null;
      return { x: g.x, y: g.y };
    });
    expect(totalTicks(ghostSteps)).toBeGreaterThanOrEqual(MIN_TOTAL_TICKS);
    const ghostRatio = selfRatio(ghostSteps, GHOST_SPEED_PER_TICK);
    expect(ghostRatio).toBeGreaterThan(RATIO_LO);
    expect(ghostRatio).toBeLessThan(RATIO_HI);

    // Per-tick rate bound: no actor advances faster than 3.5× its
    // per-tick speed per logical tick (CI rAF jitter headroom).
    expect(maxPerTickRate(pacSteps)).toBeLessThan(
      PAC_SPEED_PER_TICK * FRAME_BOUND_MULT,
    );
    expect(maxPerTickRate(ghostSteps)).toBeLessThan(
      GHOST_SPEED_PER_TICK * FRAME_BOUND_MULT,
    );
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
    const window_ = takeWhile(samples, (s) => {
      const g = s.ghosts.find((gg) => gg.name === name);
      return Boolean(g && g.mode === "frightened");
    });
    expect(window_.length).toBeGreaterThanOrEqual(MIN_SAMPLES);

    const ghostSteps = stepsFor(window_, (s) => {
      const g = s.ghosts.find((gg) => gg.name === name);
      return g ? { x: g.x, y: g.y } : null;
    });
    expect(totalTicks(ghostSteps)).toBeGreaterThanOrEqual(MIN_TOTAL_TICKS);

    const ghostRatio = selfRatio(ghostSteps, FRIGHTENED_SPEED_PER_TICK);
    expect(ghostRatio).toBeGreaterThan(RATIO_LO);
    expect(ghostRatio).toBeLessThan(RATIO_HI);

    expect(maxPerTickRate(ghostSteps)).toBeLessThan(
      FRIGHTENED_SPEED_PER_TICK * FRAME_BOUND_MULT,
    );
  });

  test("eaten tier — eyes-return self-parity at EATEN_SPEED_PER_TICK (#145)", async ({
    page,
  }) => {
    // Warp Blinky into eaten mode via a minimal new probe. The eyes path
    // is short: from Blinky's spawn (13,11) to REVIVE_TILE (13,14) is
    // only 3 tiles × 5 ticks/tile = 15 ticks at 0.20/tick. We sample
    // aggressively and truncate to the contiguous eaten prefix.
    // MIN_SAMPLES_EATEN (4) reflects the structural ceiling — there is
    // no way to get 8 unique-tick samples out of a 15-tick window when
    // CI rAF drains 2-3 ticks per frame.
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

    // Sample 40 frames — at 0.20/tick the eyes-return is ~15 ticks
    // (3 tiles × 5 ticks/tile). 40 rAF frames covers ~40 ticks at 60Hz
    // or ~80 ticks at 30Hz software-WebGL, both ample to clear the
    // window. We truncate to the contiguous eaten prefix before
    // measuring.
    const samples = await sampleRenderPositions(page, 40);
    expect(samples.length).toBeGreaterThanOrEqual(MIN_SAMPLES_EATEN);

    const window_ = takeWhile(samples, (s) => {
      const g = s.ghosts.find((gg) => gg.name === "blinky");
      return Boolean(g && g.mode === "eaten");
    });
    expect(window_.length).toBeGreaterThanOrEqual(MIN_SAMPLES_EATEN);

    const ghostSteps = stepsFor(window_, (s) => {
      const g = s.ghosts.find((gg) => gg.name === "blinky");
      return g ? { x: g.x, y: g.y } : null;
    });
    expect(totalTicks(ghostSteps)).toBeGreaterThanOrEqual(MIN_TOTAL_TICKS_EATEN);

    const ghostRatio = selfRatio(ghostSteps, EATEN_SPEED_PER_TICK);
    expect(ghostRatio).toBeGreaterThan(RATIO_LO);
    expect(ghostRatio).toBeLessThan(RATIO_HI);

    expect(maxPerTickRate(ghostSteps)).toBeLessThan(
      EATEN_SPEED_PER_TICK * FRAME_BOUND_MULT,
    );
  });

  test("cornering parity — per-tick bound across a direction change (#145)", async ({
    page,
  }) => {
    // Drive Pac through a direction change. The acceptance bar here is
    // the per-tick rate bound for BOTH actors — a corner shouldn't burst
    // motion above 3.5× the per-tick speed. We don't require Pac to reach
    // a specific tile (that's terrain-dependent and brittle); we just
    // press Up and then Left after a small delay, sample throughout,
    // and verify no actor ever teleports. NOTE: at (13,23) the tile
    // above is a wall — ArrowUp queues but only fires once Pac reaches
    // a tile where up is walkable (e.g. (12,23)). That's fine; we only
    // assert the per-tick bound, which holds whether or not Pac actually
    // turns.
    await page.keyboard.press("ArrowUp");
    // Sample a first window during the upward leg.
    const upSamples = await sampleRenderPositions(page, 20);
    await page.keyboard.press("ArrowLeft");
    // Sample a second window covering the direction change + leftward
    // travel.
    const turnSamples = await sampleRenderPositions(page, 30);

    const samples = [...upSamples, ...turnSamples];
    expect(samples.length).toBeGreaterThanOrEqual(MIN_SAMPLES);

    // Pac-step extraction is OK to compute over all samples here — even
    // post-stop frames have displacement=0 and dTick>=1, which can only
    // LOWER maxPerTickRate. The assertion is one-sided (no teleport),
    // so wall-parking is harmless to this sub-test.
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

    // Per-tick rate bound on the commit frame — neither actor teleports
    // across a corner, regardless of how many ticks the engine drained
    // in one rAF.
    expect(maxPerTickRate(pacSteps)).toBeLessThan(
      PAC_SPEED_PER_TICK * FRAME_BOUND_MULT,
    );
    expect(maxPerTickRate(ghostSteps)).toBeLessThan(
      GHOST_SPEED_PER_TICK * FRAME_BOUND_MULT,
    );
  });
});
