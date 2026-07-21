import { describe, expect, it } from "vitest";

import {
  INTERACTION_CONFIRM_FEEL,
  sampleInteractionConfirmFeel,
} from "./interactionConfirmFeel";

describe("interactionConfirmFeel", () => {
  it("presses in fast, then releases back to rest over the 180ms confirmation beat", () => {
    const start = sampleInteractionConfirmFeel(0);
    const pressed = sampleInteractionConfirmFeel(INTERACTION_CONFIRM_FEEL.pressInMs);
    const settled = sampleInteractionConfirmFeel(INTERACTION_CONFIRM_FEEL.durationMs);

    expect(start).toMatchObject({
      elapsedMs: 0,
      progress: 0,
      pressScale: 1,
      liftPx: 0,
      screenShakePx: INTERACTION_CONFIRM_FEEL.screenShakePxPeak,
      glowAlpha: 0,
      clickGain: INTERACTION_CONFIRM_FEEL.clickGainPeak,
    });
    expect(pressed.pressScale).toBeCloseTo(INTERACTION_CONFIRM_FEEL.pressScalePeak, 6);
    expect(pressed.liftPx).toBeCloseTo(INTERACTION_CONFIRM_FEEL.liftPxPeak, 6);
    expect(pressed.glowAlpha).toBeGreaterThan(0.6);
    expect(settled).toMatchObject({
      progress: 1,
      pressScale: 1,
      liftPx: 0,
      cameraYawDeg: 0,
      screenShakePx: 0,
      glowAlpha: 0,
      clickGain: 0,
    });
  });

  it("keeps the confirm click inside the first 24ms audio-visual coupling window", () => {
    expect(sampleInteractionConfirmFeel(24).clickGain).toBe(
      INTERACTION_CONFIRM_FEEL.clickGainPeak,
    );
    expect(sampleInteractionConfirmFeel(25).clickGain).toBe(0);
  });

  it("clamps negative and overlong samples so the harness gets stable pure-data values", () => {
    expect(sampleInteractionConfirmFeel(-40)).toMatchObject({
      elapsedMs: 0,
      progress: 0,
      pressScale: 1,
      liftPx: 0,
    });
    expect(sampleInteractionConfirmFeel(INTERACTION_CONFIRM_FEEL.durationMs + 500)).toMatchObject({
      progress: 1,
      pressScale: 1,
      liftPx: 0,
      cameraYawDeg: 0,
      screenShakePx: 0,
      glowAlpha: 0,
      clickGain: 0,
    });
  });
});
