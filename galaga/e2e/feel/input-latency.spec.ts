// Galaga input-to-fire latency merge gate — #168.
//
// Asserts that the gap between Space keydown and the engine tick on which
// the player projectile is pushed into the bullet array is ≤ 1 tick at p99
// across 30 fire events. A median of 2 ticks (or worse) signals a
// structural deferral in the update phase and would fail the bar.
//
// Pattern is lifted directly from #137's Pac-Man renderPositions probe +
// e2e gate — same shape, different game, different invariant.
//
// Probe contract: window.__galagaInternals.fireProbe() returns the most
// recent keydown → projectile-spawn delta in ticks, or null before the
// first fire. Implementation lives in galaga/src/game/engine.ts and
// galaga/src/game/input.ts (see #168 comment for the routing anchors).
//
// Critical: canvas.click() BEFORE the first page.keyboard.press('Space').
// Body focus drops keydown events under Playwright (hard-won lesson from
// prior Pac-Man e2e spec attempts).

import { expect, test } from "@playwright/test";

interface FireProbe {
  lastKeydownTick: number;
  lastProjectileSpawnTick: number;
  deltaTicks: number;
}

interface GalagaInternals {
  fireProbe?: () => FireProbe | null;
}

interface GameStateLike {
  status: string;
}

declare global {
  interface Window {
    __galaga?: GameStateLike;
    __galagaInternals?: GalagaInternals;
  }
}

const FIRE_COUNT = 30;
const FIRE_GAP_MS = 220; // > arcade-spec player cooldown so the gate measures input→spawn, not cooldown→spawn
const PROBE_WAIT_MS = 2000;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

test.describe("galaga input-to-fire latency (#168)", () => {
  test("p50 and p99 ≤ 1 tick across 30 fires", async ({ page }) => {
    await page.goto("/");

    await page.waitForFunction(() => window.__galaga !== undefined, null, {
      timeout: 5000,
    });
    await page.waitForFunction(() => Boolean(window.__galagaInternals), null, {
      timeout: 5000,
    });

    // First input flips READY → playing. canvas.click() also gives the
    // engine listener focus so subsequent keyboard.press('Space') events
    // are observed by the keyboard input source.
    await page.locator("canvas").first().click();
    await page.waitForFunction(() => window.__galaga?.status === "playing", null, {
      timeout: 5000,
    });

    // Probe must exist; if not, the implementation hasn't landed yet and
    // this test must fail loudly.
    const probeExists = await page.evaluate(
      () => typeof window.__galagaInternals?.fireProbe === "function",
    );
    expect(probeExists, "window.__galagaInternals.fireProbe must exist").toBe(true);

    const deltas: number[] = [];

    for (let i = 0; i < FIRE_COUNT; i++) {
      // Capture lastKeydownTick BEFORE this press so we can wait for it to
      // advance — that's the deterministic "this press was observed" signal.
      const before = await page.evaluate(
        () => window.__galagaInternals!.fireProbe?.()?.lastKeydownTick ?? -1,
      );

      await page.keyboard.press("Space");

      // Wait until fireProbe reports a new spawn (lastProjectileSpawnTick
      // distinct from before, and lastKeydownTick advanced).
      await page.waitForFunction(
        (prevKeydownTick: number) => {
          const probe = window.__galagaInternals?.fireProbe?.();
          return probe !== null && probe !== undefined && probe.lastKeydownTick > prevKeydownTick;
        },
        before,
        { timeout: PROBE_WAIT_MS },
      );

      const sample = await page.evaluate(() => window.__galagaInternals!.fireProbe?.());
      expect(sample, `fire ${i}: probe returned null after observed keydown advance`).not.toBeNull();
      expect(sample, `fire ${i}: probe returned undefined`).toBeDefined();
      deltas.push(sample!.deltaTicks);

      await page.waitForTimeout(FIRE_GAP_MS);
    }

    const sorted = [...deltas].sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    const p99 = percentile(sorted, 99);

    // Useful failure context: dump the full sample so a regression shows
    // not just "p99=3" but the shape (one outlier vs. systemic drift).
    const summary = {
      n: deltas.length,
      p50,
      p99,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      samples: deltas,
    };
    console.log("[input-latency] " + JSON.stringify(summary));

    expect(p50, `p50 must be ≤ 1 tick (got ${p50}); samples=${JSON.stringify(deltas)}`).toBeLessThanOrEqual(1);
    expect(p99, `p99 must be ≤ 1 tick (got ${p99}); samples=${JSON.stringify(deltas)}`).toBeLessThanOrEqual(1);
  });
});
