// Doom corpse-fade easing (#356). When an enemy dies the renderer holds the
// body for CORPSE_HOLD_TICKS, then fades its material opacity to 0 over the
// last (CORPSE_HOLD_TICKS - CORPSE_FADE_START_TICK) ticks before the cull.
// #194 shipped that fade as a LINEAR ramp, which reads as a snap-off at the
// tail (constant rate-of-change all the way to 0 lands the final frame as a
// sprite-deletion pop). #356 swaps the curve for **easeInQuad** `1 - k²`
// (k = fade progress 0→1): the body holds longer mid-window then accelerates
// into invisibility, dissolving INTO the floor instead of off it. The TIMING
// is unchanged — same window, same endpoints, same cull tick.
//
// STATE CONTRACT (doom/docs/ARCHITECTURE.md): no pixels. We drive the kill +
// corpse beat through the deterministic `window.__doomInternals` hooks and
// read the engine's OWN computed corpse alpha via `corpseAlpha()` — that
// probe returns `corpseFadeAlpha(deathTicks)`, the single source of truth the
// render path also reads, so this assertion binds to the actual engine curve
// (a regression in engine.ts breaks the test) rather than a re-derived copy.
// Everything runs synchronously inside one `page.evaluate` so the engine's
// background rAF loop can't slip a tick between samples — and no
// `waitForTimeout` (the no-wall-clock-waits guard).

import { expect, test } from "@playwright/test";

import {
  CORPSE_FADE_START_TICK,
  CORPSE_HOLD_TICKS,
  corpseFadeAlpha,
} from "../src/game/types";
import type { DoomInternals, DoomState } from "../src/game/types";

declare global {
  interface Window {
    __doom?: DoomState;
    __doomInternals?: DoomInternals;
  }
}

test("#356: corpse fade follows easeInQuad (1 - k²), not linear — alpha at the fade midpoint is 0.75, not 0.50", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.waitForFunction(() => Boolean(window.__doomInternals), null, {
    timeout: 5000,
  });

  // Kill the seeded imp, then pump the corpse beat ONE fixed-step at a time,
  // recording the engine's live (deathTicks → alpha) at every tick of the
  // fade window. forceHit arms a kill-hitstop freeze; deathTicks only ticks
  // once the freeze drains (the engine gates the corpse counter on hitstop,
  // same as sparks/blood). So we collect samples keyed by the ACTUAL
  // deathTicks the engine reports, immune to the exact freeze length. The
  // cull fires at deathTicks === CORPSE_HOLD_TICKS, so the last observable
  // corpse is at deathTicks === CORPSE_HOLD_TICKS - 1.
  const samples = await page.evaluate(
    (HOLD: number) => {
      const internals = window.__doomInternals!;
      const imp = window.__doom!.enemies.find((e) => e.kind === "imp");
      if (!imp) return { ok: false as const };
      const id = imp.id;
      internals.forceHit({ enemyId: id });
      const byTick: Record<number, number> = {};
      // One full corpse beat is HOLD ticks of aging; the kill-hitstop freeze
      // adds a few frozen frames up front. Pump generously past both so we
      // sweep the whole fade window, sampling the live alpha each step.
      for (let i = 0; i < HOLD + 12; i++) {
        internals.advance({ steps: 1 });
        const dead = window.__doom!.enemies.find((e) => e.id === id);
        if (!dead) break; // culled — corpse beat complete
        const a = internals.corpseAlpha({ enemyId: id });
        if (a !== null) byTick[dead.deathTicks ?? 0] = a;
      }
      return { ok: true as const, byTick };
    },
    CORPSE_HOLD_TICKS,
  );

  expect(samples.ok).toBe(true);
  if (!samples.ok) return;

  const fadeSpan = CORPSE_HOLD_TICKS - CORPSE_FADE_START_TICK; // 12
  const at = (dt: number): number | undefined => samples.byTick[dt];

  // --- Endpoint / pre-window: full opacity until the fade window opens. ---
  // At deathTicks === CORPSE_FADE_START_TICK (k=0) the body is still fully
  // opaque; the fade only starts AFTER this tick.
  expect(at(CORPSE_FADE_START_TICK)).toBeCloseTo(1, 6);

  // --- Midpoint (k=0.5): THE discriminating sample. ---
  // easeInQuad → 1 - 0.5² = 0.75. A linear ramp would give 0.50. The whole
  // point of #356 is "body holds longer mid-window", so this must be 0.75.
  const midTick = CORPSE_FADE_START_TICK + fadeSpan * 0.5; // 18
  expect(at(midTick)).toBeCloseTo(0.75, 6);
  // Explicit anti-linear guard: well above the linear midpoint of 0.50.
  expect(at(midTick)!).toBeGreaterThan(0.6);

  // --- Tail-quarter (k=0.75): 1 - 0.75² = 0.4375 (linear would be 0.25). ---
  const tailTick = CORPSE_FADE_START_TICK + fadeSpan * 0.75; // 21
  expect(at(tailTick)).toBeCloseTo(0.4375, 6);

  // --- Last observable tick before cull (deathTicks = HOLD - 1, k≈0.917). ---
  // 1 - (11/12)² ≈ 0.1597. Linear would be 1 - 11/12 ≈ 0.0833. The eased
  // curve still has visibly more mass here even at the very tail.
  const lastTick = CORPSE_HOLD_TICKS - 1; // 23
  expect(at(lastTick)).toBeCloseTo(1 - (11 / 12) * (11 / 12), 6);

  // --- Every sampled tick matches the shared engine curve exactly. ---
  // Binds the e2e to engine.ts's source-of-truth `corpseFadeAlpha`: any
  // formula drift breaks this, not just the spot checks above.
  for (const [dtStr, alpha] of Object.entries(samples.byTick)) {
    expect(alpha).toBeCloseTo(corpseFadeAlpha(Number(dtStr)), 9);
  }

  // --- Monotonic, strictly decreasing across the fade window. ---
  expect(at(midTick)!).toBeGreaterThan(at(tailTick)!);
  expect(at(tailTick)!).toBeGreaterThan(at(lastTick)!);
});
