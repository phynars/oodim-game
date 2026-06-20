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
// THE INVARIANT — BOUNDED PER-FRAME Δ (CORNERING EXCLUDED)
// --------------------------------------------------------
// Three earlier revs of this spec failed on CI:
//   • Rev A compared maxGhostDx to maxPacDx as a ratio — brittle because
//     Pac parks at the first wall while ArrowRight is held, so the back
//     half of the window has Pac stationary while the ghost keeps gliding.
//   • Rev B added a "≥60% of frames must show motion" floor — brittle
//     because at 60Hz rAF + 60Hz STEP_MS the accumulator straddles: a
//     significant fraction of rAF frames drain ZERO updates and produce
//     an exactly-zero Δ. Software-WebGL CI amplifies this; the floor
//     trips on legitimate behavior.
//   • Rev C (this PR's first push) had a bare `maxGhostDx < 0.55` over
//     a 1.5s window — but Blinky spawns at (13,11) facing left, runs
//     into the wall at column 8, and TURNS DOWN. At that corner, the
//     prior frame's render pos is (~8.1, 11) and the next frame snaps
//     to (9, ~12.1) because tickGhost commits the new tile under the
//     NEW direction (lastDir flips left→down, the leftover `_progress`
//     is discarded). The Euclidean Δ across the corner is √(0.81+1.21)
//     ≈ 1.42 — legitimate behavior, but the bare bound treats it as a
//     tile-snap and fails. Cornering interpolation is an EXPLICIT
//     non-goal of #137 (acceptance #1/#3 cover straight-line glide);
//     see #145 for the cornering follow-up. We therefore exclude
//     corner-turn frames from the per-frame Δ check.
//
// The bug's signature is unambiguous on STRAIGHT-LINE frames: pre-fix,
// the ghost teleports a FULL tile (Δ ≈ 1.0) on every commit frame, even
// when going straight. Post-fix, the largest legitimate per-frame Δ on
// straight-line frames is bounded by `updates_per_frame * 0.10` (per-
// tick ghost speed). Even pathological CI bursts of 3 updates/frame top
// out around 0.30. A single self-parity invariant is sufficient and
// robust:
//
//   BOUNDED PER-FRAME Δ ON STRAIGHT-LINE FRAMES. Gate: max < 0.55.
//   • Pre-fix bug: ~1.0 every commit frame, including straight ones
//     → FAILS (catches the bug — corner exclusion doesn't help the
//     pre-fix code because the pre-fix render path produced ~1.0 even
//     on tile commits along a straight corridor).
//   • Post-fix CI floor: ~0.30 worst-case multi-update spike → PASSES
//     with 1.8× headroom.
//   • Corner frames (tile changed in both axes OR lastDir flipped
//     between samples) are excluded — out of scope per #137.
//
// We also sanity-check that the ghost made SOME forward progress across
// the window (total displacement > 1 tile) — otherwise the test is
// running against a stalled/in-house ghost and the bound is vacuously
// true. This sanity check is on aggregate displacement, NOT per-frame
// presence-of-motion, so accumulator straddle doesn't flake it.
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
        ghosts: Array<{
          name: string;
          x: number;
          y: number;
          tileX: number;
          tileY: number;
          lastDir: string;
          status: string;
          mode: string;
        }>;
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
  //
  // IMPORTANT: under Playwright the page boots without keyboard focus
  // on the canvas — page.keyboard.press() then routes to <body> and the
  // engine's keydown listener never sees it, so status never flips to
  // 'playing' and this spec times out. Every known-green Pac-Man
  // keyboard spec in this repo does canvas.click() FIRST to seat focus
  // before pressing a key. (Memory from a prior session: this is the
  // single most common cause of pacman e2e timeout-to-timeout flake.)
  const canvas = page.locator("canvas").first();
  await canvas.click();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => window.__pac?.status === "playing");

  // Sample render positions across a 1.5s window at rAF cadence. Blinky
  // starts out-of-house (`status: "out"`); the others are gated behind
  // the dot counter. We watch whichever ghost is `out` and in
  // chase/scatter for the full window.
  type Sample = {
    t: number;
    ghosts: Array<{
      name: string;
      x: number;
      y: number;
      tileX: number;
      tileY: number;
      lastDir: string;
      status: string;
      mode: string;
    }>;
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
  //
  // FILTERS (both out of scope per #137 acceptance #1/#3):
  //  1. Tunnel wraps. Ghost speed is 0.10 tiles/tick; any single-rAF
  //     jump >2 tiles must be a coordinate-system wrap on row 14
  //     (x ↔ COLS), not a render artifact.
  //  2. Corner-turn frames. When `lastDir` changes between two samples
  //     OR the tile coordinate changed in BOTH axes between samples,
  //     the ghost executed a tile commit with a direction flip — the
  //     leftover sub-tile progress is discarded and the render position
  //     legitimately snaps along the L of the corner (Δ can reach √2 ≈
  //     1.41 across one frame). Cornering interpolation is the #145
  //     follow-up; this gate only asserts straight-line glide.
  let cornerFramesDropped = 0;
  const ghostDeltas: number[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const ga = a.ghosts.find((g) => g.name === ghostName)!;
    const gb = b.ghosts.find((g) => g.name === ghostName)!;
    const gdx = Math.hypot(gb.x - ga.x, gb.y - ga.y);
    if (gdx > 2) continue;
    const lastDirChanged = ga.lastDir !== gb.lastDir;
    const tileChangedBothAxes = ga.tileX !== gb.tileX && ga.tileY !== gb.tileY;
    if (lastDirChanged || tileChangedBothAxes) {
      cornerFramesDropped += 1;
      continue;
    }
    ghostDeltas.push(gdx);
  }

  expect(ghostDeltas.length, "post-filter frame count").toBeGreaterThan(30);

  // SANITY: the ghost made some forward progress across the window.
  // If total Σ|Δ| < 1 tile across 1.5s, the test is running against a
  // stalled or in-house ghost and the bound below is vacuously true.
  // Post-fix steady-state: 1.5s × 60Hz × 0.10 tiles/tick = 9 tiles of
  // motion. We require > 1 tile (a tenfold safety margin), which a
  // legitimately-roaming Blinky clears in the first ~170ms.
  const totalGhostDisplacement = ghostDeltas.reduce((a, b) => a + b, 0);
  expect(
    totalGhostDisplacement,
    `ghost should accumulate >1 tile of glide across the window; got ${totalGhostDisplacement.toFixed(2)}. If this is ~0, the ghost is stalled in-house and Invariant 1 is vacuous.`,
  ).toBeGreaterThan(1);

  // INVARIANT — BOUNDED PER-FRAME Δ ON STRAIGHT-LINE FRAMES.
  // Ghost speed is 0.10 tiles/tick. CI's software-WebGL Playwright stack
  // can occasionally drain 2-3 fixed-step updates in one rAF (the engine
  // accumulator pattern; see Engine.frame() in engine.ts). 3 × 0.10 =
  // 0.30 is the worst-case legitimate Δ; we ceiling at 0.55 — 1.8×
  // headroom over that, and well below the 1.0-tile snap the pre-fix
  // bug produced on every commit frame.
  //
  // The pre-fix bug still trips this gate easily: before #137, the ghost
  // render path ignored `_progress` entirely, so per-frame Δ across a
  // tile commit was ~1.0 even on a STRAIGHT corridor — and straight-line
  // commits are NOT filtered out (tile changes in exactly one axis with
  // lastDir unchanged). Only corner turns (L-shaped tile change OR
  // lastDir flip) are excluded.
  const maxGhostDx = Math.max(...ghostDeltas);
  expect(
    maxGhostDx,
    `no straight-line ghost frame should jump more than ~half a tile; got ${maxGhostDx.toFixed(4)} (corner frames dropped: ${cornerFramesDropped}). A tile-snap bug produces ~1.0 here every commit frame.`,
  ).toBeLessThan(0.55);
});
