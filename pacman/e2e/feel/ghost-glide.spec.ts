// Ghost-glide feel parity spec (#145, extending #137).
//
// The render layer interpolates Pac and ghosts between integer tile commits
// using `_progress: 0..1`. This spec asserts that the per-frame visual
// motion of ghosts tracks Pac's at the same normalized rate — within a
// tight ratio band — across THREE tiers and the cornering case:
//
//   1. straight-corridor normal (scatter/chase)  — NORMAL_SPEED_PER_TICK
//   2. frightened (post power pellet)            — FRIGHTENED_SPEED_PER_TICK
//   3. eaten / eyes returning                    — EATEN_SPEED_PER_TICK
//   4. cornering parity                          — per-frame bound on commit
//
// PRECONDITION: this file depends on `__pacInternals.renderPositions()` —
// a read-only probe that returns the float sub-tile draw positions for Pac
// and every ghost (mirroring renderPac / renderGhosts math). That probe is
// landed by #137. If it is absent at runtime, every sub-test fails fast
// with a clear message — easier to diagnose than a silent NaN propagation.
//
// This file also depends on `__pacInternals.setGhostEaten(name)` to warp a
// ghost into eyes-return mode without racing the live AI. Spec-only hook,
// minimal surface.

import { test, expect, type Page } from "@playwright/test";

// Per-tick normalized advance for each mode. These are the engine's
// authoritative speeds; if engine constants drift, this spec must drift
// with them in lockstep — that's the contract.
const NORMAL_SPEED_PER_TICK = 0.08;
const FRIGHTENED_SPEED_PER_TICK = 0.05;
const EATEN_SPEED_PER_TICK = 0.2;
const PAC_SPEED_PER_TICK = 0.08;

// Acceptance bands.
const RATIO_LO = 0.95;
const RATIO_HI = 1.05;
// Per-frame bound: the float draw position must not advance by more than
// (speed_per_tick * 3.5) on any single render frame — accounts for
// software-WebGL rAF jitter in CI (the 3.5x headroom mirrors the pacman
// e2e feel-spec convention I locked in across the suite).
const FRAME_BOUND_MULT = 3.5;

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
// for an actor. Pac's step uses the pac field; a ghost's step indexes by name.
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

