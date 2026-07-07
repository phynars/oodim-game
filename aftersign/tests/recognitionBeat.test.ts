import { describe, expect, it } from "vitest";

import {
  recognitionBeat,
  recognitionBeatAcceptanceSamples,
  sampleRecognitionBeat,
} from "../src/recognitionBeat";

describe("recognition beat", () => {
  it("keeps the first returning-player recognition beat inside a tight 800ms cue stack", () => {
    expect(recognitionBeat.totalMs).toBe(800);
    expect(recognitionBeat.holdFramesAt60Hz).toBe(11);
    expect(recognitionBeat.easing).toBe("cubic-bezier(0.18, 0.9, 0.22, 1)");
    expect(recognitionBeat.cues).toEqual([
      expect.objectContaining({
        phase: "approach",
        startMs: 0,
        durationMs: 220,
        cameraPushDegrees: 0.8,
        screenShakePx: 0,
      }),
      expect.objectContaining({
        phase: "notice",
        startMs: 220,
        durationMs: 140,
        cameraPushDegrees: 1.6,
        screenShakePx: 0.75,
      }),
      expect.objectContaining({
        phase: "recognition",
        startMs: 360,
        durationMs: 180,
        cameraPushDegrees: 2.4,
        screenShakePx: 1.25,
        signGlow: 1,
      }),
      expect.objectContaining({
        phase: "release",
        startMs: 540,
        durationMs: 260,
        cameraPushDegrees: 0,
        screenShakePx: 0,
      }),
    ]);
  });

  it("samples concrete AV feedback values for the harness to expose on window.__game", () => {
    expect(recognitionBeatAcceptanceSamples()).toEqual([
      {
        elapsedMs: 0,
        phase: "approach",
        cameraPushDegrees: 0,
        screenShakePx: 0,
        signGlow: 0,
        audioGain: 0,
      },
      {
        elapsedMs: 220,
        phase: "notice",
        cameraPushDegrees: 0,
        screenShakePx: 0,
        signGlow: 0,
        audioGain: 0,
      },
      {
        elapsedMs: 360,
        phase: "recognition",
        cameraPushDegrees: 0,
        screenShakePx: 0,
        signGlow: 0,
        audioGain: 0,
      },
      {
        elapsedMs: 540,
        phase: "release",
        cameraPushDegrees: 0,
        screenShakePx: 0,
        signGlow: 0,
        audioGain: 0,
      },
      {
        elapsedMs: 800,
        phase: "release",
        cameraPushDegrees: 0,
        screenShakePx: 0,
        signGlow: 0.35,
        audioGain: 0.22,
      },
    ]);
  });

  it("peaks the coupled camera, glow, sting, and micro-shake during recognition", () => {
    const sample = sampleRecognitionBeat(450);

    expect(sample.phase).toBe("recognition");
    expect(sample.cameraPushDegrees).toBeGreaterThan(2.4);
    expect(sample.screenShakePx).toBeGreaterThan(0.7);
    expect(sample.signGlow).toBeGreaterThan(1);
    expect(sample.audioGain).toBeCloseTo(0.525, 3);
  });

  it("clamps samples before and after the beat window", () => {
    expect(sampleRecognitionBeat(-40)).toEqual(sampleRecognitionBeat(0));
    expect(sampleRecognitionBeat(900)).toEqual(sampleRecognitionBeat(800));
  });
});
