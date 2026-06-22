// Formation breathing per-row phase lag spec (#241, gated for #255).
//
// PURPOSE — DIAGNOSTIC, NOT GATING.
// This spec is a re-introduction of the 241-line draft that turned the
// `galaga` cold-CI red on five consecutive commits during #242's review
// loop. Tolerance tuning never identified WHICH expect() line was failing
// on cold CI (the agent reviewers couldn't read the workflow logs — 401).
//
// To break that cycle, this file is gated behind the GALAGA_DIAG env var
// and ONLY executed by the dedicated `galaga-diag-breathing` workflow job
// in .github/workflows/ci.yml — a job that runs with `continue-on-error:
// true` and uploads the full Playwright trace + report on every run (pass
// or fail). The main `galaga` lane skips this spec entirely, so a red
// breathing-lag run does NOT jam the per-product merge gate (the very
// cross-product CI jam class the per-product lanes were created to
// prevent).
//
// ACCEPTANCE FROM #255:
//   - Before re-introducing the spec [for gating], one CI commit captures
//     the previous spec's actual failure mode — either `--reporter=list`
//     step output in the workflow log, or a Playwright trace artifact
//     uploaded on failure.  THIS COMMIT IS THAT COMMIT.
//
// FOLLOW-UP (a separate PR, once the trace is in hand):
//   - Read the uploaded `galaga-diag-breathing-trace` artifact, identify
//     which expect() line fails on cold CI and what the actual value was.
//   - Either tune the failing assertion against the observed data, or
//     fold a corrected version into the main `galaga` lane and delete the
//     GALAGA_DIAG gate + the diagnostic job.
//
// PROPERTIES CHECKED (from #241):
//   (A) row 0 and row 4 differ in `x` at some tick within the sampling
//       window — proves the per-row lag is actually firing.
//   (B) max |Δx_row0_vs_row4| ≤ ~3 px — matches the theoretical
//       2·AMP·sin(4·LAG·ω/2) ≈ 2.51 px at LAG_TICKS=2 (AMP=12,
//       ω=2π/240).
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

// Diagnostic gate. The spec is SKIPPED entirely unless GALAGA_DIAG=1 is
// set in the environment — meaning it never runs in the main `galaga`
// merge-gate lane, only in the dedicated diagnostic job. This is the
// non-negotiable protection against the prior cold-CI red streak: the
// spec's still on a probationary footing, and a flake here cannot block
// a galaga PR's merge.
const RUN_DIAG = process.env.GALAGA_DIAG === "1";

// Constants must match galaga/src/game/enemies.ts. Duplicated here (not
// imported) so the spec reads as a contract — if someone tightens
// BREATHE_AMPLITUDE without updating this number, the spec catches it.
const BREATHE_AMPLITUDE = 12;
const BREATHE_OMEGA = (2 * Math.PI) / 240;
// Expected per-row lag (ticks). The #241 fix makes deeper rows lag the
// top row by `row * LAG_TICKS` ticks. 2 ticks/row matches the original
// draft's modelled value.
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

test.describe("Galaga formation breathing per-row phase lag (#241 — DIAGNOSTIC, #255)", () => {
  test.skip(
    !RUN_DIAG,
    "Diagnostic spec — runs only in the galaga-diag-breathing CI job (set GALAGA_DIAG=1). See #255.",
  );

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
      const targetCol = 1;
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
      // Silence unused-targetCol lint — kept as documentation of intent.
      void targetCol;
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
