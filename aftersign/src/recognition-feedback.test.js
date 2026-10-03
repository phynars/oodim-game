import { describe, expect, it, vi } from "vitest";
import {
  computeRecognitionFeedbackState,
  detectRecognitionBeat,
  recognitionDomFeedbackMetadata,
  triggerRecognitionAudioCue,
} from "./recognition-feedback.js";

describe("recognition feedback", () => {
  it("classifies hit, early, late, and expired timing around the beat center", () => {
    expect(detectRecognitionBeat({ beatStartedAtMs: 0, inputAtMs: 590 }).timing).toBe("hit");
    expect(detectRecognitionBeat({ beatStartedAtMs: 0, inputAtMs: 430 }).timing).toBe("early");
    expect(detectRecognitionBeat({ beatStartedAtMs: 0, inputAtMs: 750 }).timing).toBe("late");
    expect(detectRecognitionBeat({ beatStartedAtMs: 0, inputAtMs: 1181 }).timing).toBe("miss");
  });

  it("returns stable feedback metadata for each transition", () => {
    expect(computeRecognitionFeedbackState({ timing: "hit", elapsedMs: 590 })).toMatchObject({
      state: "hit",
      acknowledged: true,
      cue: "recognition-hit",
    });
    expect(computeRecognitionFeedbackState({ timing: "miss", elapsedMs: 1180 })).toMatchObject({
      state: "miss",
      acknowledged: false,
      cue: "recognition-miss",
    });
    expect(recognitionDomFeedbackMetadata(computeRecognitionFeedbackState({ timing: "early" }))).toMatchObject({
      feedback: "early",
      active: "true",
    });
  });

  it("sequences cue dispatch through the injected audio API only", () => {
    const play = vi.fn();
    const feedback = computeRecognitionFeedbackState({ timing: "late" });
    expect(triggerRecognitionAudioCue({ play }, feedback)).toBe(true);
    expect(play).toHaveBeenCalledWith("recognition-late", feedback);
    expect(triggerRecognitionAudioCue(null, feedback)).toBe(false);
  });
});
