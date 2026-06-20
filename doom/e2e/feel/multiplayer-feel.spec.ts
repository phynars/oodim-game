// Multiplayer feel-assertion contract — executable proof that the four bars
// from phynars/oodim-game#131 FIRE on broken inputs and HOLD on correct ones.
//
// These tests don't touch the browser — they exercise the pure assertion
// primitives in multiplayer-feel.ts against synthesized fixture traces. The
// Playwright runner is just a convenient harness; once Soren's #129 driveTape
// lands and agar/ exists, the same primitives wrap real network traces.
//
// THE CONTRACT IS NUMBERS. Each test pairs a PASSING fixture (correct
// implementation) with a FAILING-ON-UNFIXED fixture (the bug the bar catches).
// Both must behave as advertised — a bar that never fails on a known-bad
// input isn't a bar, it's a comment.

import { expect, test } from "@playwright/test";

import {
  ADAPTIVE_BUFFER_WINDOW_MS,
  CLIENT_FRAME_MS,
  INPUT_TO_PIXEL_P99_MS,
  MIN_BUFFER_MS,
  RECONCILE_MEDIUM_MAX_FRAMES,
  RECONCILE_SMALL_MAX_FRAME_DELTA_PX,
  RECONCILE_SMALL_MIN_FRAMES,
  REMOTE_CONTINUITY_HEADROOM,
  RTT_MATRIX_MS,
  assertInputToPixel,
  assertJitterBufferAdaptive,
  assertReconcileSnapBack,
  assertRemoteSmoothness,
  expectedAdaptiveBufferMs,
  percentile,
  reconcileCurveFor,
  type InputToPixelSample,
  type JitterBufferSample,
  type ReconcileFrame,
  type RenderFrame,
} from "./multiplayer-feel";

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildInputSamples(opts: {
  drivenByPrediction: boolean;
  perRttBandDeltaMs: (rtt: number) => number[];
}): InputToPixelSample[] {
  const out: InputToPixelSample[] = [];
  for (const rtt of RTT_MATRIX_MS) {
    for (const deltaMs of opts.perRttBandDeltaMs(rtt)) {
      out.push({ rttMs: rtt, deltaMs, drivenByPrediction: opts.drivenByPrediction });
    }
  }
  return out;
}

/**
 * Build a render trace where one remote interpolates smoothly between
 * snapshots. Snapshots arrive every snapshotMs at speed px/sec; client
 * renders at 60fps. Linear interp → per-frame Δ ≈ speed/60.
 */
function buildInterpolatedRemoteTrace(opts: {
  durationMs: number;
  speedPxPerSec: number;
}): RenderFrame[] {
  const frames: RenderFrame[] = [];
  const nFrames = Math.floor(opts.durationMs / CLIENT_FRAME_MS);
  for (let i = 0; i <= nFrames; i++) {
    const t = i * CLIENT_FRAME_MS;
    const x = (opts.speedPxPerSec * t) / 1000;
    frames.push({
      frameTimeMs: t,
      renderedRemotes: [{ id: "r1", x, y: 0 }],
    });
  }
  return frames;
}

/**
 * Build a render trace where the client reads remote position directly from
 * the latest 20Hz (50ms) snapshot — no interp. Position steps every 50ms.
 * This is the §B failing fixture.
 */
function buildSnapshotReadRemoteTrace(opts: {
  durationMs: number;
  speedPxPerSec: number;
}): RenderFrame[] {
  const frames: RenderFrame[] = [];
  const nFrames = Math.floor(opts.durationMs / CLIENT_FRAME_MS);
  const snapshotMs = 50;
  for (let i = 0; i <= nFrames; i++) {
    const t = i * CLIENT_FRAME_MS;
    // Quantize to the most recent snapshot boundary.
    const lastSnap = Math.floor(t / snapshotMs) * snapshotMs;
    const x = (opts.speedPxPerSec * lastSnap) / 1000;
    frames.push({
      frameTimeMs: t,
      renderedRemotes: [{ id: "r1", x, y: 0 }],
    });
  }
  return frames;
}

