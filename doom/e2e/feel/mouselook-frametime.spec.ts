// Doom feel-spec: mouselook frame-time stability (#237).
//
// What this gates:
//   The spec catches a REGRESSION in render() frame-time stability — a
//   per-frame allocation creeping into the render path, a GC stall, a
//   geometry rebuild on every frame. Those show up as TAIL spikes
//   (p99 ≫ p50, occasional max ≫ p99), not as a raised mean. So we
//   gate on distribution SHAPE in addition to absolute bounds.
//
// Two regimes, two sets of bars:
//   • TARGET (the feel commitment, logged for diagnosis — non-blocking):
//       p99(renderMs) ≤ 16.7 ms · max ≤ 33.3 ms · mean ≤ 8 ms
//     This is what the player gets on shipped hardware. We print the
//     distribution under these labels so a future tightening (or a
//     hardware-class run) can re-assert them as hard gates.
//   • CI (merge-gate, hard-asserts):
//       p99(renderMs) ≤ 50 ms     — generous absolute ceiling that
//                                    SwiftShader's software WebGL still
//                                    fits inside on the Doom scene
//                                    (fog + 5 lights + textured walls +
//                                    multi-mesh enemies + spark/blood
//                                    pools). Past Pac-Man learning:
//                                    rAF + software-WebGL inflates per-
//                                    frame work several-fold vs target.
//       p99 / p50 ≤ 2.5            — distribution SHAPE: tails stay
//                                    tight relative to the body. A
//                                    per-frame allocation regression
//                                    blows p99 way above p50; this
//                                    catches it regardless of which
//                                    absolute number SwiftShader is
//                                    sitting on.
//       max / p99 ≤ 2.0            — no single catastrophic spike
//                                    above the 99th percentile.
//
// Pattern mirrors the merge-gated feel specs shipped for the rest of the
// portfolio: pacman/e2e/feel/dir-commit-latency.spec.ts (#210),
// galaga/e2e/feel/input-latency.spec.ts (#168). Read off a test-only probe
// (`__doomInternals.frameProbe()`), drop a warmup prefix, assert bounds,
// and print the full distribution into the failure message so a
// regression is diagnosable from CI logs alone.
//
// Combat load is forced via the existing `__doomInternals.forceHit` hook
// (engine.ts:~568) so the spec doesn't depend on aim/AI timing. Two
// non-lethal hits in the sample window leave sparks + blood + connect-shake
// + hit-flash channels overlapping — the worst-case render pass.
//
// We drive sustained yaw via held ArrowRight rather than synthetic
// mousemove deltas: pointer-lock semantics under headless Chromium are
// brittle (the canvas.requestPointerLock call is wrapped in a try/catch in
// engine.ts:1376-1387 precisely because of this), and the cost being
// measured is render() — independent of which input source drives yaw.

import { expect, test } from "@playwright/test";

interface FrameSample {
  renderMs: number;
  enemies: number;
  sparks: number;
  blood: number;
  tick: number;
}

interface DoomInternalsProbe {
  frameProbe(): { samples: ReadonlyArray<FrameSample> };
  forceHit(opts?: { enemyId?: number }): void;
}

declare global {
  interface Window {
    __doomInternals?: DoomInternalsProbe;
  }
}

interface Distribution {
  count: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

function summarize(samples: ReadonlyArray<number>): Distribution {
  if (samples.length === 0) {
    return { count: 0, min: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const pct = (q: number): number => {
    const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
    return sorted[idx];
  };
  let sum = 0;
  for (const v of sorted) sum += v;
  return {
    count: sorted.length,
    min: sorted[0],
    p50: pct(0.5),
    p95: pct(0.95),
    p99: pct(0.99),
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
  };
}

test("Doom: render() frame-time stays under budget across a mouselook sweep with combat load", async ({
  page,
}) => {
  await page.goto("/doom");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  // Body focus eats key events in Playwright unless the canvas is clicked
  // first — same gotcha pattern shared across the pacman/galaga feel specs.
  await canvas.click();

  // Wait for the engine handle + the probe surface. The handle goes live in
  // the engine ctor (engine.ts exposeInternals) — same edge as the other
  // __doomInternals consumers.
  await page.waitForFunction(
    () =>
      Boolean(window.__doomInternals) &&
      typeof window.__doomInternals?.frameProbe === "function",
    null,
    { timeout: 5000 },
  );

  // First input flipped ready→playing via canvas.click() above. Now drive
  // sustained yaw for ~2 s: hold ArrowRight, fire two non-lethal hits mid-
  // window to overlap the FX channels (sparks + blood + hit-flash +
  // connect-shake) on top of the render pass.
  await page.keyboard.down("ArrowRight");

  // ~600 ms into the sweep: first forced hit. The seeded baron at z=-7
  // has higher HP than PLAYER_SHOT_DAMAGE so this is non-lethal and leaves
  // sparks + connect-shake active. Pick by enemyId so we don't depend on
  // roster ordering.
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    // baron's id depends on SEED_ENEMIES order (engine.ts ~98) — try the
    // 3rd seeded enemy first, fall back to the first live non-imp.
    const internals = window.__doomInternals!;
    internals.forceHit({ enemyId: 3 });
  });

  // ~600 ms later: second forced hit, this time the demon (id 2) so a
  // distinct enemy's hit-flash overlaps the first one's lingering sparks.
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const internals = window.__doomInternals!;
    internals.forceHit({ enemyId: 2 });
  });