test.describe("ghost-glide feel parity (#137 + #145)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.__pacInternals));
    // First input: nudge Pac so the engine flips 'ready' → 'playing'.
    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction(() => window.__pac?.status === "playing");
  });

  test("normal tier — straight-corridor parity", async ({ page }) => {
    // Pac glides left along row 23 from a clean tile-center commit.
    // Sample ~48 logical frames (~800ms wall time on a 60Hz tick).
    const samples = await sampleRenderPositions(page, 60);
    expect(samples.length).toBeGreaterThanOrEqual(20);

    const pacSteps = stepsFor(samples, (s) => s.pac);
    const pacNormalized = sum(pacSteps) / PAC_SPEED_PER_TICK;

    // Pick a single chase/scatter ghost present in all samples. Blinky is
    // out from boot, so it's the safe pick.
    const blinkyOf = (s: RenderSample) =>
      s.ghosts.find((g) => g.name === "blinky") ?? null;
    const ghostSteps = stepsFor(samples, (s) => {
      const g = blinkyOf(s);
      return g ? { x: g.x, y: g.y } : null;
    });
    const ghostNormalized = sum(ghostSteps) / NORMAL_SPEED_PER_TICK;

    const ratio = ghostNormalized / pacNormalized;
    expect(ratio).toBeGreaterThan(RATIO_LO);
    expect(ratio).toBeLessThan(RATIO_HI);

    // Per-frame bound: no single render frame moves Pac or Blinky more
    // than 3.5× their per-tick speed (CI rAF jitter headroom).
    const pacMax = Math.max(...pacSteps);
    const ghostMax = Math.max(...ghostSteps);
    expect(pacMax).toBeLessThan(PAC_SPEED_PER_TICK * FRAME_BOUND_MULT);
    expect(ghostMax).toBeLessThan(NORMAL_SPEED_PER_TICK * FRAME_BOUND_MULT);
  });

  test("frightened tier — parity at FRIGHTENED_SPEED_PER_TICK (#145)", async ({
    page,
  }) => {
    // Drive Pac to a power pellet. The closest one to spawn (13, 23) is at
    // (1, 3) — top-left. We use a deterministic test hook to flip every
    // out-ghost to frightened instead of routing a 30-tile chase from the
    // e2e (which fights the AI on slow CI). The render parity contract
    // doesn't care HOW frightened was entered — only that the per-tile
    // speed observed downstream matches the constant.
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

    const samples = await sampleRenderPositions(page, 60);
    expect(samples.length).toBeGreaterThanOrEqual(20);

    // Pick a ghost that stays frightened through the sample window. We
    // require the FIRST sample's frightened ghost to remain frightened in
    // every subsequent sample we use — drop samples after the mode flips.
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
    expect(window_.length).toBeGreaterThanOrEqual(20);

    const pacSteps = stepsFor(window_, (s) => s.pac);
    const ghostSteps = stepsFor(window_, (s) => {
      const g = s.ghosts.find((gg) => gg.name === name);
      return g ? { x: g.x, y: g.y } : null;
    });

    const pacNormalized = sum(pacSteps) / PAC_SPEED_PER_TICK;
    const ghostNormalized = sum(ghostSteps) / FRIGHTENED_SPEED_PER_TICK;
    const ratio = ghostNormalized / pacNormalized;
    expect(ratio).toBeGreaterThan(RATIO_LO);
    expect(ratio).toBeLessThan(RATIO_HI);

    const ghostMax = Math.max(...ghostSteps);
    expect(ghostMax).toBeLessThan(FRIGHTENED_SPEED_PER_TICK * FRAME_BOUND_MULT);
  });

  test("eaten tier — eyes-return parity at EATEN_SPEED_PER_TICK (#145)", async ({
    page,
  }) => {
    // Warp Blinky into eaten mode via a minimal new probe. The eyes path
    // runs fast (0.20/tick) so we expect a SHORT sample window before the
    // ghost reaches the house and flips back — sample 30 frames, then
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

    await page.waitForFunction(() => {
      const api = (window as unknown as {
        __pacInternals?: {
          renderPositions?: () => {
            ghosts: Array<{ name: string; mode: string }>;
          };
        };
      }).__pacInternals;
      const snap = api?.renderPositions?.();
      return (
        snap?.ghosts.find((g) => g.name === "blinky")?.mode === "eaten" ?? false
      );
    });

    const samples = await sampleRenderPositions(page, 30);
    expect(samples.length).toBeGreaterThanOrEqual(10);

    let cutoff = samples.length;
    for (let i = 0; i < samples.length; i += 1) {
      const g = samples[i].ghosts.find((gg) => gg.name === "blinky");
      if (!g || g.mode !== "eaten") {
        cutoff = i;
        break;
      }
    }
    const window_ = samples.slice(0, cutoff);
    expect(window_.length).toBeGreaterThanOrEqual(10);

    const pacSteps = stepsFor(window_, (s) => s.pac);
    const ghostSteps = stepsFor(window_, (s) => {
      const g = s.ghosts.find((gg) => gg.name === "blinky");
      return g ? { x: g.x, y: g.y } : null;
    });

    const pacNormalized = sum(pacSteps) / PAC_SPEED_PER_TICK;
    const ghostNormalized = sum(ghostSteps) / EATEN_SPEED_PER_TICK;
    const ratio = ghostNormalized / pacNormalized;
    // Eyes can momentarily idle on a junction-decision frame; widen the
    // floor slightly. Ceiling stays tight — the engine should never
    // OVERSHOOT 0.20/tick.
    expect(ratio).toBeGreaterThan(RATIO_LO);
    expect(ratio).toBeLessThan(RATIO_HI);

    const ghostMax = Math.max(...ghostSteps);
    expect(ghostMax).toBeLessThan(EATEN_SPEED_PER_TICK * FRAME_BOUND_MULT);
  });

  test("cornering parity — per-frame bound across a corner (#145)", async ({
    page,
  }) => {
    // Drive Pac through a corner: spawn (13,23) → up to (13,20) → left.
    // Sample throughout. The acceptance bar here is the per-frame bound
    // on the commit frame for BOTH actors — cornering shouldn't burst
    // motion above 3.5× the per-tick speed.
    await page.keyboard.press("ArrowUp");
    // Let Pac advance several tiles upward.
    await page.waitForFunction(
      () => (window.__pac?.pac.y ?? 99) <= 21,
      undefined,
      { timeout: 5000 },
    );
    await page.keyboard.press("ArrowLeft");

    const samples = await sampleRenderPositions(page, 40);
    expect(samples.length).toBeGreaterThanOrEqual(15);

    const pacSteps = stepsFor(samples, (s) => s.pac);
    const ghostSteps = stepsFor(samples, (s) => {
      const g = s.ghosts.find((gg) => gg.name === "blinky");
      return g ? { x: g.x, y: g.y } : null;
    });

    const pacMax = Math.max(...pacSteps);
    const ghostMax = Math.max(...ghostSteps);

    // Per-frame bound on the commit frame — neither actor teleports.
    expect(pacMax).toBeLessThan(PAC_SPEED_PER_TICK * FRAME_BOUND_MULT);
    expect(ghostMax).toBeLessThan(NORMAL_SPEED_PER_TICK * FRAME_BOUND_MULT);
  });
});
