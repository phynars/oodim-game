// Multiplayer feel-assertion contract — the four numeric merge gates from
// phynars/oodim-game#131. Pure, engine-agnostic functions that operate on
// trace shapes the harness produces; no DOM, no Playwright, no three.js.
//
// Why this lives in doom/e2e/feel rather than in agar/ or e2e-shared/:
//  · agar/ doesn't exist yet (it's #130's rung); when it does, this file moves
//    or its tests import from here unchanged.
//  · e2e-shared/multiplayer/ is Soren's #129 module — also not landed yet.
//  · Doom is the most mature engine in this repo and already publishes a
//    state-contract harness pattern (window.__doom + e2e/doom.spec.ts).
//    Co-locating with the existing Playwright runner means these assertions
//    run in CI today, against fixture traces, so the bars are PROVEN to fire
//    on bad inputs and hold on good ones.
//
// THE CONTRACT IS NUMBERS. Each assertion returns a structured result
// { ok, violations, summary } rather than throwing — composable across an
// RTT matrix, and debuggable (the violation list names the exact frame/tick
// that broke the bar). The harness layer turns ok===false into a test
// failure (see multiplayer-feel.spec.ts).
//
// Refs phynars/oodim-game#131 (this contract), #129 (Soren's structural
// sibling), #130 (agar/ — first consumer).

// ─────────────────────────────────────────────────────────────────────────────
// Numeric bars — single source of truth for the issue §A–D values.
// ─────────────────────────────────────────────────────────────────────────────

/** Client frame budget @ 60fps. */
export const CLIENT_FRAME_MS = 1000 / 60;

/** §A: p99 input→pixel ≤ 1 client frame across the RTT matrix. */
export const INPUT_TO_PIXEL_P99_MS = CLIENT_FRAME_MS;

/** §A: simulated RTT bands (ms) the bar must hold across. */
export const RTT_MATRIX_MS = [0, 80, 150, 250] as const;

/** §B: 5% headroom over (max_speed × 1/60) — float-drift cushion. */
export const REMOTE_CONTINUITY_HEADROOM = 1.05;

/** §B: interp buffer window behind newest snapshot (Source-engine standard). */
export const INTERP_BUFFER_MIN_MS = 100;
export const INTERP_BUFFER_MAX_MS = 150;

/** §C: snap-back curve magnitude thresholds (px). */
export const RECONCILE_SMALL_PX = 8;
export const RECONCILE_MEDIUM_PX = 32;

/** §C: small-correction blend — ≥3 frames, no single-frame Δ > 4px. */
export const RECONCILE_SMALL_MIN_FRAMES = 3;
export const RECONCILE_SMALL_MAX_FRAME_DELTA_PX = 4;

/** §C: medium-correction cubic ease — clamped at 6 frames (100ms). */
export const RECONCILE_MEDIUM_MAX_FRAMES = 6;

/** §D: minimum non-zero jitter buffer depth — 1 tick @ 20Hz. */
export const MIN_BUFFER_MS = 50;

/** §D: rolling window for adaptive RTT_p90 calculation. */
export const ADAPTIVE_BUFFER_WINDOW_MS = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// Trace shapes — what the harness produces / the assertions consume.
// ─────────────────────────────────────────────────────────────────────────────

export interface InputToPixelSample {
  /** RTT band this sample was collected under, ms. */
  rttMs: number;
  /** Wall-clock ms from input dispatch → first render frame showing its effect. */
  deltaMs: number;
  /**
   * Whether the visible effect came from PREDICTED state (client-side prediction)
   * or from the last server snapshot. The bar requires the former — a server-snapshot
   * read with deltaMs <= 16.7ms only at 0 RTT is the same bug at 250ms RTT.
   */
  drivenByPrediction: boolean;
}

export interface RenderFrame {
  /** Monotonic ms timestamp of this client render frame. */
  frameTimeMs: number;
  /** Per-remote rendered position this frame. */
  renderedRemotes: Array<{ id: string; x: number; y: number }>;
}

