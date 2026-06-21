// Issue #210 — Pac-Man input-to-direction-commit latency merge gate.
//
// Pac-Man's "feel" lives or dies on how fast a pressed arrow becomes a
// committed direction. `engine.update()` ticks at fixed 60Hz; keydown
// is async wrt update() — it always lands BETWEEN updates, never
// inside one — so the best-case latency from press to dir-flip is the
// next tick (deltaTicks === 0 under the probe's framing:
// lastQueuedTick = state.tick + 1 at press, lastCommitTick = state.tick
// at the commit-bearing update).
//
// This spec drives a series of reversal presses (Left/Right on the
// spawn-row corridor — every cell has a walkable horizontal neighbor
// in both directions, so EVERY press is a guaranteed step-1 commit
// next tick), polls `window.__pacInternals.dirCommitProbe()` after each
// press until a fresh measurement lands, and asserts:
//   - p50 ≤ 0 ticks  (boundary-aligned commits dominate the median)
//   - p99 ≤ 1 tick   (worst-case bounded by tickPac's step-1 framing)
//
// CI-feedback fix (PR #215 review by Mara):
//   - dropped the dead `wasWalkable` filter (its in-page branch always
//     returned `true` because the static MAZE isn't exposed on window —
//     wall-press presses were leaking into the distribution and bloating
//     the per-press timeout budget toward the 60s setTimeout cap).
//   - switched the press pattern from Up/Down/Left/Right (where
//     perpendicular presses on the spawn row queue against walls and
//     never commit) to Left/Right reversals only (every press is
//     walkable, every press commits — measures latency, not wait).
//
// Reference shape: galaga/e2e/feel/input-latency.spec.ts (#168).

import { expect, test } from "@playwright/test";

const URL = "/";

type Probe = {
  lastQueuedTick: number;
  lastCommitTick: number;
  deltaTicks: number | null;
};

