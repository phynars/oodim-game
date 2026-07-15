import { describe, expect, it } from "vitest";
import {
  IO_RECOGNITION_BEAT_FEEDBACK,
  ioRecognitionBeatEnvelopeAt,
} from "./recognition-beat-feedback.js";

describe("Io recognition beat feedback", () => {
  it("codifies the authored peak at 700ms with a 520ms fall to 1220ms", () => {
    // Guard against the peak-vs-denominator misread: original inline curve
    // used elapsed<700 as the middle-phase threshold and (duration-peak)=520
    // as the fall denominator. Peak MUST be 700, not 520.
    expect(IO_RECOGNITION_BEAT_FEEDBACK.peakMs).toBe(700);
    expect(IO_RECOGNITION_BEAT_FEEDBACK.durationMs).toBe(1220);
    expect(
      IO_RECOGNITION_BEAT_FEEDBACK.durationMs - IO_RECOGNITION_BEAT_FEEDBACK.peakMs,
    ).toBe(520);
  });

  it("peaks the recognition dolly, yaw, and sign glow on the authored beat", () => {
    const start = ioRecognitionBeatEnvelopeAt(0);
    const peak = ioRecognitionBeatEnvelopeAt(IO_RECOGNITION_BEAT_FEEDBACK.peakMs);
    const end = ioRecognitionBeatEnvelopeAt(IO_RECOGNITION_BEAT_FEEDBACK.durationMs);

    expect(start).toMatchObject({
      normalized: 0,
      cameraDeltaMeters: 0,
      cameraYawDegrees: 0,
      signGlowBoost: 0,
    });
    expect(peak).toMatchObject({
      normalized: 1,
      cameraDeltaMeters: 0.32,
      cameraYawDegrees: 4,
      signGlowBoost: 1.15,
    });
    expect(end.normalized).toBe(0);
    expect(end.signGlowBoost).toBe(0);
  });

  it("still rises through the middle phase before the peak (520ms is not yet full)", () => {
    // 520ms was the OLD denominator, not the peak — the envelope should
    // still be climbing here, not already falling.
    const mid = ioRecognitionBeatEnvelopeAt(520);
    expect(mid.normalized).toBeGreaterThan(0.25);
    expect(mid.normalized).toBeLessThan(1);
  });
});
