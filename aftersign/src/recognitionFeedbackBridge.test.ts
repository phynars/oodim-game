// Unit checks for the recognitionFeedbackBridge hot-path shim.
//
// The bridge sits between recognitionFeedback.ts (typed contract) and
// main.js's recognition beat consumers (three.js signLight, DOM cue
// applyRecognitionDomFeedback). main.js:1727 sums the bridge's
// signGlowBoost into signLight.intensity EVERY FRAME during the beat —
// a wrong sign here silently flattens the pre-bloom dim.
//
// This bundle is exported (not top-level invoked) so pure-runner.ts
// can drive it under `node --experimental-strip-types`. Adding the
// runner entry is a one-line edit; adding the file to the
// playwright.pure.config.ts testMatch is NOT needed — this lives in
// aftersign/src/, not aftersign/e2e/.
// Local assert helpers — aftersign/tsconfig.json ships `types: ["vite/client"]`
// only (no @types/node), so `node:assert/strict` can't resolve under the
// strict `tsc --noEmit` gate. Runtime is fine under
// `node --experimental-strip-types`, but red is red. Matches the pattern
// in packetIntentContract.test.ts / recognitionBeat.test.ts /
// ioFirstSessionPacing.test.ts — standalone `function` declarations, NOT
// an object-method literal: TypeScript disallows `asserts` return types
// on methods of object literals, so `const assert = { ok(...): asserts
// condition { ... } }` is a strict-mode typecheck error (this exact
// shape flunked typecheck:aftersign on PR #1008's earlier heads).
class AssertionError extends Error {}

