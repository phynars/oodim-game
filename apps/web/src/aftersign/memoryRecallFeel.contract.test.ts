import { describe, expect, it } from "vitest";

import {
  MEMORY_RECALL_FEEL,
  getMemoryRecallFeel,
  sampleMemoryRecallFeel,
} from "./memoryRecallFeel";

describe("memoryRecallFeel — NPC recognition beat", () => {
  it("locks the recall-feel spec ms/px/degree numbers", () => {
    expect(MEMORY_RECALL_FEEL.durationMs).toBe(760);
    expect(MEMORY_RECALL_FEEL.recognizeMs).toBe(220);
    expect(MEMORY_RECALL_FEEL.settleMs).toBe(320);
    expect(MEMORY_RECALL_FEEL.holdMs).toBe(220);
    expect(MEMORY_RECALL_FEEL.captionLiftPx).toBe(14);
    expect(MEMORY_RECALL_FEEL.haloScalePeak).toBeCloseTo(1.18, 5);
    expect(MEMORY_RECALL_FEEL.cameraYawDeg).toBeCloseTo(1.6, 5);
    expect(MEMORY_RECALL_FEEL.bloomGainPeak).toBeCloseTo(0.34, 5);
    expect(MEMORY_RECALL_FEEL.audioGainPeak).toBeCloseTo(0.42, 5);
    expect(MEMORY_RECALL_FEEL.hapticMs).toBe(12);
  });

  it("blooms quickly, then settles into a readable held caption", () => {
    const start = getMemoryRecallFeel({ elapsedMs: 0 });
    const recognition = getMemoryRecallFeel({ elapsedMs: 220 });
    const settled = getMemoryRecallFeel({ elapsedMs: 540 });
    const held = getMemoryRecallFeel({ elapsedMs: 760 });

    expect(start.phase).toBe("dormant");
    expect(start.captionOpacity).toBe(0);
    expect(recognition.phase).toBe("recognize");
    expect(recognition.captionOpacity).toBeCloseTo(1, 5);
    expect(recognition.captionLiftPx).toBeCloseTo(14, 5);
    expect(recognition.haloScale).toBeCloseTo(1.18, 5);
    expect(settled.phase).toBe("settle");
    expect(settled.haloScale).toBeLessThan(recognition.haloScale);
    expect(settled.bloomGain).toBeLessThan(recognition.bloomGain);
    expect(held.phase).toBe("held");
    expect(held.captionOpacity).toBeCloseTo(0, 5);
    expect(held.audioGain).toBeCloseTo(0, 5);
  });

  it("keeps reduced motion readable while trimming camera and lift", () => {
    const full = getMemoryRecallFeel({ elapsedMs: 220 });
    const reduced = getMemoryRecallFeel({ elapsedMs: 220, reducedMotion: true });

    expect(reduced.captionOpacity).toBeCloseTo(full.captionOpacity, 5);
    expect(reduced.captionLiftPx).toBeLessThan(full.captionLiftPx);
    expect(reduced.cameraYawDeg).toBeLessThan(full.cameraYawDeg);
    expect(reduced.hapticMs).toBe(0);
  });

  it("samples a deterministic envelope through the whole 760ms beat", () => {
    const frames = sampleMemoryRecallFeel(40);

    expect(frames[0]?.elapsedMs).toBe(0);
    expect(frames.at(-1)?.elapsedMs).toBe(MEMORY_RECALL_FEEL.durationMs);
    expect(frames.some((frame) => frame.phase === "recognize")).toBe(true);
    expect(frames.some((frame) => frame.phase === "settle")).toBe(true);
    expect(frames.some((frame) => frame.phase === "held")).toBe(true);
  });
});
