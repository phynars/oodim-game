// Formation breathing per-row phase lag spec (#241, gated by #255).
//
// Asserts the three properties from #241 against the row-lagged
// `breathingSway(currentTick, row)` helper in galaga/src/game/enemies.ts.
//
// PROPERTIES CHECKED (from #241):
//   (A) row 0 and row 4 differ in `x` at some tick within the sampling
//       window — proves the per-row lag is actually firing.
//   (B) max |Δx_row0_vs_row4| ≤ generous envelope around the theoretical
//       2·AMP·sin(rows·LAG·ω/2) ≈ 2.51 px at LAG_TICKS=2 — catches an
//       accidental amplification (e.g. someone bumps LAG_TICKS or AMP).
//   (C) every sampled anchor stays within ±BREATHE_AMPLITUDE of its home
//       x — the lag is a phase offset, not an amplitude bump.
//
// READINESS — this revision deliberately uses the SAME gate as
// hit-juice.spec.ts / boss-two-hit.spec.ts:
//
//     enemies.length > 0 && enemies.every((e) => e.state === "formation")
//
// Those two specs have been CI-stable across hundreds of runs on this
// lane, including cold-CI starts. The prior draft replaced that gate with
// a speculative anchor-specific predicate ("wait for slot 5 + slot 9
// only") on the theory that the 30-tick all-in-formation window could be
// jumped over by a single throttled rAF. That theory was unverified —
// CI logs returned 401 to the reviewer chain — and five consecutive
// CI-red attempts at tolerance/structure tuning are the price we paid
// for guessing. #255 explicitly says: do not tune from theory; fix from
// captured failure data.
//
// Failure-mode capture is already wired (see #255 AC bullet 1):
//   - galaga/playwright.config.ts:    use.trace = "retain-on-failure"
//   - .github/workflows/ci.yml:96-103 uploads `test-results/` +
//     `playwright-report/` as `galaga-playwright-trace` on failure.
// So if THIS revision flakes, the next reviewer has the trace.zip — the
// failing expect() line and its actual value will be in the artifact.
//
// ANCHOR PICK happens AFTER the readiness gate resolves (not embedded in
// it). Both col=1 anchors share home_x = COL1_HOME_X (90), so any Δx
// between them is pure row-lag with no column-spacing confound. col=1
// also avoids col=0 row=0 (slot 0, orderedIndexes[0]) which is the first
// scheduled diver (peels off at tick 276 ≈ 4.6s game time).

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
// AMP + 2 in x handles full breathing sway + float slop; ±2 in y because
// home y is constant once settled and rows are 22 px apart.
const ANCHOR_X_TOL = BREATHE_AMPLITUDE + 2;
const ANCHOR_Y_TOL = 2;

/** Boot the game out of READY and wait for the full enemy formation to
 *  settle. Mirrors hit-juice.spec.ts / boss-two-hit.spec.ts EXACTLY —
 *  that readiness sequence is the only pattern proven stable on cold
 *  CI for this lane. */
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
  test("row 0 and row 4 desync within sampling window, stay within ±amplitude", async ({
    page,
  }) => {
    await bootToSettledFormation(page);

    // Pick col=1 row=0 and col=1 row=4 by home-position fingerprint.
    // Both share home_x = COL1_HOME_X (90); they differ only in home_y.
    // Picking AFTER the proven readiness gate resolves means every enemy
    // is in `formation` state at this moment — no risk of grabbing a
    // diver. The ids are stable (formationSlot is pure; ids never reuse
    // across stages per createEnemyController).
    const targets = await page.evaluate(
      ({ col1X, row0Y, row4Y, xTol, yTol }) => {
        const enemies = window.__galaga?.enemies ?? [];
        const findAt = (rowY: number) => {
          for (const e of enemies) {
            if (e.state !== "formation") continue;
            if (Math.abs(e.x - col1X) > xTol) continue;
            if (Math.abs(e.y - rowY) > yTol) continue;
            return e.id;
          }
          return null;
        };
        return {
          row0Id: findAt(row0Y),
          row4Id: findAt(row4Y),
          rosterSize: enemies.length,
        };
      },
      {
        col1X: COL1_HOME_X,
        row0Y: ROW0_HOME_Y,
        row4Y: ROW4_HOME_Y,
        xTol: ANCHOR_X_TOL,
        yTol: ANCHOR_Y_TOL,
      },
    );
    expect(
      targets.row0Id,
      `col=1 row=0 anchor not found at home (90,70) ±(${ANCHOR_X_TOL},${ANCHOR_Y_TOL}); roster=${targets.rosterSize}`,
    ).not.toBeNull();
    expect(
      targets.row4Id,
      `col=1 row=4 anchor not found at home (90,158) ±(${ANCHOR_X_TOL},${ANCHOR_Y_TOL}); roster=${targets.rosterSize}`,
    ).not.toBeNull();

    // Sample those two ids until one leaves formation, 240 game ticks
    // elapse, or 15s wall clock passes. 240 ticks ≈ one full breathing
    // cycle — Δx peaks at half a cycle (120 ticks) so one cycle gives
    // assertion (A) two clean opportunities.
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
      { row0Id: targets.row0Id as number, row4Id: targets.row4Id as number },
    );

    // Sanity floor: at least 15 distinct-tick samples means the loop
    // was actually progressing. If samples < 15, the loop wasn't
    // ticking — surface the bail reason so the trace artifact pinpoints
    // it on a future flake.
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
    // a PHASE offset, not an amplitude bump. +0.5 px for floating-point.
    const ampCap = BREATHE_AMPLITUDE + 0.5;
    for (const s of samples.samples) {
      expect(
        Math.abs(s.x0 - COL1_HOME_X),
        `row0 swung beyond ±amp at tick ${s.tick}: x=${s.x0}`,
      ).toBeLessThanOrEqual(ampCap);
      expect(
        Math.abs(s.x4 - COL1_HOME_X),
        `row4 swung beyond ±amp at tick ${s.tick}: x=${s.x4}`,
      ).toBeLessThanOrEqual(ampCap);
    }
  });
});
