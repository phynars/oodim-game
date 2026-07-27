import {
  AFTERSIGN_IO_RECOGNITION_BEAT_FEEL,
  sampleAftersignIoRecognitionBeatFeel,
} from "./ioRecognitionBeatFeel";

describe("AFTERSIGN Io recognition beat feel", () => {
  it("pushes camera before glow peak and sound bloom", () => {
    const start = sampleAftersignIoRecognitionBeatFeel(0);
    const cameraSettle = sampleAftersignIoRecognitionBeatFeel(420);
    const glowPeak = sampleAftersignIoRecognitionBeatFeel(270);
    const stingBloom = sampleAftersignIoRecognitionBeatFeel(460);

    expect(start.cameraPushDegrees).toBe(0);
    expect(start.signGlow).toBe(0);
    expect(cameraSettle.cameraPushDegrees).toBeCloseTo(
      AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.cameraPushDegrees,
      5,
    );
    expect(glowPeak.signGlow).toBeCloseTo(1, 5);
    expect(stingBloom.stingGain).toBeGreaterThan(0.5);
  });

  it("keeps the recognition beat legible but still under reduced motion", () => {
    const reduced = sampleAftersignIoRecognitionBeatFeel(420, true);
    const full = sampleAftersignIoRecognitionBeatFeel(420, false);

    expect(reduced.cameraPushDegrees).toBe(0);
    expect(reduced.screenSettlePx).toBe(0);
    expect(reduced.signGlow).toBeGreaterThan(0);
    expect(full.cameraPushDegrees).toBeGreaterThan(reduced.cameraPushDegrees);
  });

  it("locks concrete ms/degree/px contracts for the first returning Io beat", () => {
    expect(AFTERSIGN_IO_RECOGNITION_BEAT_FEEL).toMatchObject({
      cameraPushMs: 420,
      cameraPushDegrees: 3.2,
      cameraEase: "easeOutCubic",
      signGlowDelayMs: 90,
      signGlowPeakMs: 180,
      signGlowFadeMs: 520,
      recognitionStingDelayMs: 120,
      recognitionStingMs: 680,
      lanternPulsePx: 6,
      screenSettlePx: 1.5,
      reducedMotionCameraPushDegrees: 0,
      reducedMotionScreenSettlePx: 0,
    });
  });
});
