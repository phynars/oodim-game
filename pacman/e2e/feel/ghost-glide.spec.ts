// Merge-gate spec for #137 (Pac-Man ghost render interpolation).
//
// THE BUG THIS CATCHES
// --------------------
// Before #137's fix, ghost sprites snapped from tile center to tile center
// while Pac-Man glided smoothly via `pac._progress`. Two actors on the same
// grid rendered under different rules — a visual-consistency violation any
// arcade player picks up subconsciously. Mechanically: the ghost render
// path read `g.x`/`g.y` (integer tile coords) and ignored `_progress`, so
// per-rAF Δposition was zero for ~10 frames at a stretch and then ~1.0
// (one full tile) on the single frame the tile-commit happened.
//
// After the fix, `GhostInternal._progress` is advanced each tick in
// `pacman/src/game/ghost.ts` and consumed by `renderGhosts()` in
// `pacman/src/game/engine.ts` with the same `(tile + dir * progress) * TILE`
// math shape as `renderPac()`. Per-rAF Δ is now ~constant, never zero
// during steady-state glide, and never a full-tile snap.
//
// THE INVARIANT — SELF-PARITY, NOT CROSS-ACTOR RATIO
// --------------------------------------------------
// An earlier rev of this spec compared maxGhostDx to maxPacDx as a ratio.
// That gate is brittle: Pac parks at the first wall it hits while
// ArrowRight is held, so the back half of the 2s window has Pac stationary
// (`dir = "none"` → `_progress = 0`) while the ghost keeps gliding. The
// cross-actor ratio then reflects "ghost moving / Pac frozen", not "are
// they rendering with the same math?".
//
// Instead we assert TWO self-parity invariants on the GHOST alone — each
// directly tied to the bug's signature:
//
//   1. CONTINUOUS MOTION. Post-fix, every steady-state frame of an
//      out-of-house ghost shows non-zero glide Δ (subject to CI's accumul-
//      ator pattern: a single tick advances `_progress` by 0.10/tick, so
//      every rAF frame that runs ≥1 update produces a non-zero Δ). The
//      pre-fix bug rendered the ghost as still tiles for ~10 frames then
//      one big jump. Gate: ≥60% of post-filter frames show Δ > 1e-4.
//      (Below 60% would mean half the frames are stalls — i.e. the bug.)
//
//   2. BOUNDED PER-FRAME Δ. Post-fix, per-rAF Δ is bounded by the number
//      of fixed-step updates the accumulator drained that frame × per-tick
//      speed (0.10 tiles/tick for chase/scatter). On CI's software-WebGL
//      stack, 2-3 updates/frame is realistic during hiccups, so ~0.30
//      tiles/frame is the worst legitimate Δ. The pre-fix bug snapped a
//      FULL tile (Δ ≈ 1.0) on commit frames. Gate: max per-frame ghost Δ
//      < 0.55 — well above any plausible multi-update spike, well below a
//      full-tile snap.
//
// Frightened/eyes tiers and cornering parity are explicit non-goals here
// — #137 acceptance #1 (visible glide) and #3 (per-frame envelope) only.
// The cornering/tier work lives in a separate follow-up (#145 lane).
//
// PROBE
// -----
// `window.__pacInternals.renderPositions()` returns the same sub-tile
// float coords that `renderPac` / `renderGhosts` use to draw — mirrored
// math in engine.ts. If those draw paths drift, mirror the change there.
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __pac?: {
      status: string;
      tick: number;
      pac: { x: number; y: number; dir: string; queued: string };
      ghosts: Array<{ name: string; x: number; y: number; mode: string; status: string }>;
    };
    __pacInternals?: {
      renderPositions?: () => {
        pac: { x: number; y: number };
        ghosts: Array<{ name: string; x: number; y: number; status: string; mode: string }>;
      };
      forceGhostOntoPac?: (name: string) => void;
      clearPellets?: () => void;
    };
  }
}

