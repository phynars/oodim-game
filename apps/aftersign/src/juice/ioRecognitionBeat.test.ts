import {
  buildIoRecognitionBeat,
  recognitionBeatAcceptance,
  sampleCameraOffset,
  sampleEasing,
} from "./ioRecognitionBeat";

describe("Io recognition beat", () => {
  it("binds the sealed return line to warm, trusting cues", () => {
    const beat = buildIoRecognitionBeat("sealed");

    expect(beat.id).toBe("io-recognition-sealed");
    expect(beat.line).toContain("blue seal, unbroken");
    expect(beat.totalDurationMs).toBe(1320);
    expect(beat.playerInputLockMs).toBe(620);
    expect(beat.camera).toMatchObject({
      durationMs: 520,
      pushInMeters: 0.42,
      riseMeters: 0.06,
      yawDegrees: -1.4,
      pitchDegrees: -1.8,
      easing: "easeOutCubic",
    });
    expect(beat.visuals.find((cue) => cue.target === "io-lantern")).toMatchObject({
      startMs: 80,
      durationMs: 360,
      intensityTo: 1.42,
      color: "#ffc56a",
    });
    expect(beat.audio[1]).toMatchObject({
      startMs: 130,
      id: "seal-wax-click",
      gainDb: -9,
    });
    expect(beat.hapticScale).toMatchObject({
      startMs: 130,
      durationMs: 38,
      amplitude: 0.24,
    });
  });

  it("binds the opened return line to cooler, reduced-trust cues", () => {
    const beat = buildIoRecognitionBeat("opened");

    expect(beat.id).toBe("io-recognition-opened");
    expect(beat.line).toContain("The seal did not");
    expect(beat.visuals.find((cue) => cue.target === "io-lantern")).toMatchObject({
      intensityTo: 1.18,
      color: "#d8f1ff",
    });
    expect(beat.visuals.find((cue) => cue.target === "packet-seal")).toMatchObject({
      intensityFrom: 0.35,
      intensityTo: 0.7,
      color: "#8aa4ad",
    });
    expect(beat.audio[1]).toMatchObject({
      startMs: 130,
      id: "seal-paper-tear",
      gainDb: -11,
    });
    expect(beat.audio[2]).toMatchObject({
      id: "bell-soft",
      gainDb: -16,
    });
    expect(beat.hapticScale).toMatchObject({
      durationMs: 24,
      amplitude: 0.14,
    });
  });

  it("samples easing curves deterministically", () => {
    expect(sampleEasing("linear", 0.5)).toBe(0.5);
    expect(sampleEasing("easeOutCubic", 0.5)).toBeCloseTo(0.875, 6);
    expect(sampleEasing("easeOutQuart", 0.5)).toBeCloseTo(0.9375, 6);
    expect(sampleEasing("easeInOutSine", 0.5)).toBeCloseTo(0.5, 6);
    expect(sampleEasing("easeOutCubic", -1)).toBe(0);
    expect(sampleEasing("easeOutCubic", 2)).toBe(1);
  });

  it("samples the camera push-in in meters", () => {
    const beat = buildIoRecognitionBeat("sealed");
    const start = sampleCameraOffset(beat.camera, 0);
    const end = sampleCameraOffset(beat.camera, 520);

    expect(start).toEqual({ x: -0, y: 0, z: -0 });
    expect(end.y).toBeCloseTo(0.06, 6);
    expect(end.z).toBeCloseTo(-0.42, 6);
    expect(end.x).toBeCloseTo(-0.010261, 6);
  });

  it("exposes measurable acceptance checks for the runnable slice", () => {
    expect(recognitionBeatAcceptance("sealed")).toEqual([
      "Io line references the unbroken blue seal.",
      "Camera push-in reaches 0.42m over 520ms with easeOutCubic.",
      "Player input is locked for 620ms, then movement returns before the line finishes.",
      "Packet seal audio fires at 130ms and matches the persisted packet outcome.",
      "Recognition beat completes within 1320ms and leaves no modal UI on screen.",
    ]);
  });
});