// ─────────────────────────────────────────────────────────────────────────────
// §A — input-to-pixel latency
// ─────────────────────────────────────────────────────────────────────────────

test("§A input-to-pixel: predicted client passes the p99 bar across the full RTT matrix", () => {
  // Predicted: same-tick drain at every RTT — p99 well under one client frame.
  // Mix p50 same-tick (≈8ms) with a long tail of ~12-15ms; p99 stays ≤ 16.67.
  const samples = buildInputSamples({
    drivenByPrediction: true,
    perRttBandDeltaMs: () => [8, 8, 8, 8, 8, 8, 10, 12, 14, 15],
  });
  const result = assertInputToPixel(samples);
  expect(result.ok).toBe(true);
  expect(result.violations).toEqual([]);
  for (const rtt of RTT_MATRIX_MS) {
    expect(Number(result.summary[`p99_rtt_${rtt}ms`])).toBeLessThanOrEqual(
      INPUT_TO_PIXEL_P99_MS,
    );
  }
});

test("§A input-to-pixel: server-snapshot client FAILS — delta tracks RTT and prediction flag is false", () => {
  // The bug-class: render reads server snapshot. Delta ≈ RTT/2 (one-way) so
  // every band above 0ms blows past the 1-frame bar. The drivenByPrediction
  // violation also fires.
  const samples = buildInputSamples({
    drivenByPrediction: false,
    perRttBandDeltaMs: (rtt) => [rtt / 2, rtt / 2 + 4, rtt / 2 + 8],
  });
  const result = assertInputToPixel(samples);
  expect(result.ok).toBe(false);
  // The prediction-flag violation must be in the list.
  expect(
    result.violations.some((v) => v.includes("driven by server snapshot")),
  ).toBe(true);
  // And every nonzero RTT band must independently flag the p99 violation.
  for (const rtt of RTT_MATRIX_MS.filter((r) => r > 0)) {
    expect(
      result.violations.some((v) => v.includes(`RTT band ${rtt}ms`)),
    ).toBe(true);
  }
});

