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
import type { GalagaInternals, GameState } from "../../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
    __galagaInternals?: GalagaInternals;
  }
}

const FIRE_COUNT = 30;
// Minimum gap between presses. Player bullets travel ~6 px/tick up a 408 px
// field → ~70 ticks ≈ 1.17 s to clear from nose to top. The MAX_PLAYER_BULLETS
// cap (2 in single-fighter mode) blocks a third press while two are in
// flight, so the spec ALSO waits for `state.bullets` to drop below the cap
// before each press (cap-clear is the deterministic gate; this gap is just
// a debounce floor so we don't tight-loop on Playwright's evaluate cycle).
const FIRE_GAP_MS = 50;
const PROBE_WAIT_MS = 3000;
// Player-bullet cap mirrors MAX_PLAYER_BULLETS in galaga/src/game/input.ts.
const MAX_PLAYER_BULLETS = 2;
// Max time we'll wait for the bullet cap to clear before a press. Sized to
// cover one full bullet flight + render jitter under CI software-WebGL.
const CAP_CLEAR_WAIT_MS = 2500;

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

    // Survive the whole 30-fire sweep: a stationary player gets killed/captured
    // by diving enemies ~10 fires in, dropping canAct so presses stop spawning
    // and the spawn wait times out (#260). Invulnerability isolates the
    // input→spawn latency measurement from live combat attrition.
    await page.evaluate(() => window.__galagaInternals!.setInvulnerable(true));

    const deltas: number[] = [];

    for (let i = 0; i < FIRE_COUNT; i++) {
      // 1. Wait for the player-bullet cap to clear. Pressing Space while
      //    `state.bullets` already holds MAX_PLAYER_BULLETS player bullets
      //    consumes the press but spawns NO bullet — `lastKeydownTick`
      //    advances while `lastProjectileSpawnTick` stays stale, producing
      //    a misleading negative or huge delta. Waiting for the cap to
      //    clear is the deterministic gate; it also matches the issue's
      //    "spaced ≥ 200ms apart so cooldown can't gate the measurement".
      await page.waitForFunction(
        (cap: number) => {
          const bullets = window.__galaga?.bullets ?? [];
          let live = 0;
          for (const b of bullets) {
            if (b.from === "player") live++;
          }
          return live < cap;
        },
        MAX_PLAYER_BULLETS,
        { timeout: CAP_CLEAR_WAIT_MS },
      );

      // 2. Capture lastKeydownTick BEFORE this press so we can wait for it
      //    to advance — that's the deterministic "this press was observed"
      //    signal. -1 sentinel on the first iteration (no probe yet).
      const before = await page.evaluate(
        () => window.__galagaInternals!.fireProbe?.()?.lastKeydownTick ?? -1,
      );

      await page.keyboard.press("Space");

      // 3. Wait until fireProbe reports the press was observed AND a spawn
      //    landed (lastProjectileSpawnTick at least caught up to the new
      //    keydown tick — guards against the rare case where consumeFire
      //    fires but the cap blocked the spawn anyway, e.g. a stray
      //    in-flight bullet we missed).
      await page.waitForFunction(
        (prevKeydownTick: number) => {
          const probe = window.__galagaInternals?.fireProbe?.();
          if (!probe) return false;
          return (
            probe.lastKeydownTick > prevKeydownTick &&
            probe.lastProjectileSpawnTick >= probe.lastKeydownTick
          );
        },
        before,
        { timeout: PROBE_WAIT_MS },
      );

      const sample = await page.evaluate(() => window.__galagaInternals!.fireProbe?.());
      expect(sample, `fire ${i}: probe returned null after observed keydown advance`).not.toBeNull();
      expect(sample, `fire ${i}: probe returned undefined`).toBeDefined();
      deltas.push(sample!.deltaTicks);

      // pacing, not state — debounce floor between presses so we
      // don't tight-loop on Playwright's evaluate cycle. The
      // deterministic gate (bullet-cap clear + lastKeydownTick
      // advance + spawn observed) is above; this is human cadence.
      // See e2e-shared/no-wall-clock-waits/README.md.
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
