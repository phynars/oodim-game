// Merge-gate spec for #137 (Pac-Man ghost render interpolation).
//
// THE BUG THIS CATCHES
// --------------------
// Before #137's fix, ghost sprites snapped from tile center to tile center
// while Pac-Man glided smoothly via `pac._progress`. Two actors on the same
// grid rendered under different rules — a visual-consistency violation any
// arcade player picks up subconsciously.
//
// After the fix, `GhostInternal._progress` is advanced each tick in
// `pacman/src/game/ghost.ts` and consumed by `renderGhosts()` in
// `pacman/src/game/engine.ts` with the same `(tile + dir * progress) * TILE`
// math shape as `renderPac()`.
//
// THE INVARIANT
// -------------
// For two actors moving at the same logical tile-speed across a straight-line
// span, the per-frame Δposition envelope of the ghost render path must match
// Pac's. The pre-fix bug was a >5× violation (ghost holds for N frames then
// jumps a full tile in one). We assert the looser CI-realistic bound that
// still catches that magnitude:
//
//   - max(ghostDx) / max(pacDx) ∈ [0.75, 1.25]   (±25% ratio)
//   - no single ghost-frame Δposition exceeds 3.5× the steady-state per-
//     frame budget (the per-frame bound from #137 acceptance, relaxed for
//     software-WebGL rAF jitter on CI)
//
// CI tolerance rationale: past Pac-Man feel specs in this repo proved that
// ±5% / 1.05× headroom is too tight for the software-rasterizer rAF jitter
// that CI Playwright runs see. The pre-fix bug is a >5× violation, so
// ±25% / 3.5× still catches it — and stays green when the code is right.
//
// PROBE
// -----
// This spec relies on `window.__pacInternals.renderPositions()` returning
// the same sub-tile float coords that `renderPac` / `renderGhosts` use to
// draw. If that probe does not exist yet, ADD IT in engine.ts mirroring the
// draw-math: `pac.x + dx * (_progress ?? 0)` for Pac and
// `g.x + gdx * (status === "out" ? _progress : 0)` for each ghost.
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

test("ghost render position glides at the same per-frame cadence as Pac", async ({
  page,
}) => {
  await page.goto("/");
  // Wait for boot — status flips to 'ready' synchronously in the Engine
  // constructor (publishes window.__pac immediately).
  await page.waitForFunction(() => window.__pac?.status === "ready");

  // Guard: the spec requires the render-position probe. If it's missing,
  // this is the first thing to add — see top-of-file comment.
  const hasProbe = await page.evaluate(
    () => typeof window.__pacInternals?.renderPositions === "function",
  );
  expect(
    hasProbe,
    "window.__pacInternals.renderPositions() must exist — add a probe in engine.ts that mirrors renderPac/renderGhosts math (see #137 follow-up comment).",
  ).toBe(true);

  // Kick play with a right-press so Pac unparks and tickPac runs.
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => window.__pac?.status === "playing");

  // Sample render positions across a 2-second window. We sample every rAF
  // and let both Pac (driven by the right-hold) and the released ghosts
  // (Blinky starts out-of-house) move freely. Worst-case the ghost reverses
  // direction mid-window — we'll filter for straight-line sub-windows in
  // post-processing rather than try to force a corridor.
  type Sample = {
    t: number;
    pac: { x: number; y: number };
    ghosts: Array<{ name: string; x: number; y: number; status: string; mode: string }>;
  };
  await page.keyboard.down("ArrowRight");
  const samples: Sample[] = await page.evaluate(async (durationMs: number) => {
    const out: Sample[] = [];
    await new Promise<void>((resolve) => {
      const start = performance.now();
      const step = () => {
        const rp = window.__pacInternals!.renderPositions!();
        out.push({ t: performance.now(), pac: rp.pac, ghosts: rp.ghosts });
        if (performance.now() - start >= durationMs) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    return out;
  }, 2000);
  await page.keyboard.up("ArrowRight");

  expect(samples.length, "should have collected rAF samples").toBeGreaterThan(60);

  // Pick a chase/scatter ghost that was actually out-of-house for the full
  // trace — we want render motion under the same rules as Pac. Frightened/
  // eyes tiers are #145's lane.
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
    "at least one ghost should be released + non-frightened across the 2s window",
  ).not.toBeNull();

  // Per-frame deltas. Sub-tile units (the probe returns the same float coords
  // the renderer multiplies by TILE). Ratio invariance holds regardless of
  // unit — we compare maxes, not absolutes.
  const pacDeltas: number[] = [];
  const ghostDeltas: number[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const ga = a.ghosts.find((g) => g.name === ghostName)!;
    const gb = b.ghosts.find((g) => g.name === ghostName)!;
    // Skip frames where Pac wrapped through the tunnel (huge synthetic delta).
    const pdx = Math.hypot(b.pac.x - a.pac.x, b.pac.y - a.pac.y);
    const gdx = Math.hypot(gb.x - ga.x, gb.y - ga.y);
    // Tunnel wrap shows up as a >5-tile jump; the longest legitimate
    // per-frame motion is well under 1 tile. Filter both actors symmetrically.
    if (pdx > 2 || gdx > 2) continue;
    pacDeltas.push(pdx);
    ghostDeltas.push(gdx);
  }

  expect(pacDeltas.length, "post-filter samples").toBeGreaterThan(30);

  const maxPacDx = Math.max(...pacDeltas);
  const maxGhostDx = Math.max(...ghostDeltas);

  // Pac must actually be moving — sanity-check the harness, not the bug.
  expect(maxPacDx, "Pac should be moving during the right-hold").toBeGreaterThan(0.005);

  // INVARIANT 1: visual-cadence parity.
  // Ratio in [0.75, 1.25] catches the pre-fix bug (which is a >5× spike)
  // while tolerating CI software-WebGL rAF jitter that breaks tighter ±5%
  // tolerances on this stack.
  const ratio = maxGhostDx / maxPacDx;
  expect(
    ratio,
    `ghost max-Δ / pac max-Δ should be ~1; got ${ratio.toFixed(3)} (maxGhostDx=${maxGhostDx.toFixed(4)}, maxPacDx=${maxPacDx.toFixed(4)}). The pre-#137 snap drove this ratio >5.`,
  ).toBeGreaterThan(0.75);
  expect(ratio).toBeLessThan(1.25);

  // INVARIANT 2: no single frame spikes catastrophically.
  // The pre-fix bug rendered a ghost holding still for N frames then jumping
  // a full tile in one — so the worst frame was ~N× the steady-state. Pac's
  // own maxPacDx gives us the steady-state envelope on THIS run; assert no
  // ghost frame exceeds 3.5× that (CI-realistic headroom). The bug would
  // produce a value many multiples higher.
  const perFrameBound = maxPacDx * 3.5;
  const worstGhostFrame = Math.max(...ghostDeltas);
  expect(
    worstGhostFrame,
    `no ghost frame should exceed 3.5× the steady-state per-frame budget (${perFrameBound.toFixed(4)}); got ${worstGhostFrame.toFixed(4)}. A tile-snap bug would blow past this.`,
  ).toBeLessThan(perFrameBound);
});