test("§A input-to-pixel: matrix incompleteness is a violation, not a silent pass", () => {
  // Only sample at 0ms RTT — the other bands are silently missing. That has
  // to fail the assertion: a half-tested matrix is the bug, not the bar.
  const samples: InputToPixelSample[] = [
    { rttMs: 0, deltaMs: 8, drivenByPrediction: true },
    { rttMs: 0, deltaMs: 10, drivenByPrediction: true },
  ];
  const result = assertInputToPixel(samples);
  expect(result.ok).toBe(false);
  for (const rtt of RTT_MATRIX_MS.filter((r) => r > 0)) {
    expect(
      result.violations.some(
        (v) => v.includes(`${rtt}ms`) && v.includes("no samples"),
      ),
    ).toBe(true);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// §B — remote-player smoothness
// ─────────────────────────────────────────────────────────────────────────────

test("§B remote smoothness: interpolated remote passes — per-frame Δ ≈ speed/60", () => {
  const speed = 240; // px/sec — agar/ blob ballpark
  const trace = buildInterpolatedRemoteTrace({ durationMs: 1000, speedPxPerSec: speed });
  const result = assertRemoteSmoothness(trace, speed);
  expect(result.ok).toBe(true);
  expect(result.violations).toEqual([]);
  // Sanity: max observed delta is within the headroom-padded bound.
  const bound = (speed / 60) * REMOTE_CONTINUITY_HEADROOM;
  expect(Number(result.summary["max_observed_delta_px"])).toBeLessThanOrEqual(bound);
});

test("§B remote smoothness: snapshot-read client FAILS — 50ms gap then 12px jump @ 240px/sec", () => {
  // The Pac-Man-ghost bug-class. At 240px/sec with no interp the client
  // renders the same position for ~3 frames, then steps 12px in one frame
  // when the next snapshot arrives — well over the 4.2px/frame bound.
  const trace = buildSnapshotReadRemoteTrace({ durationMs: 1000, speedPxPerSec: 240 });
  const result = assertRemoteSmoothness(trace, 240);
  expect(result.ok).toBe(false);
  expect(result.violations.length).toBeGreaterThan(0);
  // The max observed delta should be ≈ speed * snapshotMs/1000 = 12px.
  expect(Number(result.summary["max_observed_delta_px"])).toBeGreaterThan(8);
});

test("§B remote smoothness: empty / single-frame trace is a violation, not a vacuous pass", () => {
  expect(assertRemoteSmoothness([], 240).ok).toBe(false);
  expect(
    assertRemoteSmoothness(
      [{ frameTimeMs: 0, renderedRemotes: [{ id: "r1", x: 0, y: 0 }] }],
      240,
    ).ok,
  ).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────────────
// §C — reconciliation snap-back budget
// ─────────────────────────────────────────────────────────────────────────────

test("§C curve classification: 8px→blend, 24px→ease, 64px→snap", () => {
  expect(reconcileCurveFor(0)).toBe("blend");
  expect(reconcileCurveFor(8)).toBe("blend");
  expect(reconcileCurveFor(8.1)).toBe("ease");
  expect(reconcileCurveFor(24)).toBe("ease");
  expect(reconcileCurveFor(32)).toBe("ease");
  expect(reconcileCurveFor(32.1)).toBe("snap");
  expect(reconcileCurveFor(64)).toBe("snap");
});

test("§C reconcile blend (6px): 4-frame linear blend passes the ≤4px/frame bar", () => {
  // 6px error spread evenly across 4 frames → 1.5px/frame. Under the 4px bar
  // AND meets the ≥3-frame minimum.
  const trace: ReconcileFrame[] = [
    { frameTimeMs: 0, localDeltaPx: 0, attributableToCorrection: false },
    { frameTimeMs: 16.67, localDeltaPx: 1.5, attributableToCorrection: true },
    { frameTimeMs: 33.33, localDeltaPx: 1.5, attributableToCorrection: true },
    { frameTimeMs: 50.0, localDeltaPx: 1.5, attributableToCorrection: true },
    { frameTimeMs: 66.67, localDeltaPx: 1.5, attributableToCorrection: true },
  ];
  const result = assertReconcileSnapBack(trace, 6);
  expect(result.ok).toBe(true);
  expect(result.summary["curve"]).toBe("blend");
});

test("§C reconcile blend FAILS when correction collapses to one frame (snap masquerading as blend)", () => {
  // 6px correction applied as one 6px jump — fails the ≤4px/frame bar AND
  // the ≥3-frame minimum.
  const trace: ReconcileFrame[] = [
    { frameTimeMs: 0, localDeltaPx: 0, attributableToCorrection: false },
    { frameTimeMs: 16.67, localDeltaPx: 6, attributableToCorrection: true },
  ];
  const result = assertReconcileSnapBack(trace, 6);
  expect(result.ok).toBe(false);
  expect(
    result.violations.some((v) => v.includes(`${RECONCILE_SMALL_MIN_FRAMES} frames`)),
  ).toBe(true);
  expect(
    result.violations.some((v) =>
      v.includes(`${RECONCILE_SMALL_MAX_FRAME_DELTA_PX}px bar`),
    ),
  ).toBe(true);
});

test("§C reconcile ease (20px): cubic-ish 5-frame monotone curve passes", () => {
  // 20px correction over 5 frames with a cubic-ish profile (decelerating).
  // Each frame's delta < 20px (no overshoot) and the curve never re-accelerates.
  const trace: ReconcileFrame[] = [
    { frameTimeMs: 0, localDeltaPx: 0, attributableToCorrection: false },
    { frameTimeMs: 16.67, localDeltaPx: 6, attributableToCorrection: true },
    { frameTimeMs: 33.33, localDeltaPx: 6, attributableToCorrection: true },
    { frameTimeMs: 50.0, localDeltaPx: 4, attributableToCorrection: true },
    { frameTimeMs: 66.67, localDeltaPx: 3, attributableToCorrection: true },
    { frameTimeMs: 83.33, localDeltaPx: 1, attributableToCorrection: true },
  ];
  const result = assertReconcileSnapBack(trace, 20);
  expect(result.ok).toBe(true);
  expect(result.summary["curve"]).toBe("ease");
});

test("§C reconcile ease FAILS on overshoot (single-frame Δ > total magnitude)", () => {
  // A 12px correction "ease" where the engine actually slammed 18px in one
  // frame — overshoot. The single-frame Δ > magnitude violation fires.
  const trace: ReconcileFrame[] = [
    { frameTimeMs: 0, localDeltaPx: 0, attributableToCorrection: false },
    { frameTimeMs: 16.67, localDeltaPx: 18, attributableToCorrection: true },
  ];
  const result = assertReconcileSnapBack(trace, 12);
  expect(result.ok).toBe(false);
  expect(result.violations.some((v) => v.includes("overshoot"))).toBe(true);
});

test("§C reconcile ease FAILS when frame count exceeds the 6-frame clamp", () => {
  // 20px correction stretched over 8 frames — passes the per-frame bound but
  // exceeds the clamp. The ease window has to end within 100ms or it stops
  // feeling like a correction and starts feeling like drift.
  const trace: ReconcileFrame[] = [
    { frameTimeMs: 0, localDeltaPx: 0, attributableToCorrection: false },
    ...Array.from({ length: 8 }, (_, i) => ({
      frameTimeMs: (i + 1) * 16.67,
      localDeltaPx: 2.5,
      attributableToCorrection: true,
    })),
  ];
  const result = assertReconcileSnapBack(trace, 20);
  expect(result.ok).toBe(false);
  expect(
    result.violations.some((v) => v.includes(`${RECONCILE_MEDIUM_MAX_FRAMES} frame clamp`)),
  ).toBe(true);
});

test("§C reconcile snap (50px): one-frame correction is HONEST, not a violation", () => {
  // A >32px correction is allowed (and required) to snap — respawn, dramatic
  // collision, teleport. The assertion enforces exactly-one frame here so a
  // sneaky "blend over 8 frames" of a 50px error doesn't mask itself as ease.
  const trace: ReconcileFrame[] = [
    { frameTimeMs: 0, localDeltaPx: 0, attributableToCorrection: false },
    { frameTimeMs: 16.67, localDeltaPx: 50, attributableToCorrection: true },
  ];
  const result = assertReconcileSnapBack(trace, 50);
  expect(result.ok).toBe(true);
  expect(result.summary["curve"]).toBe("snap");
});

// ─────────────────────────────────────────────────────────────────────────────
// §D — jitter buffer adaptivity
// ─────────────────────────────────────────────────────────────────────────────

test("§D adaptive buffer: depth tracks rolling RTT_p90, no underruns → passes", () => {
  // Steady 80ms RTT for 3 seconds, buffer holds at ~80ms (p90 of constant
  // 80 is 80). Zero underruns.
  const samples: JitterBufferSample[] = [];
  for (let t = 0; t <= 3000; t += 100) {
    samples.push({
      tMs: t,
      rttMs: 80,
      effectiveBufferMs: 80,
      underrunCount: 0,
    });
  }
  const result = assertJitterBufferAdaptive(samples);
  expect(result.ok).toBe(true);
  expect(Number(result.summary["underruns"])).toBe(0);
});

test("§D expectedAdaptiveBufferMs: clamped at MIN_BUFFER_MS when RTT_p90 is low", () => {
  // 10ms RTT samples — p90 is 10, but the floor MUST clamp to 50ms.
  const samples: JitterBufferSample[] = [];
  for (let t = 0; t <= 1000; t += 100) {
    samples.push({ tMs: t, rttMs: 10, effectiveBufferMs: 50, underrunCount: 0 });
  }
  expect(expectedAdaptiveBufferMs(samples, 1000)).toBe(MIN_BUFFER_MS);
});

test("§D adaptive buffer: fixed-depth buffer that ignores RTT spike FAILS — underruns + drift", () => {
  // RTT jumps from 80 → 200ms mid-trace. A fixed 80ms buffer doesn't adapt,
  // so it drifts ~120ms from the expected (rolling p90 climbs to ≥180ms)
  // AND underruns rack up as snapshots arrive too late.
  const samples: JitterBufferSample[] = [];
  for (let t = 0; t <= 1000; t += 100) {
    samples.push({ tMs: t, rttMs: 80, effectiveBufferMs: 80, underrunCount: 0 });
  }
  for (let t = 1100; t <= 3000; t += 100) {
    samples.push({ tMs: t, rttMs: 200, effectiveBufferMs: 80, underrunCount: 3 });
  }
  const result = assertJitterBufferAdaptive(samples);
  expect(result.ok).toBe(false);
  expect(Number(result.summary["underruns"])).toBeGreaterThan(0);
  expect(result.violations.some((v) => v.includes("underrun"))).toBe(true);
  expect(result.violations.some((v) => v.includes("drift"))).toBe(true);
});

test("§D adaptive buffer FAILS when depth drops below MIN_BUFFER_MS even briefly", () => {
  // A buffer that auto-shrinks to 0 when network looks clean (the
  // optimization-gone-wrong) — single-tick spike to 30ms blows the floor.
  const samples: JitterBufferSample[] = [];
  for (let t = 0; t <= 2000; t += 100) {
    samples.push({
      tMs: t,
      rttMs: 60,
      effectiveBufferMs: t === 500 ? 30 : 60,
      underrunCount: 0,
    });
  }
  const result = assertJitterBufferAdaptive(samples);
  expect(result.ok).toBe(false);
  expect(
    result.violations.some((v) => v.includes(`< MIN_BUFFER_MS (${MIN_BUFFER_MS}ms)`)),
  ).toBe(true);
});

test("§D expectedAdaptiveBufferMs: window-bounded — old samples outside the window don't contribute", () => {
  // RTT was 500ms 3 seconds ago, settled to 80ms in the last second. The
  // expected depth at t=4000 must reflect ONLY the last 2s of samples.
  const samples: JitterBufferSample[] = [];
  // Spike 3s+ ago (outside the 2s window).
  for (let t = 0; t <= 1000; t += 100) {
    samples.push({ tMs: t, rttMs: 500, effectiveBufferMs: 500, underrunCount: 0 });
  }
  // Calm last 2s.
  for (let t = 2100; t <= 4000; t += 100) {
    samples.push({ tMs: t, rttMs: 80, effectiveBufferMs: 80, underrunCount: 0 });
  }
  const expected = expectedAdaptiveBufferMs(
    samples,
    4000,
    ADAPTIVE_BUFFER_WINDOW_MS,
  );
  // Should be ~80ms (the calm window), NOT pulled up by the ancient spike.
  expect(expected).toBeLessThan(100);
  expect(expected).toBeGreaterThanOrEqual(MIN_BUFFER_MS);
});

// ─────────────────────────────────────────────────────────────────────────────
// percentile helper — its correctness backs every other assertion
// ─────────────────────────────────────────────────────────────────────────────

test("percentile: Type-7 linear interpolation matches expected values", () => {
  // q=0 → min, q=1 → max, q=0.5 → median (for odd length).
  expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
  expect(percentile([1, 2, 3, 4, 5], 1)).toBe(5);
  expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  // p99 of a fast-with-tail distribution catches the tail, not the median.
  const xs = [...Array(99).fill(8), 50];
  expect(percentile(xs, 0.99)).toBeGreaterThan(8);
  // Single sample: any percentile returns the sample.
  expect(percentile([42], 0.5)).toBe(42);
  // Empty: NaN (handled as a violation by the assertion layer).
  expect(Number.isNaN(percentile([], 0.5))).toBe(true);
});
