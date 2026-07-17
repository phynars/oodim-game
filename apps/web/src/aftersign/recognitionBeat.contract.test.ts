import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_RECOGNITION_BEAT_DURATION_MS,
  createAftersignRecognitionBeat,
} from "./recognitionBeat";

describe("AFTERSIGN Io recognition beat", () => {
  it("keeps the returning-player recognition sting under one second", () => {
    const beat = createAftersignRecognitionBeat("sealed");

    expect(beat.totalDurationMs).toBe(920);
    expect(beat.totalDurationMs).toBeLessThan(1000);
  });

  it("pushes the camera before the bell so Io's recognition reads before the sting", () => {
    const beat = createAftersignRecognitionBeat("sealed");
    const firstCameraCue = beat.cues.find((cue) => cue.cameraPushDegrees !== undefined);
    const firstBellCue = beat.cues.find((cue) => cue.bellGain !== undefined);

    expect(firstCameraCue).toMatchObject({
      atMs: 0,
      durationMs: 180,
      easing: "easeOutCubic",
      cameraPushDegrees: 2.4,
      cameraLiftPx: 6,
    });
    expect(firstBellCue).toMatchObject({
      atMs: 180,
      durationMs: 90,
      bellGain: 0.38,
    });
  });

  it("makes the sealed packet recognition warmer than the opened packet recognition", () => {
    const sealed = createAftersignRecognitionBeat("sealed");
    const opened = createAftersignRecognitionBeat("opened");

    const sealedOutcomeGlow = sealed.cues.find(
      (cue) => cue.atMs === 260 && cue.signGlowIntensity !== undefined,
    );
    const openedOutcomeGlow = opened.cues.find(
      (cue) => cue.atMs === 280 && cue.signGlowIntensity !== undefined,
    );

    expect(sealedOutcomeGlow).toMatchObject({
      durationMs: 300,
      easing: "easeInOutSine",
      signGlowIntensity: 0.9,
    });
    expect(openedOutcomeGlow).toMatchObject({
      durationMs: 260,
      easing: "easeInOutSine",
      signGlowIntensity: 0.46,
    });
    expect(sealedOutcomeGlow!.signGlowIntensity!).toBeGreaterThan(
      openedOutcomeGlow!.signGlowIntensity!,
    );
  });

  it("keeps all recognition cues inside the authored beat window", () => {
    const beat = createAftersignRecognitionBeat("opened");

    for (const cue of beat.cues) {
      expect(cue.atMs).toBeGreaterThanOrEqual(0);
      expect(cue.atMs + cue.durationMs).toBeLessThanOrEqual(
        AFTERSIGN_RECOGNITION_BEAT_DURATION_MS,
      );
    }
  });
});
