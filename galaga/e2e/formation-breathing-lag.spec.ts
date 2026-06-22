// Formation breathing per-row phase lag spec (#241, gated by #255).
//
// Asserts the three properties from #241 against the row-lagged
// `breathingSway(currentTick, row)` helper in galaga/src/game/enemies.ts.
//
// Runs in the main `galaga` lane. Cold-CI traces are surfaced via
// `trace: "retain-on-failure"` in galaga/playwright.config.ts — if this
// spec ever flakes, the failing expect() line is in the artifact (that
// surface is what #255 explicitly required before tightening tolerances
// again; we did NOT widen them here).
//
// PROPERTIES CHECKED (from #241):
//   (A) row 0 and row 4 differ in `x` at some tick within the sampling
//       window — proves the per-row lag is actually firing.
//   (B) max |Δx_row0_vs_row4| ≤ generous envelope around the theoretical
//       2·AMP·sin(rows·LAG·ω/2) ≈ 2.51 px at LAG_TICKS=2 — catches an
//       accidental amplification (e.g. someone bumps LAG_TICKS or AMP).
//   (C) every sampled anchor stays within ±BREATHE_AMPLITUDE of its home
//       x — the lag is a phase offset, not an amplitude bump. Anchored
//       on the engine-derived constant COL1_HOME_X=90, NOT a per-tick
//       estimate (that was the trap the prior draft fell into).
//
// FAILURE-MODE NOTES (distilled from the prior draft's collapse):
//   - The public `Enemy` snapshot is just `{id,kind,state,x,y,damaged}`.
//     No `col`/`row`. Anchors must be re-derived from x,y at sampling
//     start.
//   - The previous `enemies.length > 0 && every(formation)` readiness
//     gate could resolve when only the FIRST entrance wave was settled
//     — the rest of the roster wasn't even spawned yet. Picking a row-4
//     anchor against a partial roster failed silently with `row4Id ===
//     null`. The fix: wait for the FULL roster (40 enemies) before
//     locking anchors.
//   - col=0 row=0 is orderedIndexes[0] — first to dive at tick 276. We
//     anchor on col=1 (slots 5 and 9), which survives past 276 and is
//     the same home_x for row 0 and row 4 (no column-spacing confound).
//   - If either anchor leaves `formation` mid-sample (a later dive),
//     the loop STOPS — no stale-id sampling.
//
// BOOT / READINESS — mirrors hit-juice.spec.ts / boss-two-hit.spec.ts
// EXACTLY for the goto→click→ArrowLeft→status→internals beats, then
// adds the full-roster size check before sampling (the new bit that the
// prior draft lacked).

import { expect, test } from "@playwright/test";

import type { GalagaInternals, GameState } from "../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
    __galagaInternals?: GalagaInternals;
  }
}

// Engine constants duplicated here (not imported) so the spec reads as a
// contract. If someone changes BREATHE_AMPLITUDE or LAG_TICKS without
// updating these, the spec catches the drift.
const BREATHE_AMPLITUDE = 12;
const BREATHE_OMEGA = (2 * Math.PI) / 240;
const LAG_TICKS = 2;
// Home x of the col=1 anchors. Derived from formationSlot(): startX =
// (WIDTH=320 − (COLS=8 − 1)·COL_SPACING=28)/2 = 62; col=1 ⇒ 62 + 28 = 90.
const COL1_HOME_X = 90;
// Home y of the row=0 and row=4 anchors. FORMATION_TOP_Y=70, ROW_SPACING=22.
const ROW0_HOME_Y = 70;
const ROW4_HOME_Y = 70 + 4 * 22; // 158
// Full formation roster size: COLS=8 × ROWS=5 = 40 enemies. The prior
// draft only required `enemies.length > 0`, which resolved while later
// entrance waves were still spawning — a partial roster with no row=4
// anchor was the silent failure mode.
const FULL_ROSTER_SIZE = 40;

async function bootToSettledFullFormation(
  page: import("@playwright/test").Page,
) {
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
  // The crucial change vs. the prior draft: wait for the FULL roster to
  // be present AND every enemy in `formation`. Entrance choreography
  // spawns in staggered waves — the prior gate (length>0 && every
  // formation) could pass while later waves hadn't spawned yet, leaving
  // no row=4 anchor to find. 30s ceiling: full entrance is ≤ ~15s on
  // warm hardware, doubled for cold CI throttling.
  await page.waitForFunction(
    (expected) => {
      const enemies = window.__galaga?.enemies ?? [];
      return (
        enemies.length >= expected &&
        enemies.every((e) => e.state === "formation")
      );
    },
    FULL_ROSTER_SIZE,
    { timeout: 30000 },
  );
}

