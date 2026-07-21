import { getAftersignFirstCameraMoveFeel } from "./firstCameraMoveFeel";

describe("Aftersign first camera move feel contract", () => {
  it("keeps the opening camera move short, readable, and mobile-safe", () => {
    const feel = getAftersignFirstCameraMoveFeel();

    expect(feel.beatId).toBe("aftersign.firstCameraMove.v1");
    expect(feel.durationMs).toBeGreaterThanOrEqual(900);
    expect(feel.durationMs).toBeLessThanOrEqual(1200);
    expect(feel.maximumControlLockMs).toBeLessThanOrEqual(900);
    expect(feel.easing).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
    expect(feel.end.distanceMeters).toBeLessThan(feel.start.distanceMeters);
    expect(feel.end.heightMeters).toBeLessThan(feel.start.heightMeters);
  });

  it("couples lantern, sign glow, wet-sheen, and bell timing into one authored beat", () => {
    const feel = getAftersignFirstCameraMoveFeel();
    const glowTotalMs = feel.signGlow.riseMs + feel.signGlow.holdMs + feel.signGlow.fallMs;

    expect(feel.lanternLeadMs).toBeGreaterThanOrEqual(100);
    expect(feel.lanternLeadMs).toBeLessThanOrEqual(140);
    expect(glowTotalMs).toBeLessThanOrEqual(feel.durationMs);
    expect(feel.signGlow.peakIntensityMultiplier).toBeGreaterThanOrEqual(1.25);
    expect(feel.signGlow.peakIntensityMultiplier).toBeLessThanOrEqual(1.4);
    expect(feel.wetSurfaceSheenPulse.offsetMs).toBeLessThan(feel.audioCoupling.bellHitMs);
    expect(feel.audioCoupling.bellHitMs).toBeGreaterThan(650);
    expect(feel.audioCoupling.bellHitMs).toBeLessThan(850);
    expect(feel.audioCoupling.rainDuckDb).toBe(-3);
  });

  it("does not add shake to the first camera move", () => {
    const feel = getAftersignFirstCameraMoveFeel();

    expect(feel.mobileSafety.targetFps).toBe(60);
    expect(feel.mobileSafety.maxCameraTravelDegreesPerFrameAt60fps).toBeLessThanOrEqual(0.65);
    expect(feel.mobileSafety.maxScreenShakePx).toBe(0);
  });
});
