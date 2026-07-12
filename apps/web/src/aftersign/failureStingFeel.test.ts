import { describe, expect, it } from "vitest";

import { FAILURE_STING_FEEL, sampleFailureStingFeel } from "./failureStingFeel";

describe("failure sting feel", () => {
  it("starts with no recoil or post effect before input", () => {
    const sample = sampleFailureStingFeel(0);

    expect(sample.elapsedMs).toBe(0);
    expect(sample.progress).toBe(0);
    expect(sample.recoilPx).toBe(0);
    expect(sample.shakePx).toBeCloseTo(0, 5);
    expect(sample.vignetteAlpha).toBe(0);
    expect(sample.desaturate).toBe(0);
    expect(sample.thudGain).toBe(FAILURE_STING_FEEL.thudGainPeak);
  });

  it("hits its recoil peak at 64ms while the thud has already ended", () => {
    const sample = sampleFailureStingFeel(FAILURE_STING_FEEL.recoilPeakMs);

    expect(sample.elapsedMs).toBe(64);
    expect(sample.recoilPx).toBeCloseTo(FAILURE_STING_FEEL.recoilPxPeak, 5);
    expect(sample.vignetteAlpha).toBeGreaterThan(0.32);
    expect(sample.desaturate).toBeGreaterThan(0.22);
    expect(sample.thudGain).toBe(0);
  });

  it("fully resolves by 240ms without residual shake or color grading", () => {
    const sample = sampleFailureStingFeel(FAILURE_STING_FEEL.durationMs);

    expect(sample.progress).toBe(1);
    expect(sample.recoilPx).toBe(0);
    expect(sample.shakePx).toBeCloseTo(0, 5);
    expect(sample.vignetteAlpha).toBe(0);
    expect(sample.desaturate).toBe(0);
    expect(sample.thudGain).toBe(0);
  });

  it("clamps negative elapsed time so the harness cannot sample pre-input drift", () => {
    expect(sampleFailureStingFeel(-16)).toEqual(sampleFailureStingFeel(0));
  });
});
