import { describe, expect, it } from "vitest";

import {
  ioRecognitionBeat,
  recognitionBeatProgress,
  recognitionFeedbackContract,
} from "./recognitionBeat";

describe("ioRecognitionBeat — memory line resolver", () => {
  it("uses the sealed packet memory line when the player listened to the route", () => {
    const beat = ioRecognitionBeat({ outcome: "sealed", listenedToRoute: true });

    expect(beat.outcome).toBe("sealed");
    expect(beat.line).toBe(
      "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    );
    expect(beat.lineId).toBe("io.recognition.returning.sealed.listened.v1");
  });

  it("appends the corrective coda when the player skipped the route", () => {
    const beat = ioRecognitionBeat({ outcome: "opened", listenedToRoute: false });

    expect(beat.outcome).toBe("opened");
    expect(beat.line).toBe(
      "You came back. The seal did not. I can use one of those facts. Next time, let me finish saving your life.",
    );
    expect(beat.lineId).toBe("io.recognition.returning.opened.skipped.v1");
  });

  it("resolves distinct line ids per outcome × listened combination", () => {
    const ids = new Set([
      ioRecognitionBeat({ outcome: "sealed", listenedToRoute: true }).lineId,
      ioRecognitionBeat({ outcome: "sealed", listenedToRoute: false }).lineId,
      ioRecognitionBeat({ outcome: "opened", listenedToRoute: true }).lineId,
      ioRecognitionBeat({ outcome: "opened", listenedToRoute: false }).lineId,
    ]);

    expect(ids.size).toBe(4);
  });
});

describe("recognitionBeatProgress — delegates to the live contract", () => {
  it("starts at rest with zero camera delta and no sting", () => {
    const start = recognitionBeatProgress(0);

    expect(start.cameraDeltaMeters).toBe(0);
    expect(start.cameraYawDegrees).toBe(0);
    expect(start.stingGainDb).toBeNull();
    expect(start.progress).toBe(0);
  });

  it("peaks the camera delta at the contract's cameraPeakMs, not a locally hardcoded value", () => {
    const peak = recognitionBeatProgress(recognitionFeedbackContract.cameraPeakMs, {
      outcome: "sealed",
    });

    expect(peak.cameraDeltaMeters).toBeCloseTo(
      recognitionFeedbackContract.cameraDeltaMeters,
      6,
    );
    expect(peak.cameraYawDegrees).toBeCloseTo(
      recognitionFeedbackContract.cameraYawDegrees,
      6,
    );
  });

  it("respects reduced-motion by suppressing camera motion (inherited from the contract)", () => {
    const reduced = recognitionBeatProgress(80, {
      reducedMotion: true,
      outcome: "sealed",
    });

    expect(reduced.cameraDeltaMeters).toBe(0);
    expect(reduced.cameraYawDegrees).toBe(0);
    expect(reduced.totalMs).toBe(recognitionFeedbackContract.reducedMotionTotalMs);
  });

  it("emits outcome-branch light cues (lantern, packetSeal, kioskSign, rainRim) — not just camera + glow", () => {
    const sample = recognitionBeatProgress(200, { outcome: "opened" });

    expect(sample.lantern).toBeDefined();
    expect(sample.packetSeal).toBeDefined();
    expect(sample.kioskSign).toBeDefined();
    expect(sample.rainRim).toBeDefined();
    expect(sample.hapticScale).toBeDefined();
    expect(sample.audioCueIds).toContain("recognition-sting");
  });

  it("emits a wooden-click sample when the opened packet is torn (contract-owned timing)", () => {
    const stingStart = recognitionFeedbackContract.stingStartMs;
    const clickDelay = recognitionFeedbackContract.openedWoodenClickDelayMs;
    const opened = recognitionBeatProgress(stingStart + clickDelay + 5, {
      outcome: "opened",
    });

    expect(opened.woodenClickElapsedMs).not.toBeNull();
    expect(opened.woodenClickElapsedMs!).toBeGreaterThanOrEqual(0);
  });

  it("settles at the end of the beat — no perpetual oscillation past totalMs", () => {
    const settled = recognitionBeatProgress(
      recognitionFeedbackContract.totalMs + 500,
    );

    // elapsedMs is clamped to totalMs by the sampler → progress fully home,
    // sting has expired (null), and the beat has an endedAt timestamp.
    expect(settled.progress).toBe(1);
    expect(settled.elapsedMs).toBe(recognitionFeedbackContract.totalMs);
    expect(settled.stingGainDb).toBeNull();
    expect(settled.endedAt).not.toBeNull();
  });
});
