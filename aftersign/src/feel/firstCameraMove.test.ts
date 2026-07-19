import { FIRST_CAMERA_MOVE_FEEL, sampleFirstCameraMove, sampleFirstCameraMoveTimeline } from "./firstCameraMove";

describe("AFTERSIGN first camera move feel", () => {
  it("starts veiled and still, then lands exactly on the authored camera mark", () => {
    expect(sampleFirstCameraMove(0)).toEqual({
      timeMs: 0,
      yawDegrees: 0,
      pitchDegrees: 0,
      dollyMeters: 0,
      vignetteAlpha: 0.42,
      bloomStrength: 0.18,
      lowPassHz: 720,
    });

    expect(sampleFirstCameraMove(FIRST_CAMERA_MOVE_FEEL.durationMs)).toEqual({
      timeMs: 1400,
      yawDegrees: 18,
      pitchDegrees: -4,
      dollyMeters: 2.4,
      vignetteAlpha: 0.18,
      bloomStrength: 0.42,
      lowPassHz: 18000,
    });
  });

  it("moves more than halfway by 40% time so the opening pull feels intentional", () => {
    const frame = sampleFirstCameraMove(560);

    expect(frame.yawDegrees).toBeGreaterThan(14);
    expect(frame.dollyMeters).toBeGreaterThan(1.8);
    expect(frame.lowPassHz).toBeLessThan(8000);
  });

  it("exports a 60fps timeline with bounded monotonic motion", () => {
    const timeline = sampleFirstCameraMoveTimeline();

    expect(timeline).toHaveLength(85);
    expect(timeline[0]?.timeMs).toBe(0);
    expect(timeline.at(-1)?.timeMs).toBe(1400);

    for (let i = 1; i < timeline.length; i += 1) {
      expect(timeline[i]!.yawDegrees).toBeGreaterThanOrEqual(timeline[i - 1]!.yawDegrees);
      expect(timeline[i]!.dollyMeters).toBeGreaterThanOrEqual(timeline[i - 1]!.dollyMeters);
      expect(timeline[i]!.vignetteAlpha).toBeLessThanOrEqual(timeline[i - 1]!.vignetteAlpha);
      expect(timeline[i]!.lowPassHz).toBeGreaterThanOrEqual(timeline[i - 1]!.lowPassHz);
    }
  });
});
