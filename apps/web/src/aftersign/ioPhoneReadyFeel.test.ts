import { describe, expect, it } from "vitest";

import { IO_PHONE_READY_FEEL, sampleIoPhoneReadyFeel } from "./ioPhoneReadyFeel";

describe("Io phone-ready feel", () => {
  it("starts hidden below the readable line position", () => {
    const sample = sampleIoPhoneReadyFeel(0);

    expect(sample.elapsedMs).toBe(0);
    expect(sample.progress).toBe(0);
    expect(sample.settleProgress).toBe(0);
    expect(sample.lineTranslateYPx).toBe(IO_PHONE_READY_FEEL.lineRisePx);
    expect(sample.lineOpacity).toBe(0);
    expect(sample.audioVisualDriftMs).toBeLessThanOrEqual(
      IO_PHONE_READY_FEEL.maxAudioVisualDriftMs,
    );
  });

  it("keeps the paired audio and visual cue inside the 50ms coupling window", () => {
    const sample = sampleIoPhoneReadyFeel(IO_PHONE_READY_FEEL.audioCueMs);

    expect(sample.audioGain).toBeGreaterThan(0.7);
    expect(sample.visualCueMs).toBe(96);
    expect(sample.audioCueMs).toBe(112);
    expect(sample.audioVisualDriftMs).toBe(16);
    expect(sample.audioVisualDriftMs).toBeLessThanOrEqual(50);
  });

  it("settles into fully readable phone layout by 360ms", () => {
    const sample = sampleIoPhoneReadyFeel(IO_PHONE_READY_FEEL.settleMs);

    expect(sample.progress).toBe(1);
    expect(sample.settleProgress).toBe(1);
    expect(sample.lineTranslateYPx).toBe(0);
    expect(sample.lineOpacity).toBe(1);
    expect(sample.glowOpacity).toBe(0);
  });

  it("clamps negative elapsed time so tests cannot observe pre-trigger drift", () => {
    expect(sampleIoPhoneReadyFeel(-16)).toEqual(sampleIoPhoneReadyFeel(0));
  });
});