test.describe("Galaga formation breathing per-row phase lag (#241)", () => {
  test("row 0 and row 4 desync within sampling window, stay within ±amplitude", async ({
    page,
  }) => {
    await bootToSettledFullFormation(page);

    // Lock onto two specific enemies BY ID at sampling start. We pick:
    //   - the enemy with the smallest |y − ROW0_HOME_Y| whose current x
    //     is within (AMP + 2)px of COL1_HOME_X (so we know it's col=1,
    //     not col=0 at home_x=62 or col=2 at home_x=118).
    //   - the analogous pick for ROW4_HOME_Y.
    // If either can't be found, surface the diagnostic state distinctly
    // so a future trace pinpoints the readiness regression instead of a
    // later Δx assertion eating the failure.
    const targets = await page.evaluate(
      ({ col1X, row0Y, row4Y, ampPlus }) => {
        const s = window.__galaga!;
        const formation = s.enemies.filter((e) => e.state === "formation");
        const pickAtRow = (rowY: number) => {
          let best: { id: number; dy: number } | null = null;
          for (const e of formation) {
            if (Math.abs(e.x - col1X) > ampPlus) continue;
            const dy = Math.abs(e.y - rowY);
            if (dy > 2) continue;
            if (best === null || dy < best.dy) best = { id: e.id, dy };
          }
          return best?.id ?? null;
        };
        return {
          row0Id: pickAtRow(row0Y),
          row4Id: pickAtRow(row4Y),
          rosterSize: s.enemies.length,
          formationSize: formation.length,
        };
      },
      {
        col1X: COL1_HOME_X,
        row0Y: ROW0_HOME_Y,
        row4Y: ROW4_HOME_Y,
        ampPlus: BREATHE_AMPLITUDE + 2,
      },
    );
    expect(
      targets.row0Id,
      `could not find col=1 row=0 anchor (roster=${targets.rosterSize}, formation=${targets.formationSize})`,
    ).not.toBeNull();
    expect(
      targets.row4Id,
      `could not find col=1 row=4 anchor (roster=${targets.rosterSize}, formation=${targets.formationSize})`,
    ).not.toBeNull();

    // Sample those two ids until one leaves formation, 240 game ticks
    // elapse, or 15s wall clock passes. 240 ticks ≈ one full breathing
    // cycle — Δx peaks at half a cycle (120 ticks) so one cycle gives
    // assertion (A) two clean opportunities. 15s wall ceiling: cold-CI
    // rAF can throttle to ~20fps; 15s * 20fps = 300 ticks budget, ample
    // headroom for the 240-tick target.
    const samples = await page.evaluate(
      async ({ row0Id, row4Id }) => {
        const out: Array<{ tick: number; x0: number; x4: number }> = [];
        const startTick = window.__galaga!.tick;
        const deadline = performance.now() + 15000;
        let lastSampledTick = -1;
        let bailReason: string | null = null;
        while (performance.now() < deadline) {
          const s = window.__galaga!;
          if (s.tick !== lastSampledTick) {
            const r0 = s.enemies.find((e) => e.id === row0Id);
            const r4 = s.enemies.find((e) => e.id === row4Id);
            if (!r0 || !r4) {
              bailReason = "anchor removed from roster";
              break;
            }
            if (r0.state !== "formation" || r4.state !== "formation") {
              // One of our anchors started diving — stop. We sampled up
              // to the moment it left formation, which is exactly what
              // we want.
              bailReason = `anchor left formation: row0=${r0.state}, row4=${r4.state}`;
              break;
            }
            out.push({ tick: s.tick, x0: r0.x, x4: r4.x });
            lastSampledTick = s.tick;
            if (s.tick - startTick >= 240) break;
          }
          await new Promise((r) => requestAnimationFrame(() => r(null)));
        }
        return { samples: out, bailReason };
      },
      { row0Id: targets.row0Id, row4Id: targets.row4Id },
    );

    // Sanity floor: at least 15 distinct-tick samples means the loop
    // was actually progressing. 15 ticks ≈ a sixth of a breathing
    // cycle — enough to see Δx move off zero even if rAF was throttled
    // aggressively. If samples < 15, the loop wasn't ticking, which
    // is a readiness/throttle issue not an engine bug; surface the
    // bail reason so the trace artifact pinpoints it.
    expect(
      samples.samples.length,
      `not enough samples (bail=${samples.bailReason ?? "none"})`,
    ).toBeGreaterThanOrEqual(15);

    const deltas = samples.samples.map((s) => Math.abs(s.x0 - s.x4));
    const maxDelta = Math.max(...deltas);

    // (A) The two rows desync at some point. If LAG_TICKS were 0, every
    // sample would have Δx ≡ 0. 0.1 px is well under the ~2.51 px peak.
    expect(maxDelta).toBeGreaterThan(0.1);

    // (B) Δx stays inside a generous envelope around the theoretical
    // peak: 2·AMP·sin(rows · LAG · ω / 2), rows=4. 1.25× headroom for
    // floating-point and tick rounding.
    const theoreticalPeak =
      2 * BREATHE_AMPLITUDE * Math.sin((4 * LAG_TICKS * BREATHE_OMEGA) / 2);
    const cap = theoreticalPeak * 1.25;
    expect(maxDelta).toBeLessThanOrEqual(cap);

    // (C) Each anchor stays within ±AMP of its known home_x. The lag is
    // a PHASE offset, not an amplitude bump. Tolerance: +0.5px for
    // floating-point. Anchor on the constant COL1_HOME_X (90), NOT a
    // per-tick estimate — that's the trap the prior draft fell into.
    const ampCap = BREATHE_AMPLITUDE + 0.5;
    for (const s of samples.samples) {
      expect(
        Math.abs(s.x0 - COL1_HOME_X),
        `row0 swung beyond ±amp at tick ${s.tick}`,
      ).toBeLessThanOrEqual(ampCap);
      expect(
        Math.abs(s.x4 - COL1_HOME_X),
        `row4 swung beyond ±amp at tick ${s.tick}`,
      ).toBeLessThanOrEqual(ampCap);
    }
  });
});
