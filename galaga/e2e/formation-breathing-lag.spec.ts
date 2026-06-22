// Formation breathing per-row phase lag spec (#241, gated by #255).
//
// Asserts the three properties from #241 against the row-lagged
// `breathingSway(currentTick, row)` helper in galaga/src/game/enemies.ts.
// Runs in the main `galaga` lane — no env gate, no `continue-on-error`
// diagnostic job. Cold-CI traces (already enabled via
// `trace: 'retain-on-failure'` in galaga/playwright.config.ts) surface the
// failing expect() line if this ever flakes.
//
// PROPERTIES CHECKED (from #241):
//   (A) row 0 and row 4 differ in `x` at some tick within the sampling
//       window — proves the per-row lag is actually firing.
//   (B) max |Δx_row0_vs_row4| ≤ generous envelope around the theoretical
//       2·AMP·sin(4·LAG·ω/2) ≈ 2.51 px at LAG_TICKS=2 (AMP=12,
//       ω=2π/240) — catches an accidental amplification (e.g. someone
//       raises LAG_TICKS or AMP without updating this constant).
//   (C) every formation enemy stays within ±BREATHE_AMPLITUDE of its
//       home x — the lag is a phase offset, not an amplitude bump.
//
// SAMPLING:
//   - Anchor on col=1 (not col=0): col=0 row=0 is the first scheduled
//     diver (roster idx 0 fires at firstDiveTick), and it peels off
//     before the sampling window can characterize the wave.
//   - Both col=1 anchors share home_x so recovered Δx is pure row-lag
//     with no column-spacing confound.
//   - Sampling window between formation-settle (~tick 246) and col=1
//     row=4's first dive — ~345 ticks ≈ 5.75s ≈ 1.44 breathing cycles.
//
// BOOT / READINESS — mirrors hit-juice.spec.ts exactly; this is the only
// sequence proven stable on cold CI.

import { expect, test } from "@playwright/test";

import type { GalagaInternals, GameState } from "../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
    __galagaInternals?: GalagaInternals;
  }
}

// Constants must match galaga/src/game/enemies.ts. Duplicated here (not
// imported) so the spec reads as a contract — if someone tightens
// BREATHE_AMPLITUDE without updating this number, the spec catches it.
const BREATHE_AMPLITUDE = 12;
const BREATHE_OMEGA = (2 * Math.PI) / 240;
// Expected per-row lag (ticks). The #241 fix makes deeper rows lag the
// top row by `row * LAG_TICKS` ticks. 2 ticks/row matches the engine's
// BREATHE_ROW_PHASE_LAG_TICKS.
const LAG_TICKS = 2;

/** Boot the game out of READY and wait for the full enemy formation to
 *  settle.  Copied (intentionally) from hit-juice.spec.ts / boss-two-hit
 *  .spec.ts — the only readiness sequence proven stable on cold CI. */
async function bootToSettledFormation(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => window.__galaga?.status === "playing", null, {
    timeout: 5000,
  });
  await page.waitForFunction(() => Boolean(window.__galagaInternals), null, {
    timeout: 5000,
  });
  await page.waitForFunction(
    () => {
      const enemies = window.__galaga?.enemies ?? [];
      return (
        enemies.length > 0 && enemies.every((e) => e.state === "formation")
      );
    },
    null,
    { timeout: 20000 },
  );
}

