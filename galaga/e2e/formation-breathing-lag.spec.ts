// Formation breathing per-row phase lag spec (#241, gated by #255).
//
// Asserts the three properties from #241 against the row-lagged
// `breathingSway(currentTick, row)` helper in galaga/src/game/enemies.ts.
// Runs in the main `galaga` lane — no env gate, no `continue-on-error`
// diagnostic job. Cold-CI traces (`trace: 'retain-on-failure'` in
// galaga/playwright.config.ts) surface the failing expect() line if this
// ever flakes — that artifact is what #255 explicitly told us to produce
// before tightening tolerances again.
//
// PROPERTIES CHECKED (from #241):
//   (A) row 0 and row 4 differ in `x` at some tick within the sampling
//       window — proves the per-row lag is actually firing.
//   (B) max |Δx_row0_vs_row4| ≤ generous envelope around the theoretical
//       2·AMP·sin(rows·LAG·ω/2) ≈ 2.51 px at LAG_TICKS=2 — catches an
//       accidental amplification (e.g. someone bumps LAG_TICKS or AMP).
//   (C) every sampled formation-anchor stays within ±BREATHE_AMPLITUDE of
//       its home x — the lag is a phase offset, not an amplitude bump.
//
// FAILURE-MODE NOTES (the previous draft's collapse, distilled):
//   - The public `Enemy` snapshot is just `{id,kind,state,x,y,damaged}`.
//     No `col`/`row` field. Earlier drafts tried to re-derive the
//     column by clustering x values per tick — that heuristic flips
//     mid-window when a diver peels off (`firstDiveTick` = 276; the
//     sampling window starts around tick 246 + a few rAFs, so dives
//     FIRE during sampling). When the picked column changes, the
//     `homeX` estimate (mean of the two x's) jumps, and assertion (C)
//     pops on the residual offset.
//   - The fix: lock onto two SPECIFIC enemy ids ONCE at sampling
//     start, picked by their home-position fingerprint (col=1 row=0
//     and col=1 row=4 both sit at home_x ≈ 90 — boss kind at y≈70,
//     bee kind at y≈158). Track those ids only. If either leaves
//     `state==='formation'` (got picked for a dive), the test STOPS
//     sampling — we don't try to keep going with a stale id.
//   - Assertion (C) anchors on the known constant home_x (90), not a
//     per-tick estimate. The number is derived from the engine's
//     `formationSlot()` math: (WIDTH=320 − (COLS=8 − 1)·COL_SPACING=28)/2
//     + col·28 = 62 + col·28. col=1 ⇒ 90.
//
// SAMPLING WINDOW:
//   - From whatever tick sampling starts (just after formation-settled)
//     until either anchor leaves `formation`, or 8s wall clock, or 200
//     game ticks elapse. col=0 row=0 is orderedIndexes[0] = roster slot
//     0, so it dives FIRST (at tick 276) — col=1's row 0 and row 4
//     are NOT slot 0 (they're slots 5 and 9), so they survive past the
//     first dive trigger.
//   - At LAG_TICKS=2 and ω=2π/240, Δx peaks every (240/2 =) 120 ticks
//     — well within 200. (A) is satisfied with ≥1 cycle of sampling.
//
// BOOT / READINESS — mirrors hit-juice.spec.ts / boss-two-hit.spec.ts
// EXACTLY; the only sequence proven stable on cold CI.

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

    // Lock onto two specific enemies BY ID at sampling start. We pick:
    //   - the formation enemy whose y is closest to ROW0_HOME_Y AND
    //     whose home-x sits closest to COL1_HOME_X (estimated by
    //     stripping the current sway — but since we just saw the
    //     formation settle, the breathing offset can be up to ±AMP, so
    //     we accept any enemy whose x is within AMP+2 of COL1_HOME_X).
    //   - the formation enemy whose y is closest to ROW4_HOME_Y under
    //     the same x window.
    // If either can't be found, the readiness gate is broken — surface
    // that distinctly rather than failing later on a Δx assertion.
    const targets = await page.evaluate(
      ({ col1X, row0Y, row4Y, ampPlus }) => {
        const s = window.__galaga!;
        const formation = s.enemies.filter((e) => e.state === "formation");
        const inCol1 = formation.filter(
          (e) => Math.abs(e.x - col1X) <= ampPlus,
        );
        const row0 = inCol1.find((e) => Math.abs(e.y - row0Y) <= 2);
        const row4 = inCol1.find((e) => Math.abs(e.y - row4Y) <= 2);
        return {
          row0Id: row0?.id ?? null,
          row4Id: row4?.id ?? null,
          inCol1Count: inCol1.length,
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
      `could not find col=1 row=0 anchor (inCol1Count=${targets.inCol1Count})`,
    ).not.toBeNull();
    expect(
      targets.row4Id,
      `could not find col=1 row=4 anchor (inCol1Count=${targets.inCol1Count})`,
    ).not.toBeNull();

    // Sample those two ids until one leaves formation, 200 game ticks
    // pass, or 8s wall clock elapses (cold-CI safety).
    const samples = await page.evaluate(
      async ({ row0Id, row4Id }) => {
        const out: Array<{ tick: number; x0: number; x4: number }> = [];
        const startTick = window.__galaga!.tick;
        const deadline = performance.now() + 8000;
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
              // One of our anchors started diving — stop. We sampled
              // until the moment it left formation, which is exactly
              // what we want.
              bailReason = `anchor left formation: row0=${r0.state}, row4=${r4.state}`;
              break;
            }
            out.push({ tick: s.tick, x0: r0.x, x4: r4.x });
            lastSampledTick = s.tick;
            if (s.tick - startTick >= 200) break;
          }
          await new Promise((r) => requestAnimationFrame(() => r(null)));
        }
        return { samples: out, bailReason };
      },
      { row0Id: targets.row0Id, row4Id: targets.row4Id },
    );

    // Sanity floor — fewer than 30 distinct-tick samples means the loop
    // wasn't ticking, not that the engine is wrong.
    expect(
      samples.samples.length,
      `not enough samples (bail=${samples.bailReason ?? "none"})`,
    ).toBeGreaterThanOrEqual(30);

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