function assertOk(condition: unknown, message?: string): asserts condition {
  if (!condition) throw new AssertionError(message ?? "assertOk failed");
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      message ??
        `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

import { recognitionEnvelopeAt } from "./recognitionFeedbackBridge.ts";
import {
  RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS,
  RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES,
  RECOGNITION_FEEDBACK_GLOW_FROM,
  RECOGNITION_FEEDBACK_GLOW_TO,
  RECOGNITION_FEEDBACK_GLOW_START_MS,
  RECOGNITION_FEEDBACK_GLOW_DURATION_MS,
  RECOGNITION_FEEDBACK_TOTAL_MS,
} from "./recognitionFeedback.ts";

function inBand(value: number, min: number, max: number, label: string): void {
  assertOk(
    value >= min && value <= max,
    `${label}: ${value} expected in ${min}..${max}`,
  );
}

export function runRecognitionFeedbackBridgeChecks(): void {
  // 1. signGlowBoost preserves the pre-bloom DIP.
  //
  // The contract's signEmissiveScale rises 0.8 → 1.35 via easeOutCubic
  // between glowStartMs (80ms) and glowStartMs+glowDurationMs (220ms).
  // Before glowStartMs, signEmissiveScale sits at GLOW_FROM (0.8), so
  // signGlowBoost is -0.2 — the authored dim that lets the sign light
  // FALL below its 7.4 baseline before it blooms. Reviewer on PR #1008
  // caught the earlier clamp01 flooring this to 0.
  {
    const t0 = recognitionEnvelopeAt(0, "sealed");
    const expectedDipBoost = RECOGNITION_FEEDBACK_GLOW_FROM - 1; // 0.8 - 1 = -0.2
    assertOk(
      t0.signGlowBoost < 0,
      `t=0 signGlowBoost must be negative (pre-bloom dip), got ${t0.signGlowBoost}`,
    );
    // Contract literal; tolerance covers only the toFixed(3) rounding.
    inBand(t0.signGlowBoost, expectedDipBoost - 0.001, expectedDipBoost + 0.001, "t=0 signGlowBoost dip");

    // The dip persists across the flat window BEFORE glow rise begins.
    const preRise = recognitionEnvelopeAt(RECOGNITION_FEEDBACK_GLOW_START_MS - 1, "sealed");
    assertOk(
      preRise.signGlowBoost < 0,
      `pre-rise signGlowBoost must stay negative, got ${preRise.signGlowBoost}`,
    );
  }

  // 2. signGlowBoost peaks at +0.35 after full glow rise.
  //
  // At elapsedMs = glowStartMs + glowDurationMs (220ms), easeOutCubic(1)
  // returns 1, so signEmissiveScale = GLOW_TO (1.35) and
  // signGlowBoost = 0.35 — the same peak the old
  // ioRecognitionBeatEnvelopeAt reported (recognition-beat-feedback.js
  // returns Number((1.35 - 1).toFixed(3)) = 0.35).
  {
    const peak = recognitionEnvelopeAt(
      RECOGNITION_FEEDBACK_GLOW_START_MS + RECOGNITION_FEEDBACK_GLOW_DURATION_MS,
      "sealed",
    );
    const expectedPeakBoost = RECOGNITION_FEEDBACK_GLOW_TO - 1; // 1.35 - 1 = 0.35
    inBand(peak.signGlowBoost, expectedPeakBoost - 0.001, expectedPeakBoost + 0.001, "peak signGlowBoost");
  }

  // 3. signGlowBoost crosses zero mid-rise (temporal shape preserved).
  //
  // signEmissiveScale = 1 when GLOW_FROM + (GLOW_TO - GLOW_FROM) *
  // easeOutCubic(t) = 1  →  easeOutCubic(t) = (1 - 0.8) / (1.35 - 0.8)
  // ≈ 0.3636  →  t ≈ 0.135 of the 140ms rise, i.e. ~19ms after
  // glowStartMs. Sample either side to prove the boost changes sign
  // — this is the "temporal feel" the reviewer said the clamp
  // flattened.
  {
    const early = recognitionEnvelopeAt(RECOGNITION_FEEDBACK_GLOW_START_MS + 5, "sealed");
    const late = recognitionEnvelopeAt(RECOGNITION_FEEDBACK_GLOW_START_MS + 60, "sealed");
    assertOk(
      early.signGlowBoost < 0,
      `early-rise signGlowBoost should still be negative, got ${early.signGlowBoost}`,
    );
    assertOk(
      late.signGlowBoost > 0,
      `late-rise signGlowBoost should be positive, got ${late.signGlowBoost}`,
    );
  }

  // 4. DOM-feedback envelope contract: applyRecognitionDomFeedback reads
  //    envelope.normalized, .lantern, .packetSeal, .kioskSign, .rainRim,
  //    .hapticScale. Blocking review on #1008 previously caught these
  //    going undefined → the DOM half of the recognition beat zeroed out.
  {
    const sample = recognitionEnvelopeAt(200, "sealed");
    inBand(sample.normalized, 0, 1, "normalized");
    assertOk(sample.lantern, "lantern cue must be present");
    assertOk(sample.packetSeal, "packetSeal cue must be present");
    assertOk(sample.kioskSign, "kioskSign cue must be present");
    assertOk(sample.rainRim, "rainRim cue must be present");
    assertOk(sample.hapticScale, "hapticScale cue must be present");
    // sealed-outcome cue tokens must not leak the opened palette.
    assertEqual(sample.lantern.color, "#f5c978");
    assertEqual(sample.packetSeal.audioId, "seal-wax-click");
  }

  // 5. Outcome routing: opened outcome swaps the cue table.
  {
    const opened = recognitionEnvelopeAt(200, "opened");
    assertEqual(opened.lantern.color, "#ffe1a8");
    assertEqual(opened.packetSeal.audioId, "seal-paper-tear");
  }

  // 6. Camera fields default to the contract peaks; the ratio path
  //    scales when the harness overrides via state.interaction
  //    .recognitionFeedback (setRecognitionCameraEnvelope). Sample at
  //    the phase-1 peak (~180ms in the "catch" → "remember" transition).
  {
    const midBeat = recognitionEnvelopeAt(520, "sealed");
    inBand(
      Math.abs(midBeat.cameraDeltaMeters),
      0,
      RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS + 0.001,
      "cameraDeltaMeters magnitude",
    );
    inBand(
      Math.abs(midBeat.cameraYawDegrees),
      0,
      RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES + 0.001,
      "cameraYawDegrees magnitude",
    );

    // Harness override: halving the peak amplitudes halves the reported values.
    const half = recognitionEnvelopeAt(520, "sealed", {
      cameraDeltaMeters: RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS / 2,
      cameraYawDegrees: RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES / 2,
    });
    assertOk(
      Math.abs(half.cameraDeltaMeters) <= Math.abs(midBeat.cameraDeltaMeters) + 0.001,
      `override cameraDeltaMeters (${half.cameraDeltaMeters}) should not exceed contract (${midBeat.cameraDeltaMeters})`,
    );
    assertOk(
      Math.abs(half.cameraYawDegrees) <= Math.abs(midBeat.cameraYawDegrees) + 0.001,
      `override cameraYawDegrees (${half.cameraYawDegrees}) should not exceed contract (${midBeat.cameraYawDegrees})`,
    );
  }

  // 7. normalized progresses monotonically from 0 → 1 across the beat.
  {
    const start = recognitionEnvelopeAt(0, "sealed");
    const mid = recognitionEnvelopeAt(RECOGNITION_FEEDBACK_TOTAL_MS / 2, "sealed");
    const end = recognitionEnvelopeAt(RECOGNITION_FEEDBACK_TOTAL_MS, "sealed");
    assertEqual(start.normalized, 0);
    inBand(mid.normalized, 0.45, 0.55, "mid-beat normalized");
    assertEqual(end.normalized, 1);
    // Clamped past the beat end.
    const past = recognitionEnvelopeAt(RECOGNITION_FEEDBACK_TOTAL_MS * 2, "sealed");
    assertEqual(past.normalized, 1);
    // Clamped for negative inputs (defensive: elapsedMs may be
    // pre-beat if a caller queries during the guard window).
    const negative = recognitionEnvelopeAt(-50, "sealed");
    assertEqual(negative.normalized, 0);
  }
}