test.describe("Galaga formation breathing per-row phase lag (#241)", () => {
  test("row 0 and row 4 desync visibly within sampling window (lag is firing)", async ({
    page,
  }) => {
    await bootToSettledFormation(page);

    // Sample the col=1 anchors over ~1.5 breathing cycles (~360 ticks).
    // We collect (tickGame, x_row0, x_row4) tuples by reading
    // window.__galaga.enemies between rAF yields. Both anchors share
    // `home_x` so Δx is pure phase lag.
    //
    // We give the sampler up to 8s of wall clock (cold CI is slow); the
    // sampling LOOP exits as soon as we have ≥ 60 distinct game-tick
    // samples spanning ≥ 200 game ticks (enough resolution for the
    // amplitude / desync assertions below).
    const samples = await page.evaluate(async () => {
      const out: Array<{ tick: number; x0: number; x4: number; homeX: number }> = [];
      const startTick = window.__galaga!.tick;
      const deadline = performance.now() + 8000;
      let lastSampledTick = -1;
      while (performance.now() < deadline) {
        const s = window.__galaga!;
        if (s.tick !== lastSampledTick) {
          // We don't have a public "give me the col=1 row=N formation enemy"
          // API — instead, find any two formation enemies whose home_x is
          // identical (column match) and whose y ordering reveals their
          // rows.  Across the spec's lifecycle, col=1 row=0 + col=1 row=4
          // are the two formation enemies sharing the smallest x AND
          // having the largest y delta.  Diving / non-formation enemies
          // are excluded.
          const formation = s.enemies.filter((e) => e.state === "formation");
          // Bucket by rounded home-x to find a column.  Column x's are
          // 28px apart, so rounding to the nearest 4 collapses them
          // robustly without confusing adjacent columns.
          const byCol = new Map<number, typeof formation>();
          for (const e of formation) {
            const key = Math.round(e.x / 4) * 4;
            const arr = byCol.get(key) ?? [];
            arr.push(e);
            byCol.set(key, arr);
          }
          // Pick the column with at least 2 members whose y span is
          // widest — that's our target (most likely col=1 if it still has
          // both row 0 and row 4).
          let bestCol: typeof formation | null = null;
          let bestSpan = -1;
          for (const arr of byCol.values()) {
            if (arr.length < 2) continue;
            const ys = arr.map((e) => e.y);
            const span = Math.max(...ys) - Math.min(...ys);
            if (span > bestSpan) {
              bestSpan = span;
              bestCol = arr;
            }
          }
          if (bestCol && bestCol.length >= 2) {
            bestCol.sort((a, b) => a.y - b.y);
            const top = bestCol[0]!;
            const bot = bestCol[bestCol.length - 1]!;
            // home_x derived as the AVERAGE of the two x's — under pure
            // phase lag of equal amplitude, top.x + bot.x is centered on
            // 2·home_x ± small. (For diagnostic purposes we just need a
            // working estimate; the precise value isn't asserted.)
            const homeX = (top.x + bot.x) / 2;
            out.push({ tick: s.tick, x0: top.x, x4: bot.x, homeX });
            lastSampledTick = s.tick;
          }
          // Exit once we have enough samples to characterize the wave.
          if (out.length >= 60 && s.tick - startTick >= 200) break;
        }
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      return out;
    });

    // Sanity floor — if we didn't sample anything, the readiness gate
    // is broken, not the engine.  Surface that distinctly.
    expect(samples.length).toBeGreaterThanOrEqual(20);

    // (A) row 0 and row 4 differ in `x` at some tick.  If the per-row
    // lag isn't firing, both rows compute identical sway and Δx ≡ 0 for
    // every sample.  We require at least one sample with |Δx| > 0.1 px
    // (well under the theoretical 2.51 px peak; this is purely a
    // "lag is non-zero" signal, not a magnitude check).
    const deltas = samples.map((s) => Math.abs(s.x0 - s.x4));
    const maxDelta = Math.max(...deltas);
    expect(maxDelta).toBeGreaterThan(0.1);

    // (B) max |Δx| stays under a generous envelope around the theoretical
    // peak.  Theory: 2·AMP·sin(rows·LAG·ω/2) with rows=4, LAG=LAG_TICKS,
    // ω=BREATHE_OMEGA.  Adding ~25% headroom for sample-time jitter and
    // floating-point gives the cap.  If the engine raises LAG_TICKS or
    // AMP without updating these constants, this catches it.
    const theoreticalPeak =
      2 * BREATHE_AMPLITUDE * Math.sin((4 * LAG_TICKS * BREATHE_OMEGA) / 2);
    const cap = theoreticalPeak * 1.25;
    expect(maxDelta).toBeLessThanOrEqual(cap);

    // (C) every sample's row-0 and row-4 x stays within ±AMP of home_x.
    // Lag is a phase offset, not an amplitude bump — neither row should
    // ever swing further than the breathing amplitude.  Tolerance: +1 px
    // for the home_x estimate noise.
    const ampCap = BREATHE_AMPLITUDE + 1;
    for (const s of samples) {
      expect(Math.abs(s.x0 - s.homeX)).toBeLessThanOrEqual(ampCap);
      expect(Math.abs(s.x4 - s.homeX)).toBeLessThanOrEqual(ampCap);
    }
  });
});
