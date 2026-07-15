import { describe, expect, it } from "vitest";
import {
  IO_RECOGNITION_BEAT_FEEDBACK,
  ioRecognitionBeatEnvelopeAt,
} from "./recognition-beat-feedback.js";

describe("Io recognition beat feedback", () => {
  it("peaks the recognition dolly, yaw, glow, and bell light on the authored beat", () => {
    const start = ioRecognitionBeatEnvelopeAt(0);
    const peak = ioRecognitionBeatEnvelopeAt(IO_RECOGNITION_BEAT_FEEDBACK.bellLightPeakMs);
    const end = ioRecognitionBeatEnvelopeAt(IO_RECOGNITION_BEAT_FEEDBACK.durationMs);

    expect(start).toMatchObject({
      normalized: 0,
      cameraDeltaMeters: 0,
      cameraYawDegrees: 0,
      signGlowBoost: 0,
      bellLightAlpha: 0,
    });
    expect(peak).toMatchObject({
      normalized: 1,
      cameraDeltaMeters: 0.32,
      cameraYawDegrees: 4,
      signGlowBoost: 1.15,
      bellLightAlpha: 0.42,
    });
    expect(end.normalized).toBe(0);
    expect(end.signGlowBoost).toBe(0);
    expect(end.bellLightAlpha).toBe(0);
  });
});