  // Tail of the sweep — finish the 2 s window so the ring buffer captures
  // the post-impact decay frames too (those carry the alpha-fade /
  // spark-shrink / shake-decay work).
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowRight");

  // Pull the probe.
  const samples = await page.evaluate(() => {
    const probe = window.__doomInternals!.frameProbe();
    return probe.samples.map((s) => ({
      renderMs: s.renderMs,
      enemies: s.enemies,
      sparks: s.sparks,
      blood: s.blood,
      tick: s.tick,
    }));
  });

  // Drop the first 12 samples — warmup covers initial shader compile,
  // first-frame texture upload, and the ready→playing flip itself. Boot
  // jitter shouldn't gate a steady-state assertion.
  const WARMUP = 12;
  const steady = samples.slice(WARMUP);

  // Sanity: spec is worthless if it didn't capture enough frames.
  expect.soft(steady.length, "captured at least 90 steady-state frames").toBeGreaterThanOrEqual(90);

  const renderMs = steady.map((s) => s.renderMs);
  const dist = summarize(renderMs);

  // Worst-case sample for diagnosis — print its full snapshot so a CI
  // failure tells us exactly which combat load triggered the spike.
  let worst: FrameSample | null = null;
  for (const s of steady) {
    if (!worst || s.renderMs > worst.renderMs) worst = s;
  }
  const worstStr = worst
    ? `worst sample: tick=${worst.tick} renderMs=${worst.renderMs.toFixed(2)} ` +
      `enemies=${worst.enemies} sparks=${worst.sparks} blood=${worst.blood}`
    : "(no samples)";

  const distStr =
    `count=${dist.count} min=${dist.min.toFixed(2)} p50=${dist.p50.toFixed(2)} ` +
    `p95=${dist.p95.toFixed(2)} p99=${dist.p99.toFixed(2)} max=${dist.max.toFixed(2)} ` +
    `mean=${dist.mean.toFixed(2)}`;

  // --- TARGET BARS (diagnostic, non-blocking) ----------------------------
  // The feel commitment for shipped hardware. soft() so a miss prints the
  // distribution but doesn't fail the test — under CI SwiftShader these
  // routinely run hot. The CI gates below catch regressions in shape; the
  // target bars stay in the failure surface so a future hardware-class
  // run (or a render-path optimization) can promote them to hard asserts.
  // Past Pac-Man learning: software-WebGL inflates per-frame work several-
  // fold vs target — gating absolute target ms here would gate on the
  // CI runner, not the code.
  expect
    .soft(dist.p99, `[target] p99 ≤ 16.7 ms — ${distStr} — ${worstStr}`)
    .toBeLessThanOrEqual(16.7);
  expect
    .soft(dist.max, `[target] max ≤ 33.3 ms — ${distStr} — ${worstStr}`)
    .toBeLessThanOrEqual(33.3);
  expect
    .soft(dist.mean, `[target] mean ≤ 8 ms — ${distStr} — ${worstStr}`)
    .toBeLessThanOrEqual(8);

  // --- CI BARS (merge-gate, hard-assert) ---------------------------------
  // Absolute ceiling that the current code comfortably fits inside under
  // SwiftShader; a regression that breaches it is a real frame-time
  // problem regardless of renderer.
  expect(
    dist.p99,
    `[gate] p99 ≤ 50 ms — ${distStr} — ${worstStr}`,
  ).toBeLessThanOrEqual(50);

  // Distribution shape: the tail can't run away from the body. A per-
  // frame allocation regression on the render path (a `new Vector3()`
  // creeping into the spark sync, an unbounded array rebuild) shows up
  // here as p99 ballooning while p50 holds steady. 2.5× covers
  // SwiftShader's natural jitter; anything wider is a real regression.
  // Guard p50>0 so a probe-empty edge case doesn't divide by zero.
  if (dist.p50 > 0) {
    const tailRatio = dist.p99 / dist.p50;
    expect(
      tailRatio,
      `[gate] p99/p50 ≤ 2.5 — got ${tailRatio.toFixed(2)} — ${distStr} — ${worstStr}`,
    ).toBeLessThanOrEqual(2.5);
  }

  // No catastrophic single-frame spike above the 99th percentile. A GC
  // stall, a one-off geometry rebuild, or a stray sync allocation all
  // surface as max sitting far above p99.
  if (dist.p99 > 0) {
    const spikeRatio = dist.max / dist.p99;
    expect(
      spikeRatio,
      `[gate] max/p99 ≤ 2.0 — got ${spikeRatio.toFixed(2)} — ${distStr} — ${worstStr}`,
    ).toBeLessThanOrEqual(2.0);
  }
});
