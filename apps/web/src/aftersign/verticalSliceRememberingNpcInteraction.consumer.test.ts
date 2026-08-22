// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL,
  type AftersignVerticalSliceState,
} from "./verticalSliceRuntimeState";
import {
  getAftersignRememberingNpcRecognitionFeel,
  resolveAndPlayAftersignRememberingNpcInteraction,
} from "./verticalSliceRememberingNpcInteraction";

const LAYER_SELECTOR = ".aftersign-remembering-npc-recognition";

function ioReturningState(): AftersignVerticalSliceState {
  return {
    scene: "io-return",
    packetOutcome: "sealed",
    ioHasMetPlayer: true,
    ioRecognizesPlayer: true,
    orraAction: null,
    orraHasMetPlayer: false,
    orraRecognizesPlayer: false,
    hasChosenReturnTone: false,
    hasAskedForNextJob: false,
  };
}

function ioFirstSessionState(): AftersignVerticalSliceState {
  return {
    ...ioReturningState(),
    ioHasMetPlayer: false,
    ioRecognizesPlayer: false,
  };
}

function layers(): Element[] {
  return Array.from(document.body.querySelectorAll(LAYER_SELECTOR));
}

describe("remembering NPC recognition consumer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("resolves a returning Io dialogue and appends the recognition layer", () => {
    const dialogue = resolveAndPlayAftersignRememberingNpcInteraction(
      ioReturningState(),
      "io",
    );

    expect(dialogue.npc).toBe("io");
    expect(dialogue.recognizesPlayer).toBe(true);
    expect(dialogue.recognitionFeel).toBe(AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL);
    expect(layers()).toHaveLength(1);
    expect(layers()[0]!.textContent).toContain("Io remembers you");
  });

  it("stamps the recognition feel numbers onto the live layer", () => {
    resolveAndPlayAftersignRememberingNpcInteraction(ioReturningState(), "io");

    const layer = layers()[0] as HTMLElement | undefined;
    expect(layer).toBeDefined();

    const feel = AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL;
    expect(layer!.dataset.npc).toBe("io");
    expect(layer!.dataset.recognizesPlayer).toBe("true");
    expect(layer!.dataset.recognitionPreLineHoldMs).toBe(String(feel.preLineHoldMs));
    expect(layer!.dataset.recognitionPortraitPushInPx).toBe(String(feel.portraitPushInPx));
    expect(layer!.dataset.recognitionPortraitPushInMs).toBe(String(feel.portraitPushInMs));
    expect(layer!.dataset.recognitionPortraitPushInEasing).toBe(feel.portraitPushInEasing);
    expect(layer!.dataset.recognitionRingDelayMs).toBe(String(feel.recognitionRingDelayMs));
    expect(layer!.dataset.recognitionRingDurationMs).toBe(String(feel.recognitionRingDurationMs));
    expect(layer!.dataset.recognitionRingScale).toBe(String(feel.recognitionRingScale));
    expect(layer!.dataset.recognitionRingOpacity).toBe(String(feel.recognitionRingOpacity));
    expect(layer!.dataset.recognitionSubtitlePopDelayMs).toBe(String(feel.subtitlePopDelayMs));
    expect(layer!.dataset.recognitionSubtitlePopDistancePx).toBe(String(feel.subtitlePopDistancePx));
    expect(layer!.dataset.recognitionSubtitlePopMs).toBe(String(feel.subtitlePopMs));
    expect(layer!.dataset.recognitionSubtitlePopEasing).toBe(feel.subtitlePopEasing);
    expect(layer!.dataset.recognitionAudioCueDelayMs).toBe(String(feel.audioCueDelayMs));
    expect(layer!.dataset.recognitionReducedMotion).toBeUndefined();
  });

  it("suppresses motion distance and audio cue under reducedMotion but keeps the layer", () => {
    resolveAndPlayAftersignRememberingNpcInteraction(
      ioReturningState(),
      "io",
      { reducedMotion: true },
    );

    const layer = layers()[0] as HTMLElement | undefined;
    expect(layer).toBeDefined();
    expect(layer!.style.getPropertyValue("--aftersign-recognition-portrait-push").trim()).toBe("0px");
    expect(layer!.style.getPropertyValue("--aftersign-recognition-ring-scale").trim()).toBe("1");
    expect(layer!.style.getPropertyValue("--aftersign-recognition-subtitle-distance").trim()).toBe("0px");
    expect(layer!.dataset.recognitionPortraitPushInPx).toBe("0");
    expect(layer!.dataset.recognitionRingScale).toBe("1");
    expect(layer!.dataset.recognitionSubtitlePopDistancePx).toBe("0");
    expect(layer!.dataset.recognitionAudioCueDelayMs).toBe("0");
    expect(layer!.dataset.recognitionReducedMotion).toBe("true");
  });

  it("does not append a recognition layer for first-session dialogue", () => {
    const dialogue = resolveAndPlayAftersignRememberingNpcInteraction(
      ioFirstSessionState(),
      "io",
    );

    expect(dialogue.recognizesPlayer).toBe(false);
    expect(dialogue.recognitionFeel).toBeNull();
    expect(layers()).toHaveLength(0);
  });

  it("keeps the layer alive through the full recognition beat then cleans it up", () => {
    resolveAndPlayAftersignRememberingNpcInteraction(ioReturningState(), "io");
    expect(layers()).toHaveLength(1);

    const feel = getAftersignRememberingNpcRecognitionFeel();
    const cleanupDelayMs = Math.max(
      feel.preLineHoldMs + feel.portraitPushInMs,
      feel.recognitionRingDelayMs + feel.recognitionRingDurationMs,
      feel.subtitlePopDelayMs + feel.subtitlePopMs,
      feel.audioCueDelayMs,
    ) + 80;

    vi.advanceTimersByTime(cleanupDelayMs - 1);
    expect(layers()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(layers()).toHaveLength(0);
  });
});