test("ghost render position glides continuously (no tile-snap)", async ({ page }) => {
  await page.goto("/");
  // Wait for boot — status flips to 'ready' synchronously in the Engine
  // constructor (publishes window.__pac immediately).
  await page.waitForFunction(() => window.__pac?.status === "ready");

  // Guard: the spec requires the render-position probe. If it's missing,
  // engine.ts needs the renderPositions() helper that mirrors
  // renderPac/renderGhosts math.
  const hasProbe = await page.evaluate(
    () => typeof window.__pacInternals?.renderPositions === "function",
  );
  expect(
    hasProbe,
    "window.__pacInternals.renderPositions() must exist — add a probe in engine.ts that mirrors renderPac/renderGhosts math (see #137 follow-up).",
  ).toBe(true);

  // Kick play with a right-press so the engine flips ready → playing
  // (status flip is gated on the first queued direction; see engine.ts
  // update()). We DON'T hold the key for the full window — Pac would
  // park at the first wall and stop being a useful comparator anyway.
  // The ghost ticks freely regardless of Pac's input state.
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => window.__pac?.status === "playing");

  // Sample render positions across a 1.5s window at rAF cadence. Blinky
  // starts out-of-house (`status: "out"`); the others are gated behind
  // the dot counter. We watch whichever ghost is `out` and in
  // chase/scatter for the full window.
  type Sample = {
    t: number;
    ghosts: Array<{ name: string; x: number; y: number; status: string; mode: string }>;
  };
  const samples: Sample[] = await page.evaluate(async (durationMs: number) => {
    const out: Sample[] = [];
    await new Promise<void>((resolve) => {
      const start = performance.now();
      const step = () => {
        const rp = window.__pacInternals!.renderPositions!();
        out.push({ t: performance.now(), ghosts: rp.ghosts });
        if (performance.now() - start >= durationMs) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    return out;
  }, 1500);

  expect(samples.length, "should have collected rAF samples").toBeGreaterThan(40);

  // Pick a ghost that was out-of-house + non-frightened across the entire
  // window. Frightened/eyes tiers are explicitly out of scope (#137
  // acceptance #1/#3 only cover chase/scatter visual cadence).
  const ghostName = (() => {
    for (const name of ["blinky", "pinky", "inky", "clyde"]) {
      const allOut = samples.every((s) => {
        const g = s.ghosts.find((gg) => gg.name === name);
        return g && g.status === "out" && (g.mode === "chase" || g.mode === "scatter");
      });
      if (allOut) return name;
    }
    return null;
  })();
  expect(
    ghostName,
    "at least one ghost should be released + non-frightened across the 1.5s window (Blinky starts 'out' from boot — if this fails the harness isn't reaching playing state)",
  ).not.toBeNull();

  // Per-frame Δposition for the selected ghost, in sub-tile units (the
  // probe returns the same float coords the renderer multiplies by TILE).
  const ghostDeltas: number[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const ga = a.ghosts.find((g) => g.name === ghostName)!;
    const gb = b.ghosts.find((g) => g.name === ghostName)!;
    const gdx = Math.hypot(gb.x - ga.x, gb.y - ga.y);
    // Filter tunnel wraps: ghost-can-only-move-1-tile-per-tick at speed
    // 0.10/tick, so any single-rAF jump >2 tiles is a coordinate-system
    // wrap (row 14 ↔ COLS), not a render artifact. Drop those frames
    // symmetrically so they don't pollute either invariant.
    if (gdx > 2) continue;
    ghostDeltas.push(gdx);
  }

  expect(ghostDeltas.length, "post-filter frame count").toBeGreaterThan(30);

  // INVARIANT 1: CONTINUOUS MOTION.
  // Steady-state ghost speed is 0.10 tiles/tick. At 60Hz fixed-step with
  // CI's rAF cadence, each rAF should advance ≥1 update → ≥0.10 per-frame
  // Δ, OR have a small rAF drift where the accumulator hasn't quite
  // crossed STEP_MS (which produces Δ < 1e-4 — still "moving" in the
  // smooth-glide sense). The pre-fix bug produced runs of EXACTLY-zero
  // frames between commit jumps. We threshold Δ > 1e-4 (a tile-snap bug
  // produces 0 here; legit glide produces 0.10+ on update-frames and
  // sub-pixel-near-zero on drift frames).
  //
  // The gate: ≥60% of frames must show motion. Pre-fix bug stalls for
  // ~9 of every 10 frames between commits → <15% moving → fails this.
  // Post-fix: every accumulator-draining frame moves → typically ≥80%.
  // 60% is the conservative floor that catches the bug with CI headroom.
  const movingFrames = ghostDeltas.filter((d) => d > 1e-4).length;
  const movingFraction = movingFrames / ghostDeltas.length;
  expect(
    movingFraction,
    `ghost should be visibly gliding most frames; got ${(movingFraction * 100).toFixed(1)}% moving frames of ${ghostDeltas.length}. A tile-snap bug stalls between commits and drops this below 30%.`,
  ).toBeGreaterThan(0.6);

  // INVARIANT 2: BOUNDED PER-FRAME Δ.
  // Ghost speed is 0.10 tiles/tick. CI's software-WebGL Playwright stack
  // can occasionally drain 2-3 fixed-step updates in one rAF (the engine
  // accumulator pattern; see Engine.frame() in engine.ts). 3 × 0.10 =
  // 0.30 is the worst-case legitimate Δ; we ceiling at 0.55 — 1.8×
  // headroom over that, and well below the 1.0-tile snap the pre-fix
  // bug produced on every commit frame.
  const maxGhostDx = Math.max(...ghostDeltas);
  expect(
    maxGhostDx,
    `no ghost frame should jump more than ~half a tile; got ${maxGhostDx.toFixed(4)}. A tile-snap bug produces ~1.0 here every commit frame.`,
  ).toBeLessThan(0.55);
});
