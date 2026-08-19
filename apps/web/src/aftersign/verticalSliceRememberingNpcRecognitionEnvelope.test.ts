// Contract test for the returning-NPC recognition-beat envelope sampler.
//
// PR #1309 re-review (Soren): `sampleAftersignRememberingNpcRecognitionEnvelope`
// is the ONE numeric contract the served renderer will sample for both Io
// and Orra's remembering choreography (portrait push-in, recognition ring
// sin-fade, subtitle easeOutBack pop-in, reduced-motion zeroing, audio-cue
// arm gate). This file exercises the frame semantics named in the review
// so a regression in the timing choreography fails a test — not silently
// drifts under the renderer.
//
// Sibling to `verticalSliceState.recognitionCue.test.ts`, which locks the
// Io recognition-beat cue; this locks the remembering-NPC envelope on the
// same axis (frame at t=0, gates, peaks, reduced-motion branch).

import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL,
  sampleAftersignRememberingNpcRecognitionEnvelope,
} from "./verticalSliceState";

const FEEL = AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL;

describe("sampleAftersignRememberingNpcRecognitionEnvelope — frame semantics", () => {
  it("collapses to the opening frame at t=0 (zero motion, gates closed)", () => {
    const frame = sampleAftersignRememberingNpcRecognitionEnvelope(0);

    expect(frame.elapsedMs).toBe(0);
    expect(frame.lineHoldComplete).toBe(false);
    expect(frame.portraitPushInPx).toBe(0);
    // ringT=0 → sin(0)=0 → opacity 0 at the opening frame.
    expect(frame.recognitionRingOpacity).toBe(0);
    // scale at ringT=0 is 1 (no scale pop yet).
    expect(frame.recognitionRingScale).toBe(1);
    // Subtitle is at max pre-pop distance (delay hasn't started).
    expect(frame.subtitlePopDistancePx).toBeCloseTo(FEEL.subtitlePopDistancePx);
    expect(frame.subtitleOpacity).toBe(0);
    expect(frame.audioCueArmed).toBe(false);
  });

  it("collapses negative and non-finite elapsedMs to the opening frame", () => {
    const negative = sampleAftersignRememberingNpcRecognitionEnvelope(-500);
    const nan = sampleAftersignRememberingNpcRecognitionEnvelope(Number.NaN);
    const infinite = sampleAftersignRememberingNpcRecognitionEnvelope(
      Number.POSITIVE_INFINITY,
    );
    // Negative + NaN collapse to elapsed 0; +Infinity is finite=false in the
    // Number.isFinite sense (Number.isFinite(Infinity) === false), so it too
    // collapses to the opening frame — the sampler never emits NaN.
    for (const frame of [negative, nan, infinite]) {
      expect(frame.elapsedMs).toBe(0);
      expect(frame.portraitPushInPx).toBe(0);
      expect(frame.recognitionRingOpacity).toBe(0);
      expect(frame.subtitleOpacity).toBe(0);
      expect(frame.audioCueArmed).toBe(false);
      expect(frame.lineHoldComplete).toBe(false);
    }
  });

  it("gates lineHoldComplete and audioCueArmed at preLineHoldMs / audioCueDelayMs", () => {
    // Both gates are 120ms in the feel table; verify BOTH boundaries.
    expect(FEEL.preLineHoldMs).toBe(120);
    expect(FEEL.audioCueDelayMs).toBe(120);

    const before = sampleAftersignRememberingNpcRecognitionEnvelope(119);
    expect(before.lineHoldComplete).toBe(false);
    expect(before.audioCueArmed).toBe(false);

    const at = sampleAftersignRememberingNpcRecognitionEnvelope(120);
    expect(at.lineHoldComplete).toBe(true);
    expect(at.audioCueArmed).toBe(true);
  });

  it("portrait push-in reaches its full 14px offset at portraitPushInMs", () => {
    const atPeak = sampleAftersignRememberingNpcRecognitionEnvelope(
      FEEL.portraitPushInMs,
    );
    // easeOutExpoish(1) = 1 → full push-in distance lands exactly.
    expect(atPeak.portraitPushInPx).toBeCloseTo(FEEL.portraitPushInPx, 6);

    // And it clamps — sampling past the push-in duration does not overshoot.
    const beyond = sampleAftersignRememberingNpcRecognitionEnvelope(
      FEEL.portraitPushInMs * 4,
    );
    expect(beyond.portraitPushInPx).toBeCloseTo(FEEL.portraitPushInPx, 6);
  });

  it("recognition ring sin-fades — opacity peaks mid-window, returns to 0 at ring end", () => {
    // ringT = (elapsed - delay) / duration; sin(ringT · π) peaks at ringT=0.5.
    // delay=90, duration=420 → mid-window at elapsed = 90 + 420/2 = 300.
    const mid = sampleAftersignRememberingNpcRecognitionEnvelope(300);
    // sin(π/2) = 1 → opacity == the feel's max ring opacity.
    expect(mid.recognitionRingOpacity).toBeCloseTo(FEEL.recognitionRingOpacity, 6);

    // ringT=1 at elapsed = 90 + 420 = 510 → sin(π) = 0 → opacity back to 0,
    // scale sits at the feel's max scale pop (1.18).
    const end = sampleAftersignRememberingNpcRecognitionEnvelope(510);
    expect(end.recognitionRingOpacity).toBeCloseTo(0, 6);
    expect(end.recognitionRingScale).toBeCloseTo(FEEL.recognitionRingScale, 6);
  });

  it("subtitle easeOutBack overshoots past its target (negative pop distance mid-pop)", () => {
    // easeOutBack overshoots > 1 for t ∈ (~0.4, ~0.85), so the pop-distance
    // term (distance · (1 - ease)) goes NEGATIVE mid-pop — that's the
    // "pop past target then settle" feel Soren named. delay=180, duration=220
    // → subtitleT=0.5 at elapsed = 180 + 110 = 290.
    const mid = sampleAftersignRememberingNpcRecognitionEnvelope(290);
    expect(mid.subtitlePopDistancePx).toBeLessThan(0);
    // Subtitle opacity tracks subtitleT linearly; at t=0.5 it's ~0.5.
    expect(mid.subtitleOpacity).toBeCloseTo(0.5, 6);

    // At subtitlePopMs past the delay, subtitleT=1 → easeOutBack(1)=1 →
    // pop distance settles exactly to 0 and opacity to 1.
    const settled = sampleAftersignRememberingNpcRecognitionEnvelope(
      FEEL.subtitlePopDelayMs + FEEL.subtitlePopMs,
    );
    expect(settled.subtitlePopDistancePx).toBeCloseTo(0, 6);
    expect(settled.subtitleOpacity).toBeCloseTo(1, 6);
  });

  it("reduced motion zeroes spatial motion + scale pop but keeps opacity/gates intact", () => {
    // Sample at the ring-opacity peak so the non-motion channels have
    // non-trivial values to compare against.
    const nowMs = 300;
    const motion = sampleAftersignRememberingNpcRecognitionEnvelope(nowMs, false);
    const reduced = sampleAftersignRememberingNpcRecognitionEnvelope(nowMs, true);

    // Spatial channels: zeroed under reduced motion.
    expect(reduced.portraitPushInPx).toBe(0);
    expect(reduced.subtitlePopDistancePx).toBe(0);
    expect(reduced.recognitionRingScale).toBe(1);

    // Opacity + gate channels: identical between motion and reduced-motion
    // frames — reduced motion removes MOTION, not the recognition read.
    expect(reduced.recognitionRingOpacity).toBe(motion.recognitionRingOpacity);
    expect(reduced.subtitleOpacity).toBe(motion.subtitleOpacity);
    expect(reduced.audioCueArmed).toBe(motion.audioCueArmed);
    expect(reduced.lineHoldComplete).toBe(motion.lineHoldComplete);
    expect(reduced.elapsedMs).toBe(motion.elapsedMs);
  });
});
