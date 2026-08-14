import { describe, expect, it } from "vitest";
import {
  AFTERSIGN_FELT_RECOGNITION_BEAT,
  createAftersignFeltRecognitionLayer,
  resolveAftersignFeltRecognitionCue,
} from "./feltRecognitionBeat";

describe("AFTERSIGN_FELT_RECOGNITION_BEAT", () => {
  it("pins the player-visible recognition timing and motion numbers", () => {
    expect(AFTERSIGN_FELT_RECOGNITION_BEAT).toMatchObject({
      durationMs: 940,
      nameRevealDelayMs: 120,
      eyeContactHoldMs: 260,
      memoryEchoDelayMs: 420,
      cameraPushPx: 18,
      shoulderLiftPx: -6,
      bloomScale: 1.08,
      shakePx: 2,
      shakeFrames: 6,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      audio: {
        whisperCue: "memory-whisper-a4",
        chimeCue: "recognition-chime-c6",
        chimeDelayMs: 160,
      },
    });
  });

  it("resolves the remembered player line and trims noisy stored memory", () => {
    const cue = resolveAftersignFeltRecognitionCue({
      playerName: "  Inez   Vale ",
      rememberedAction: " opened   the violet packet ",
      npcName: "  Courier Sen ",
    });

    expect(cue.line).toBe(
      "Courier Sen remembers you, Inez Vale: opened the violet packet.",
    );
    expect(cue.ariaLabel).toBe(
      "Courier Sen recognizes Inez Vale and recalls opened the violet packet.",
    );
    expect(cue.feel).toBe(AFTERSIGN_FELT_RECOGNITION_BEAT);
  });

  it("creates an accessible layer carrying the feel contract for served-page wiring", () => {
    const cue = resolveAftersignFeltRecognitionCue({
      playerName: "Inez",
      rememberedAction: "sealed the packet",
      npcName: "Sen",
    });

    const layer = createAftersignFeltRecognitionLayer(cue);

    expect(layer.className).toBe("aftersign-felt-recognition");
    expect(layer.getAttribute("role")).toBe("status");
    expect(layer.getAttribute("aria-live")).toBe("polite");
    expect(layer.getAttribute("aria-label")).toBe(
      "Sen recognizes Inez and recalls sealed the packet.",
    );
    expect(layer.textContent).toBe(
      "Sen remembers you, Inez: sealed the packet.",
    );
    expect(layer.dataset.durationMs).toBe("940");
    expect(layer.dataset.nameRevealDelayMs).toBe("120");
    expect(layer.dataset.eyeContactHoldMs).toBe("260");
    expect(layer.dataset.memoryEchoDelayMs).toBe("420");
    expect(layer.dataset.cameraPushPx).toBe("18");
    expect(layer.dataset.shoulderLiftPx).toBe("-6");
    expect(layer.dataset.bloomScale).toBe("1.08");
    expect(layer.dataset.shakePx).toBe("2");
    expect(layer.dataset.shakeFrames).toBe("6");
    expect(layer.dataset.easing).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
    expect(layer.dataset.whisperCue).toBe("memory-whisper-a4");
    expect(layer.dataset.chimeCue).toBe("recognition-chime-c6");
    expect(layer.dataset.chimeDelayMs).toBe("160");
  });
});
