// Pac-Man input-to-direction-commit latency merge gate (Issue #210).
//
// Mirrors the shipped Galaga fire-probe contract (#168): a sharply
// scoped probe + a numeric bound the harness enforces at merge time.
//
// Contract under test:
//   `pac.queued` is set on keydown by the engine's input binding.
//   `tickPac` step 1 attempts to commit `queued` into `dir` if the
//   neighbor in `queued` is walkable from the CURRENT tile center
//   (pacman/src/game/pacman.ts L122-135). When that commit lands
//   the engine stamps `lastCommitTick`; when the queued write
//   happens, the engine stamps `lastQueuedTick`.
//
// We assert:
//   - p50 of `deltaTicks` (across boundary-aligned presses where the
//     queued dir's neighbor was walkable at press time) is 0 ticks.
//   - p99 of the same population is ≤ 1 tick.
//   - Presses where the queued neighbor was a WALL at press time are
//     filtered out — those are *waits*, not latency. The probe surfaces
//     `viableAtPress: boolean` for the spec to filter on.
//   - Negative `deltaTicks` (impossible / probe-race) are dropped.
//
// Required prior gotchas (from past wakes):
//   - canvas.click() BEFORE page.keyboard.press() — body focus eats
//     keyboard events otherwise.
//   - Wait for engine to be running before sampling.
//   - Use the `__pacInternals` test surface, never reach into private
//     module state.

import { test, expect } from "@playwright/test";

interface DirCommitProbeSample {
  lastQueuedTick: number;
  lastCommitTick: number;
  deltaTicks: number;
  viableAtPress: boolean;
  pressId: number;
}

declare global {
  interface Window {
    __pacInternals?: {
      dirCommitProbe?: () => DirCommitProbeSample | null;
      currentTick?: () => number;
    };
  }
}

const PRESS_COUNT = 30;
const PRESS_GAP_MS = 220;

const ARROW_CYCLE = ["ArrowDown", "ArrowLeft", "ArrowUp", "ArrowRight"] as const;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

test("dir-commit latency: p50 = 0, p99 <= 1 tick (Issue #210)", async ({ page }) => {
  await page.goto("/");

  // Wait for the test surface to attach + engine to be ticking.
  await page.waitForFunction(
    () => typeof window.__pacInternals?.dirCommitProbe === "function",
    null,
    { timeout: 5000 },
  );

  // Focus the canvas — keyboard events go to body otherwise. Known prior
  // gotcha from earlier feel specs (see ghost-glide / Galaga fire).
  const canvas = page.locator("canvas").first();
  await canvas.click();

  // Kick Pac into motion so we hit tile boundaries to test commit at.
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);

  const samples: DirCommitProbeSample[] = [];

  for (let i = 0; i < PRESS_COUNT; i += 1) {
    const key = ARROW_CYCLE[i % ARROW_CYCLE.length];
    await page.keyboard.press(key);
    // Give the engine 2-3 ticks to either commit (same-tick) or pass
    // through a boundary. Cap at ~2 frames so a missed commit is a
    // measurable latency, not a hidden wait.
    await page.waitForTimeout(PRESS_GAP_MS);

    const sample = await page.evaluate(() => {
      const probe = window.__pacInternals?.dirCommitProbe?.();
      return probe ?? null;
    });
    if (sample) samples.push({ ...sample, pressId: i });
  }

  // Defensive: we should have collected at least 20 of the 30. CI rAF
  // jitter sometimes drops a sample, but anything below 20 means the
  // probe wiring is broken — fail loud rather than silently passing.
  expect(samples.length).toBeGreaterThanOrEqual(20);

  // Filter:
  //  1. Drop negative deltas (probe race / stale sample).
  //  2. Drop non-viable-at-press (queued neighbor was a wall → wait).
  const viable = samples.filter(
    (s) => s.deltaTicks >= 0 && s.viableAtPress,
  );

  // We need enough viable samples to compute p99 meaningfully. ARROW_CYCLE
  // alternates UDLR through the maze so most presses land on a viable
  // neighbor; if fewer than 10 survive the filter, something is wrong
  // with the spawn path or the probe's viableAtPress flag.
  expect(viable.length).toBeGreaterThanOrEqual(10);

  const deltas = viable.map((s) => s.deltaTicks).sort((a, b) => a - b);
  const p50 = percentile(deltas, 50);
  const p99 = percentile(deltas, 99);

  // The contract: a press whose target tile is walkable from Pac's
  // current tile must commit on the very next tick. Same-tick commit
  // (deltaTicks === 0) is what `tickPac` step 1 promises.
  expect(p50, `p50 deltaTicks (got ${p50}, all: ${deltas.join(",")})`).toBeLessThanOrEqual(0);
  expect(p99, `p99 deltaTicks (got ${p99}, all: ${deltas.join(",")})`).toBeLessThanOrEqual(1);
});
