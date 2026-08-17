import { describe, expect, it } from "vitest";
import {
  AFTERSIGN_FELT_RECOGNITION_BEAT,
  createAftersignFeltRecognitionLayer,
  projectReturnVariantForReducedMotion,
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
    // Non-returning cue: no return-variant datasets should leak onto the layer.
    expect(layer.dataset.isReturning).toBeUndefined();
    expect(layer.dataset.returnCardLiftPx).toBeUndefined();
  });

  it("pins the return-variant sub-envelope numbers on the same contract", () => {
    expect(AFTERSIGN_FELT_RECOGNITION_BEAT.returnVariant).toMatchObject({
      anticipationMs: 48,
      cardLiftPx: 10,
      cameraNodDeg: 1.6,
      shakePx: 3,
      shakeMs: 90,
      bloomPulseMs: 180,
      chipPopPx: 8,
      chipPopScale: 1.08,
      easeOutBack: "cubic-bezier(0.18, 0.89, 0.32, 1.28)",
      easeSettle: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
  });

  it("resolves the returning-player flavor with a distinct line and returning aria hint", () => {
    const cue = resolveAftersignFeltRecognitionCue({
      playerName: "Inez",
      rememberedAction: "sealed the packet",
      npcName: "Sen",
      isReturning: true,
    });

    expect(cue.isReturning).toBe(true);
    expect(cue.line).toBe(
      "Sen remembers you again, Inez: sealed the packet.",
    );
    expect(cue.ariaLabel).toBe(
      "Sen recognizes Inez returning and recalls sealed the packet.",
    );
    // Same contract object — no forked feel numbers.
    expect(cue.feel).toBe(AFTERSIGN_FELT_RECOGNITION_BEAT);
  });

  it("exposes return-variant datasets on the layer only when the cue is returning", () => {
    const cue = resolveAftersignFeltRecognitionCue({
      playerName: "Inez",
      rememberedAction: "sealed the packet",
      npcName: "Sen",
      isReturning: true,
    });
    const layer = createAftersignFeltRecognitionLayer(cue);

    expect(layer.dataset.isReturning).toBe("true");
    expect(layer.dataset.returnAnticipationMs).toBe("48");
    expect(layer.dataset.returnCardLiftPx).toBe("10");
    expect(layer.dataset.returnCameraNodDeg).toBe("1.6");
    expect(layer.dataset.returnShakePx).toBe("3");
    expect(layer.dataset.returnShakeMs).toBe("90");
    expect(layer.dataset.returnBloomPulseMs).toBe("180");
    expect(layer.dataset.returnChipPopPx).toBe("8");
    expect(layer.dataset.returnChipPopScale).toBe("1.08");
    expect(layer.dataset.returnEaseOutBack).toBe(
      "cubic-bezier(0.18, 0.89, 0.32, 1.28)",
    );
    expect(layer.dataset.returnEaseSettle).toBe(
      "cubic-bezier(0.22, 1, 0.36, 1)",
    );
  });

  it("projects the return variant for reduced motion (zero travel, capped bloom, settle easing)", () => {
    const projected = projectReturnVariantForReducedMotion();

    expect(projected).toMatchObject({
      anticipationMs: 48,
      cardLiftPx: 0,
      cameraNodDeg: 0,
      shakePx: 0,
      shakeMs: 0,
      // Bloom is capped, not zeroed — the beat still needs to READ.
      bloomPulseMs: 120,
      chipPopPx: 0,
      chipPopScale: 1,
      easeOutBack: "cubic-bezier(0.22, 1, 0.36, 1)",
      easeSettle: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
  });
});
