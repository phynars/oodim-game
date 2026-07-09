import { describe, expect, it } from "vitest";
import { getInteractionConfirmCue, sampleInteractionConfirmCue } from "./interactionConfirm";

describe("interaction confirm cues", () => {
  it("gives a decisive confirmation a 180ms bounce with shake and coupled AV pulse", () => {
    const cue = getInteractionConfirmCue("decisive");

    expect(cue.durationMs).toBe(180);
    expect(cue.pressScale).toBe(0.97);
    expect(cue.releaseScale).toBe(1.04);
    expect(cue.liftPx).toBe(4);
    expect(cue.shakePx).toBe(1.5);
    expect(cue.bloomBoost).toBe(0.12);
    expect(cue.audioGain).toBe(0.7);
    expect(cue.hapticMs).toBe(16);
    expect(cue.easing).toBe("cubic-bezier(.34,1.56,.64,1)");
  });

  it("samples confirmation motion as press-in then ease-out release", () => {
    const start = sampleInteractionConfirmCue("decisive", 0);
    const press = sampleInteractionConfirmCue("decisive", 18);
    const finish = sampleInteractionConfirmCue("decisive", 180);

    expect(start.scale).toBe(1);
    expect(start.audioGain).toBe(0.7);
    expect(start.hapticMs).toBe(16);
    expect(press.scale).toBeLessThan(1);
    expect(finish.scale).toBe(1.04);
    expect(finish.liftPx).toBe(4);
    expect(finish.shakePx).toBe(0);
    expect(finish.bloomBoost).toBe(0);
    expect(finish.audioGain).toBe(0);
    expect(finish.hapticMs).toBe(0);
  });

  it("keeps rejected confirmations short, sharp, and non-celebratory", () => {
    const cue = getInteractionConfirmCue("rejected");
    const mid = sampleInteractionConfirmCue("rejected", 48);

    expect(cue.durationMs).toBe(96);
    expect(cue.liftPx).toBe(0);
    expect(cue.bloomBoost).toBe(0);
    expect(mid.shakePx).toBe(1.25);
    expect(mid.scale).toBeLessThanOrEqual(1);
  });
});
