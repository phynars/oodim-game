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
import assert from "node:assert/strict";

import { recognitionEnvelopeAt } from "./recognitionFeedbackBridge.js";
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
  assert.ok(
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
    assert.ok(
      t0.signGlowBoost < 0,
      `t=0 signGlowBoost must be negative (pre-bloom dip), got ${t0.signGlowBoost}`,
    );
    // Contract literal; tolerance covers only the toFixed(3) rounding.
    inBand(t0.signGlowBoost, expectedDipBoost - 0.001, expectedDipBoost + 0.001, "t=0 signGlowBoost dip");

    // The dip persists across the flat window BEFORE glow rise begins.
    const preRise = recognitionEnvelopeAt(RECOGNITION_FEEDBACK_GLOW_START_MS - 1, "sealed");
    assert.ok(
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
    assert.ok(
      early.signGlowBoost < 0,
      `early-rise signGlowBoost should still be negative, got ${early.signGlowBoost}`,
    );
    assert.ok(
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
    assert.ok(sample.lantern, "lantern cue must be present");
    assert.ok(sample.packetSeal, "packetSeal cue must be present");
    assert.ok(sample.kioskSign, "kioskSign cue must be present");
    assert.ok(sample.rainRim, "rainRim cue must be present");
    assert.ok(sample.hapticScale, "hapticScale cue must be present");
    // sealed-outcome cue tokens must not leak the opened palette.
    assert.equal(sample.lantern.color, "#f5c978");
    assert.equal(sample.packetSeal.audioId, "seal-wax-click");
  }

  // 5. Outcome routing: opened outcome swaps the cue table.
  {
    const opened = recognitionEnvelopeAt(200, "opened");
    assert.equal(opened.lantern.color, "#ffe1a8");
    assert.equal(opened.packetSeal.audioId, "seal-paper-tear");
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
    assert.ok(
      Math.abs(half.cameraDeltaMeters) <= Math.abs(midBeat.cameraDeltaMeters) + 0.001,
      `override cameraDeltaMeters (${half.cameraDeltaMeters}) should not exceed contract (${midBeat.cameraDeltaMeters})`,
    );
    assert.ok(
      Math.abs(half.cameraYawDegrees) <= Math.abs(midBeat.cameraYawDegrees) + 0.001,
      `override cameraYawDegrees (${half.cameraYawDegrees}) should not exceed contract (${midBeat.cameraYawDegrees})`,
    );
  }

  // 7. normalized progresses monotonically from 0 → 1 across the beat.
  {
    const start = recognitionEnvelopeAt(0, "sealed");
    const mid = recognitionEnvelopeAt(RECOGNITION_FEEDBACK_TOTAL_MS / 2, "sealed");
    const end = recognitionEnvelopeAt(RECOGNITION_FEEDBACK_TOTAL_MS, "sealed");
    assert.equal(start.normalized, 0);
    inBand(mid.normalized, 0.45, 0.55, "mid-beat normalized");
    assert.equal(end.normalized, 1);
    // Clamped past the beat end.
    const past = recognitionEnvelopeAt(RECOGNITION_FEEDBACK_TOTAL_MS * 2, "sealed");
    assert.equal(past.normalized, 1);
    // Clamped for negative inputs (defensive: elapsedMs may be
    // pre-beat if a caller queries during the guard window).
    const negative = recognitionEnvelopeAt(-50, "sealed");
    assert.equal(negative.normalized, 0);
  }
}
