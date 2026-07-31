import { describe, expect, it } from "vitest";

import { INTERACTION_CONFIRM_FEEL, sampleInteractionConfirm } from "./interactionConfirm";

describe("sampleInteractionConfirm", () => {
  it("starts with a tactile click, glow, and 1.5px shake", () => {
    const sample = sampleInteractionConfirm({ elapsedMs: 0 });

    expect(sample.phase).toBe("press");
    expect(sample.scale).toBeCloseTo(1, 5);
    expect(sample.emissiveBoost).toBeCloseTo(INTERACTION_CONFIRM_FEEL.emissiveBoost, 5);
    expect(sample.shakePx).toBeCloseTo(1.5, 5);
    expect(sample.clickGain).toBeCloseTo(0.18, 5);
  });

  it("compresses to 0.94 scale by 80ms, then overshoots during the 160ms settle", () => {
    const pressed = sampleInteractionConfirm({ elapsedMs: 79 });
    const overshoot = sampleInteractionConfirm({ elapsedMs: 160 });
    const settled = sampleInteractionConfirm({ elapsedMs: 240 });

    expect(pressed.phase).toBe("press");
    expect(pressed.scale).toBeLessThan(0.945);
    expect(overshoot.phase).toBe("settle");
    expect(overshoot.scale).toBeGreaterThan(1.02);
    expect(settled.phase).toBe("idle");
    expect(settled.scale).toBe(1);
    expect(settled.emissiveBoost).toBe(0);
  });

  it("keeps reduced-motion feedback visual/audio-only without scale or shake", () => {
    const initial = sampleInteractionConfirm({ elapsedMs: 0, reducedMotion: true });
    const done = sampleInteractionConfirm({ elapsedMs: 80, reducedMotion: true });

    expect(initial.scale).toBe(1);
    expect(initial.shakePx).toBe(0);
    expect(initial.emissiveBoost).toBeCloseTo(0.32, 5);
    expect(initial.clickGain).toBeCloseTo(0.18, 5);
    expect(done.phase).toBe("idle");
    expect(done.emissiveBoost).toBe(0);
  });
});