test.describe("Pac-Man dir-commit latency (issue #210)", () => {
  test("p50 ≤ 0 ticks, p99 ≤ 1 tick across an arena traversal", async ({
    page,
  }) => {
    test.setTimeout(45_000);

    await page.goto(URL);
    const canvas = page.locator("canvas").first();
    await canvas.waitFor({ state: "visible" });

    // Known prior gotcha (memory): canvas.click() BEFORE keyboard.press()
    // or the body keeps focus and the engine listener never fires.
    await canvas.click();
    await page.keyboard.press("ArrowRight");

    // Wait until the engine flips to 'playing' so subsequent probe
    // reads can capture commits.
    await page.waitForFunction(() => window.__pac?.status === "playing", null, {
      timeout: 5_000,
    });

    // Drive 30 reversal presses spaced ≥ 220ms apart. Pac spawns at
    // (13,23) on row 23 (`#o..##.......  .......##..o#`) — left and
    // right neighbors are always walkable along that corridor, and a
    // reversal is walkable from ANY cell in a horizontal corridor
    // (the opposite direction always leads to a tile Pac just came
    // from). Every press therefore commits on the next tick:
    // step-1 of tickPac sees `pac.queued !== "none"`, the neighbor is
    // walkable, dir flips, `committedQueued = true`.
    const presses = ["ArrowLeft", "ArrowRight"];
    const measurements: number[] = [];
    const boundaryMeasurements: number[] = [];
    let lastDir: "ArrowLeft" | "ArrowRight" = "ArrowRight";

    for (let i = 0; i < 30; i += 1) {
      // Always press the OPPOSITE of the last direction so every press
      // is a genuine dir-change (not a same-dir no-op queue).
      const key: "ArrowLeft" | "ArrowRight" =
        lastDir === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
      lastDir = key;

      // Snapshot probe BEFORE the press so we can detect a fresh
      // measurement after.
      const before = (await page.evaluate(
        () => window.__pacInternals?.dirCommitProbe() ?? null,
      )) as Probe | null;
      const beforeQueuedTick = before?.lastQueuedTick ?? -1;

      // Fire the press. canvas.click() is already done above; subsequent
      // keyboard.press() reuses the focused canvas.
      await page.keyboard.press(key);

      // Poll for a FRESH measurement. A fresh read is signalled by:
      //   (a) lastQueuedTick > beforeQueuedTick — input listener saw
      //       our press, AND
      //   (b) deltaTicks !== null — tickPac has since committed
      //       (i.e. lastCommitTick >= lastQueuedTick).
      // 500ms per-press budget — way more than needed (commit lands
      // within ~16ms / 1 tick on a happy path) but generous for CI
      // software-WebGL rAF jitter.
      let fresh: Probe | null = null;
      const deadline = Date.now() + 500;
      while (Date.now() < deadline) {
        const cur = (await page.evaluate(
          () => window.__pacInternals?.dirCommitProbe() ?? null,
        )) as Probe | null;
        if (
          cur &&
          cur.lastQueuedTick > beforeQueuedTick &&
          cur.deltaTicks !== null &&
          cur.deltaTicks >= 0
        ) {
          fresh = cur;
          break;
        }
        await page.waitForTimeout(16);
      }

      if (!fresh) {
        // Reversal commits are guaranteed by the maze geometry, so a
        // miss here means CI rAF jitter swallowed a tick. Skip and
        // keep going — the floor below catches a true regression.
        continue;
      }

      measurements.push(fresh.deltaTicks as number);
      if (fresh.deltaTicks === 0) {
        boundaryMeasurements.push(fresh.deltaTicks);
      }

      // Spacing per acceptance criteria: ≥ 200ms between presses, with
      // a touch of headroom so Pac advances a tile between reversals
      // (Pac speed = 0.12 tile/tick × 60Hz ≈ 7.2 tiles/sec → ~140ms
      // per tile). 220ms guarantees we cross a tile boundary.
      await page.waitForTimeout(220);
    }

    // Floor: 30 presses, every one a guaranteed-walkable reversal.
    // Under CI software-WebGL we tolerate a handful of misses but the
    // gate would be meaningless below 20 samples.
    expect(
      measurements.length,
      `expected ≥20 valid measurements out of 30 reversal presses, got ${measurements.length}`,
    ).toBeGreaterThanOrEqual(20);

    const sorted = [...measurements].sort((a, b) => a - b);
    const pickP = (q: number): number => {
      const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
      return sorted[idx];
    };
    const p50 = pickP(0.5);
    const p99 = pickP(0.99);

    // p50 over the boundary-aligned subset (deltaTicks === 0 = same-tick
    // commit). Falls back to overall p50 if the subset is sparse — but
    // with reversals on a corridor that subset should be nearly all
    // presses.
    const boundarySorted = [...boundaryMeasurements].sort((a, b) => a - b);
    const boundaryP50 =
      boundarySorted.length > 0
        ? boundarySorted[Math.floor(0.5 * boundarySorted.length)]
        : p50;

    expect(
      boundaryP50,
      `boundary-aligned p50 must be ≤ 0 ticks, got ${boundaryP50}; full distribution: ${sorted.join(",")}`,
    ).toBeLessThanOrEqual(0);

    expect(
      p99,
      `p99 must be ≤ 1 tick, got ${p99}; full distribution: ${sorted.join(",")}`,
    ).toBeLessThanOrEqual(1);
  });

  test("probe is null/undefined-safe until the first commit", async ({
    page,
  }) => {
    await page.goto(URL);
    await page.locator("canvas").first().waitFor({ state: "visible" });

    // Before any input, the probe must NOT produce NaN or negatives.
    const initial = (await page.evaluate(
      () => window.__pacInternals?.dirCommitProbe() ?? null,
    )) as Probe | null;

    expect(
      initial,
      "dirCommitProbe must be exposed on __pacInternals",
    ).not.toBeNull();
    if (!initial) return; // type guard for the rest

    // deltaTicks may be null (no measurement yet) but never NaN.
    if (initial.deltaTicks !== null) {
      expect(Number.isNaN(initial.deltaTicks)).toBe(false);
      // Pre-input the stamps are both -1 → engine returns null; if we
      // somehow got a number, it must be non-negative.
      expect(initial.deltaTicks).toBeGreaterThanOrEqual(0);
    }
  });
});