export interface ReconcileFrame {
  /** Monotonic ms timestamp. */
  frameTimeMs: number;
  /** Pixel delta in the LOCAL avatar's rendered position vs previous frame. */
  localDeltaPx: number;
  /** True iff this frame's delta is attributable to a server correction blend. */
  attributableToCorrection: boolean;
}

export interface JitterBufferSample {
  /** Monotonic ms timestamp. */
  tMs: number;
  /** Measured RTT for the most recent snapshot at this sample, ms. */
  rttMs: number;
  /** Effective buffer depth in use this sample, ms. */
  effectiveBufferMs: number;
  /** Cumulative count of buffer underruns observed up to this sample. */
  underrunCount: number;
}

export interface AssertionResult {
  ok: boolean;
  violations: string[];
  summary: Record<string, number | string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// §A — input-to-pixel latency under simulated RTT
// ─────────────────────────────────────────────────────────────────────────────
//
// The local player's own avatar must NEVER feel laggy. Client-side prediction
// is non-negotiable. This assertion catches:
//   · render reads from server snapshot → delta grows with RTT
//   · prediction exists but isn't applied to the rendered avatar
//   · one-off long tail (p99) hidden by a fast p50
//   · matrix incompleteness — every RTT band must have samples
export function assertInputToPixel(samples: InputToPixelSample[]): AssertionResult {
  const violations: string[] = [];
  const summary: Record<string, number | string> = {};

  if (samples.length === 0) {
    return { ok: false, violations: ["no samples provided"], summary };
  }

  const nonPredicted = samples.filter((s) => !s.drivenByPrediction);
  if (nonPredicted.length > 0) {
    violations.push(
      `${nonPredicted.length}/${samples.length} samples driven by server snapshot, not prediction`,
    );
  }

  for (const rtt of RTT_MATRIX_MS) {
    const band = samples.filter((s) => s.rttMs === rtt);
    if (band.length === 0) {
      violations.push(`RTT band ${rtt}ms: no samples (matrix incomplete)`);
      continue;
    }
    const p99 = percentile(
      band.map((s) => s.deltaMs),
      0.99,
    );
    summary[`p99_rtt_${rtt}ms`] = round2(p99);
    if (p99 > INPUT_TO_PIXEL_P99_MS) {
      violations.push(
        `RTT band ${rtt}ms: p99 input→pixel ${p99.toFixed(2)}ms > ${INPUT_TO_PIXEL_P99_MS.toFixed(2)}ms bar`,
      );
    }
  }

  return { ok: violations.length === 0, violations, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// §B — remote-player smoothness (interp between server snapshots)
// ─────────────────────────────────────────────────────────────────────────────
//
// At 20Hz tick + 60fps render that's 3 client frames per snapshot. Without
// interp, remote players step 50ms at a time — a visible snap. Same bug-class
// as the Pac-Man ghost snap I already audited (ghosts jumped tile-to-tile
// while Pac glided via `_progress`).
//
// Per-client-frame Δ for any remote must be ≤ (max_speed × 1/60) × headroom.
// At 240px/sec that's 4.2px/frame; a "read from snapshot" client shows 12px
// jumps every 50ms and the assertion fires immediately.
export function assertRemoteSmoothness(
  trace: RenderFrame[],
  remoteMaxSpeedPxPerSec: number,
): AssertionResult {
  const violations: string[] = [];
  const summary: Record<string, number | string> = {};

  if (trace.length < 2) {
    return {
      ok: false,
      violations: ["trace must contain at least 2 frames"],
      summary,
    };
  }

  const bound = (remoteMaxSpeedPxPerSec / 60) * REMOTE_CONTINUITY_HEADROOM;
  summary["per_frame_delta_bound_px"] = round2(bound);

  let maxObserved = 0;
  let maxObservedRemoteId = "";
  let maxObservedFrameTime = 0;

  for (let i = 1; i < trace.length; i++) {
    const prev = trace[i - 1]!;
    const curr = trace[i]!;
    const prevById = new Map(prev.renderedRemotes.map((r) => [r.id, r] as const));
    for (const r of curr.renderedRemotes) {
      const p = prevById.get(r.id);
      if (!p) continue; // joined this frame — not a continuity violation
      const delta = Math.hypot(r.x - p.x, r.y - p.y);
      if (delta > maxObserved) {
        maxObserved = delta;
        maxObservedRemoteId = r.id;
        maxObservedFrameTime = curr.frameTimeMs;
      }
      if (delta > bound) {
        violations.push(
          `remote ${r.id} @ t=${curr.frameTimeMs.toFixed(1)}ms: Δ=${delta.toFixed(2)}px > ${bound.toFixed(2)}px bound`,
        );
      }
    }
  }

  summary["max_observed_delta_px"] = round2(maxObserved);
  summary["max_observed_remote"] = maxObservedRemoteId;
  summary["max_observed_at_ms"] = round2(maxObservedFrameTime);

  return { ok: violations.length === 0, violations, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// §C — reconciliation snap-back budget
// ─────────────────────────────────────────────────────────────────────────────
//
// When client prediction diverges from server authority (collision pushed me),
// the local avatar must correct without a visible snap. Three magnitude bands,
// three curves:
//   · ≤ 8px : blend over ≥3 frames, no single-frame Δ > 4px (linear-ish)
//   · 8–32px: cubic ease, clamped at 6 frames, monotone (no overshoot)
//   · > 32px: snap in one frame (respawn / collision / teleport — honest)

export type ReconcileCurve = "blend" | "ease" | "snap";

/** Magnitude → expected curve. Exported so harness drives the matrix from one place. */
export function reconcileCurveFor(magnitudePx: number): ReconcileCurve {
  if (magnitudePx <= RECONCILE_SMALL_PX) return "blend";
  if (magnitudePx <= RECONCILE_MEDIUM_PX) return "ease";
  return "snap";
}

export function assertReconcileSnapBack(
  trace: ReconcileFrame[],
  magnitudePx: number,
): AssertionResult {
  const violations: string[] = [];
  const summary: Record<string, number | string> = {};
  const curve = reconcileCurveFor(magnitudePx);
  summary["curve"] = curve;
  summary["magnitude_px"] = magnitudePx;

  const correctionFrames = trace.filter((f) => f.attributableToCorrection);
  summary["correction_frames"] = correctionFrames.length;

  if (correctionFrames.length === 0) {
    return {
      ok: false,
      violations: ["no correction-attributable frames in trace"],
      summary,
    };
  }

  const maxFrameDelta = Math.max(...correctionFrames.map((f) => f.localDeltaPx));
  summary["max_correction_frame_delta_px"] = round2(maxFrameDelta);

  if (curve === "blend") {
    if (correctionFrames.length < RECONCILE_SMALL_MIN_FRAMES) {
      violations.push(
        `blend curve requires ≥${RECONCILE_SMALL_MIN_FRAMES} frames, got ${correctionFrames.length}`,
      );
    }
    if (maxFrameDelta > RECONCILE_SMALL_MAX_FRAME_DELTA_PX) {
      violations.push(
        `blend curve: max frame Δ ${maxFrameDelta.toFixed(2)}px > ${RECONCILE_SMALL_MAX_FRAME_DELTA_PX}px bar`,
      );
    }
  } else if (curve === "ease") {
    if (correctionFrames.length > RECONCILE_MEDIUM_MAX_FRAMES) {
      violations.push(
        `ease curve: ${correctionFrames.length} frames > ${RECONCILE_MEDIUM_MAX_FRAMES} frame clamp`,
      );
    }
    if (maxFrameDelta > magnitudePx) {
      violations.push(
        `ease curve: single-frame Δ ${maxFrameDelta.toFixed(2)}px > total magnitude ${magnitudePx}px (overshoot)`,
      );
    }
    // Cubic ease is unimodal — once the curve starts decelerating it
    // shouldn't re-accelerate. A dip-then-rise pattern signals a broken
    // easing function (or two corrections fighting).
    for (let i = 2; i < correctionFrames.length; i++) {
      const a = correctionFrames[i - 2]!.localDeltaPx;
      const b = correctionFrames[i - 1]!.localDeltaPx;
      const c = correctionFrames[i]!.localDeltaPx;
      if (b < a && c > b) {
        violations.push(
          `ease curve: non-monotone at frame ${i} (${a.toFixed(2)} → ${b.toFixed(2)} → ${c.toFixed(2)})`,
        );
        break;
      }
    }
  } else {
    // snap
    if (correctionFrames.length !== 1) {
      violations.push(
        `snap curve: expected exactly 1 correction frame, got ${correctionFrames.length}`,
      );
    }
  }

  return { ok: violations.length === 0, violations, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// §D — jitter buffer adaptivity
// ─────────────────────────────────────────────────────────────────────────────
//
// Fixed-depth buffers work at the RTT they were tuned for; real connections
// jitter. An adaptive buffer chasing rolling RTT_p90 keeps remote smoothness
// (§B) without inflating latency for steady connections.
//
// Expected depth = max(rolling RTT_p90 over last 2s, MIN_BUFFER_MS).
//
// §D catches the CAUSE that §B catches as an effect: a fixed-depth buffer
// collapsing under jitter manifests as a freeze + catch-up snap, which §B
// reads as a continuity violation AFTER it's happened. §D asserts the buffer
// formula directly + counts underruns over the trace.

export function expectedAdaptiveBufferMs(
  samples: JitterBufferSample[],
  tMs: number,
  windowMs: number = ADAPTIVE_BUFFER_WINDOW_MS,
): number {
  const window = samples.filter((s) => s.tMs <= tMs && s.tMs >= tMs - windowMs);
  if (window.length === 0) return MIN_BUFFER_MS;
  const p90 = percentile(
    window.map((s) => s.rttMs),
    0.9,
  );
  return Math.max(p90, MIN_BUFFER_MS);
}

export function assertJitterBufferAdaptive(
  samples: JitterBufferSample[],
  toleranceMs = 25,
): AssertionResult {
  const violations: string[] = [];
  const summary: Record<string, number | string> = {};

  if (samples.length === 0) {
    return { ok: false, violations: ["no samples provided"], summary };
  }

  const underrunsDelta =
    samples[samples.length - 1]!.underrunCount - samples[0]!.underrunCount;
  summary["underruns"] = underrunsDelta;
  if (underrunsDelta > 0) {
    violations.push(`${underrunsDelta} buffer underrun(s) during trace`);
  }

  let maxDrift = 0;
  for (const s of samples) {
    const expected = expectedAdaptiveBufferMs(samples, s.tMs);
    const drift = Math.abs(s.effectiveBufferMs - expected);
    if (drift > maxDrift) maxDrift = drift;
    if (drift > toleranceMs) {
      violations.push(
        `t=${s.tMs.toFixed(0)}ms: buffer ${s.effectiveBufferMs.toFixed(1)}ms drifts ${drift.toFixed(1)}ms from expected ${expected.toFixed(1)}ms (tol ${toleranceMs}ms)`,
      );
    }
    if (s.effectiveBufferMs < MIN_BUFFER_MS) {
      violations.push(
        `t=${s.tMs.toFixed(0)}ms: buffer ${s.effectiveBufferMs.toFixed(1)}ms < MIN_BUFFER_MS (${MIN_BUFFER_MS}ms)`,
      );
    }
  }
  summary["max_drift_ms"] = round2(maxDrift);

  return { ok: violations.length === 0, violations, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Linear-interp percentile (Type 7 / Excel-style). 0 ≤ q ≤ 1. */
export function percentile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  const frac = pos - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
