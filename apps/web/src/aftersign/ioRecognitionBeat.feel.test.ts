import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_RECOGNITION_BEAT_FEEL,
  sampleAftersignIoRecognitionBeat,
} from "./ioRecognitionBeat.feel";

describe("AFTERSIGN Io recognition beat feel", () => {
  it("starts with a held breath before Io recognizes the prior packet outcome", () => {
    const frame = sampleAftersignIoRecognitionBeat(90);

    expect(frame.phase).toBe("preRecognitionHold");
    expect(frame.cameraPushDegrees).toBe(0);
    expect(frame.cameraLiftPx).toBe(0);
    expect(frame.subtitleAlpha).toBe(0);
    expect(frame.bellGainDb).toBeLessThanOrEqual(AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.bellStingPeakDb);
  });

  it("pushes the camera and wakes the sign glow during the recognition read", () => {
    const frame = sampleAftersignIoRecognitionBeat(520);

    expect(frame.phase).toBe("cameraPush");
    expect(frame.cameraPushDegrees).toBeGreaterThanOrEqual(2.1);
    expect(frame.cameraPushDegrees).toBeLessThanOrEqual(2.4);
    expect(frame.cameraLiftPx).toBeGreaterThanOrEqual(8.8);
    expect(frame.signGlowIntensity).toBeGreaterThanOrEqual(1);
    expect(frame.vignetteAlpha).toBeGreaterThan(0.12);
  });

  it("lands the remembered line after the camera move without stealing control for too long", () => {
    const frame = sampleAftersignIoRecognitionBeat(820);

    expect(frame.phase).toBe("lineDelivery");
    expect(frame.subtitleAlpha).toBe(1);
    expect(frame.cameraPushDegrees).toBeCloseTo(AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.cameraPushDegrees, 2);
    expect(AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.totalMs).toBeLessThanOrEqual(1700);
  });

  it("decays the afterglow instead of popping the recognition light off", () => {
    const start = sampleAftersignIoRecognitionBeat(1420);
    const mid = sampleAftersignIoRecognitionBeat(1550);
    const end = sampleAftersignIoRecognitionBeat(1680);

    expect(start.phase).toBe("afterglow");
    expect(mid.signGlowIntensity).toBeGreaterThan(end.signGlowIntensity);
    expect(end.signGlowIntensity).toBe(0);
    expect(end.subtitleAlpha).toBe(0);
  });

  it("keeps distinct warm/cut tints for sealed versus opened memory", () => {
    expect(AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.outcomeTint.sealed).toBe("#f6c86a");
    expect(AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.outcomeTint.opened).toBe("#b44b4b");
  });
});
