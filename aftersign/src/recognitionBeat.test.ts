import { describe, expect, it } from "vitest";

import { ioRecognitionBeat, recognitionBeatProgress } from "./recognitionBeat";

describe("Io recognition beat", () => {
  it("uses the sealed packet memory line with a short authored camera push", () => {
    const beat = ioRecognitionBeat({ outcome: "sealed", listenedToRoute: true });

    expect(beat.line).toBe(
      "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    );
    expect(beat.cameraPushMs).toBe(420);
    expect(beat.cameraPushMeters).toBe(0.34);
    expect(beat.signGlowDelayMs).toBe(120);
    expect(beat.stingDelayMs).toBe(180);
    expect(beat.screenLiftPx).toBe(6);
    expect(beat.screenShakePx).toBe(0.8);
  });

  it("uses the opened packet memory line and preserves the route-skip sting", () => {
    const beat = ioRecognitionBeat({ outcome: "opened", listenedToRoute: false });

    expect(beat.line).toBe(
      "You came back. The seal did not. I can use one of those facts. Next time, let me finish saving your life.",
    );
  });

  it("keeps the recognition motion bounded and finished within the beat window", () => {
    expect(recognitionBeatProgress(0)).toEqual({
      camera: 0,
      glow: 0,
      sting: 0,
      liftPx: 0,
      shakePx: 0,
    });

    const mid = recognitionBeatProgress(210);
    expect(mid.camera).toBeCloseTo(0.875, 3);
    expect(mid.glow).toBeGreaterThan(0);
    expect(mid.sting).toBeGreaterThan(0);
    expect(mid.liftPx).toBe(0);
    expect(Math.abs(mid.shakePx)).toBeLessThanOrEqual(0.8);

    const end = recognitionBeatProgress(880);
    expect(end.camera).toBe(1);
    expect(end.glow).toBe(0);
    expect(end.sting).toBe(0);
    expect(end.liftPx).toBe(0);
    expect(Math.abs(end.shakePx)).toBeLessThanOrEqual(0.8);
  });
});
