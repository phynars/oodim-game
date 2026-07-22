import { describe, expect, it } from "vitest";

import { recognitionFeedbackContract } from "./recognitionFeedback";
import { sampleIoRecognitionFeelLayer } from "./ioRecognitionFeelLayer";

const cue = {
  packetOutcome: "sealed" as const,
  startedAtMs: 1_000,
};

describe("Io recognition feel layer", () => {
  it("samples the camera micro-lean from the recognition envelope", () => {
    const frame = sampleIoRecognitionFeelLayer(cue, 1_520);

    expect(frame.camera.forwardMeters).toBeCloseTo(
      recognitionFeedbackContract.cameraDeltaMeters,
      5,
    );
    expect(frame.camera.yawDegrees).toBeCloseTo(
      recognitionFeedbackContract.cameraYawDegrees,
      5,
    );
    expect(frame.camera.targetOffsetMeters).toBe(
      recognitionFeedbackContract.sealedTargetOffsetMeters,
    );
    expect(frame.inputLocked).toBe(true);
  });

  it("emits the recognition sting only during the audio window", () => {
    expect(sampleIoRecognitionFeelLayer(cue, 1_119).audioSting).toBeNull();

    const stingFrame = sampleIoRecognitionFeelLayer(
      cue,
      1_000 + recognitionFeedbackContract.stingStartMs,
    );

    expect(stingFrame.audioSting).toEqual({
      cueId: "recognition-sting",
      gainDb: recognitionFeedbackContract.stingGainDb,
      elapsedMs: 0,
    });

    expect(sampleIoRecognitionFeelLayer(cue, 1_301).audioSting).toBeNull();
  });

  it("keeps reduced-motion samples free of camera movement", () => {
    const frame = sampleIoRecognitionFeelLayer(cue, 1_080, {
      reducedMotion: true,
    });

    expect(frame.camera.forwardMeters).toBe(0);
    expect(frame.camera.yawDegrees).toBe(0);
    expect(frame.camera.targetOffsetMeters).toBe(0);
    expect(frame.sample.totalMs).toBe(recognitionFeedbackContract.reducedMotionTotalMs);
  });

  it("unlocks input when the recognition beat has completed", () => {
    const frame = sampleIoRecognitionFeelLayer(
      cue,
      cue.startedAtMs + recognitionFeedbackContract.inputLockMs,
    );

    expect(frame.inputLocked).toBe(false);
  });
});
