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
// What this revision changed vs. the prior CI-red draft: the readiness
// gate. Tolerances and assertions are untouched. The structural fix is
// grounded in the engine's fixed-step accumulator (engine.ts L617-626:
// `while (accumulator >= STEP_MS) update()`) which can collapse many
// game ticks into one rAF on a throttled runner — see the failure-mode
// notes above the `bootAndLockAnchors` helper for the full derivation.
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
//     null`.
//   - But the NAIVE strengthening — `length===40 && every formation` —
//     has its own race on cold CI. The engine uses a fixed-step
//     accumulator (`while (accumulator >= STEP_MS) update()`) so MANY
//     game ticks can collapse into one rAF on a throttled runner. The
//     "all 40 in formation" window is only 30 ticks wide (last enemy
//     settles at tick 246, first dive launches at tick 276), and that
//     window CAN be jumped over by a single slow rAF — the
//     waitForFunction's next poll then samples a state where slot 0
//     (col=0 row=0, orderedIndexes[0]) is already diving, every-formation
//     is false, and the gate never re-closes (someone is always diving
//     after tick 276). Cold CI = silent 30s timeout, exactly the failure
//     mode #255 was filed to break out of.
//   - The fix: ANCHOR-SPECIFIC readiness. We only need col=1 row=0
//     (slot 5) and col=1 row=4 (slot 9) to be in formation when we lock
//     ids. Slot 5 is dive #36 (tick 1851); slot 9 is dive #8 (tick 591).
//     Both survive well past our 240-tick sampling window. So we wait
//     until BOTH anchors exist AND are in `formation`, ignoring the
//     state of other enemies. No transient global "every-formation"
//     window to race.
//   - col=0 row=0 is orderedIndexes[0] — first to dive at tick 276. We
//     anchor on col=1 (slots 5 and 9), which survives past 276 and is
//     the same home_x for row 0 and row 4 (no column-spacing confound).
//   - If either anchor leaves `formation` mid-sample (a later dive),
//     the loop STOPS — no stale-id sampling.
//
// BOOT / READINESS — mirrors hit-juice.spec.ts / boss-two-hit.spec.ts
// for the goto→click→ArrowLeft→status→internals beats, then anchor-
// specific readiness for the final wait (the new bit, replacing the
// brittle every-formation gate).

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
// Tolerance for matching a snapshot enemy to an anchor by home position.
// AMP + 2 in x (handles full breathing sway + float slop); ±2 in y (the
// home y is constant once settled — no ROW_SPACING confound since the
// rows are 22 px apart). Centralized so the readiness wait and any later
// anchor reuse share the same fingerprint.
const ANCHOR_X_TOL = BREATHE_AMPLITUDE + 2;
const ANCHOR_Y_TOL = 2;

/** Boot the game out of `ready` and wait until BOTH col=1 row=0 (slot 5)
 *  and col=1 row=4 (slot 9) anchors exist in the snapshot AND are in
 *  `formation` state. Returns the locked anchor ids.
 *
 *  Why not the more obvious "wait for length===40 && every formation"
 *  gate: the engine uses a fixed-step accumulator (60Hz), so on a
 *  throttled cold-CI rAF MANY game ticks can collapse into one wall-
 *  clock frame. The "all 40 in formation" window is only 30 ticks wide
 *  (last enemy settles at tick 246, first dive at tick 276), and a
 *  single slow rAF can step over that window — leaving the next poll
 *  to see slot 0 already diving, which means `every(formation)` is
 *  false from then on (someone is always mid-dive after tick 276). The
 *  gate never re-closes and the wait times out at 30s. That's the
 *  exact silent-timeout failure mode #255 was filed to break out of.
 *
 *  The anchor-specific wait avoids that race entirely. Slot 5 (col=1
 *  row=0) is dive #36 (tick 1851) and slot 9 (col=1 row=4) is dive #8
 *  (tick 591) — both safely outside our 240-tick sampling window. We
 *  don't care about the dive state of any OTHER enemy. */
async function bootAndLockAnchors(page: import("@playwright/test").Page) {
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
  // Anchor-specific readiness — both col=1 anchors present and in
  // formation. 30s ceiling: last enemy spawns at game-tick 156 and
  // finishes the 90-tick entrance arc by tick 246 (~4.1s of game time);
  // cold-CI rAF throttling can stretch that wall-clock-wise but never
  // by 7×.
  const anchors = await page.waitForFunction(
    ({ col1X, row0Y, row4Y, ampPlus, yTol }) => {
      const enemies = window.__galaga?.enemies ?? [];
      const pickAtRow = (rowY: number) => {
        for (const e of enemies) {
          if (e.state !== "formation") continue;
          if (Math.abs(e.x - col1X) > ampPlus) continue;
          if (Math.abs(e.y - rowY) > yTol) continue;
          return e.id;
        }
        return null;
      };
      const row0 = pickAtRow(row0Y);
      const row4 = pickAtRow(row4Y);
      if (row0 === null || row4 === null) return null;
      return { row0Id: row0, row4Id: row4 };
    },
    {
      col1X: COL1_HOME_X,
      row0Y: ROW0_HOME_Y,
      row4Y: ROW4_HOME_Y,
      ampPlus: ANCHOR_X_TOL,
      yTol: ANCHOR_Y_TOL,
    },
    { timeout: 30000 },
  );
  return (await anchors.jsonValue()) as { row0Id: number; row4Id: number };
}

test.describe("Galaga formation breathing per-row phase lag (#241)", () => {
  test("row 0 and row 4 desync within sampling window, stay within ±amplitude", async ({
    page,
  }) => {
    // Boot AND lock anchors in one step — the wait inside resolves only
    // when both col=1 anchors are findable AND in `formation` state. No
    // separate post-boot anchor-pick (the prior shape had the pick race
    // the per-rAF dive scheduler).
    const targets = await bootAndLockAnchors(page);

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
