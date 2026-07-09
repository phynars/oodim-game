import { describe, expect, it } from "vitest";

import { INTERACTION_CONFIRM_FEEL, sampleInteractionConfirmFeel } from "./interactionConfirmFeel";

describe("sampleInteractionConfirmFeel", () => {
  it("starts neutral except for the coupled confirm click", () => {
    expect(sampleInteractionConfirmFeel(0)).toEqual({
      elapsedMs: 0,
      progress: 0,
      pressScale: 1,
      liftPx: 0,
      cameraYawDeg: 0,
      screenShakePx: INTERACTION_CONFIRM_FEEL.screenShakePxPeak,
      glowAlpha: 0,
      clickGain: INTERACTION_CONFIRM_FEEL.clickGainPeak,
    });
  });

  it("hits the tactile press-in peak at 54ms", () => {
    const sample = sampleInteractionConfirmFeel(INTERACTION_CONFIRM_FEEL.pressInMs);

    expect(sample.pressScale).toBeCloseTo(INTERACTION_CONFIRM_FEEL.pressScalePeak, 5);
    expect(sample.liftPx).toBeCloseTo(INTERACTION_CONFIRM_FEEL.liftPxPeak, 5);
    expect(sample.glowAlpha).toBeGreaterThan(0.6);
    expect(sample.clickGain).toBe(0);
  });

  it("decays the confirm shake and yaw by the 180ms settle point", () => {
    const sample = sampleInteractionConfirmFeel(INTERACTION_CONFIRM_FEEL.durationMs);

    expect(sample.progress).toBe(1);
    expect(sample.pressScale).toBe(1);
    expect(sample.liftPx).toBe(0);
    expect(sample.cameraYawDeg).toBeCloseTo(0, 5);
    expect(sample.screenShakePx).toBe(0);
    expect(sample.glowAlpha).toBe(0);
    expect(sample.clickGain).toBe(0);
  });

  it("clamps negative time to the opening sample", () => {
    expect(sampleInteractionConfirmFeel(-40)).toEqual(sampleInteractionConfirmFeel(0));
  });
});
