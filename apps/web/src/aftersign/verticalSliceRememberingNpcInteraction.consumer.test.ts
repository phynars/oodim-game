// @vitest-environment jsdom

// Consumer test for the remembering-NPC recognition FEEL wiring.
//
// This spec is DELIBERATELY driven through the shipped harness seam
// (`game.getRememberingNpcDialogue("io" | "orra")` on the object
// `bootAftersignWindowGame()` publishes as `window.__game`) rather
// than the `playAftersignRememberingNpcRecognitionFeel` module
// directly. The v1 of this test called a local
// `resolveAndPlayAftersignRememberingNpcInteraction` shim that was
// imported by NOTHING shipped — Soren's review (#1359) rightly
// rejected it as self-referential.
//
// The wiring under test is the side-effect in
// `harness/bootWindowGame.ts::getRememberingNpcDialogue`:
//   1. Resolve the dialogue through `resolveAftersignRememberingNpc-
//      Dialogue` (pure).
//   2. Call `playAftersignRememberingNpcRecognitionFeel(dialogue)` to
//      mount a `.aftersign-remembering-npc-recognition` layer on
//      `document.body` whose CSS custom properties + dataset carry
//      the flagship recognition envelope (portrait push-in, ring,
//      subtitle pop, audio-cue delay).
//   3. Return the pure dialogue to the caller.
//
// A future refactor that drops the side-effect from the shipped seam
// (moves it to a different hook, or "wires" it only from the test
// module again) fails these assertions before shipping.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bootAftersignWindowGame } from "./harness/bootWindowGame";
import { getAftersignRememberingNpcRecognitionFeel } from "./verticalSliceRememberingNpcInteraction";

const LAYER_SELECTOR = ".aftersign-remembering-npc-recognition";

function layers(): HTMLElement[] {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>(LAYER_SELECTOR),
  );
}

function makeMatchMedia(matches: boolean): (query: string) => MediaQueryList {
  return (query: string) => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mql: MediaQueryList = {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_type, listener) => {
        if (typeof listener === "function") {
          listeners.add(listener as (event: MediaQueryListEvent) => void);
        }
      },
      removeEventListener: (_type, listener) => {
        if (typeof listener === "function") {
          listeners.delete(listener as (event: MediaQueryListEvent) => void);
        }
      },
      dispatchEvent: () => true,
    } as MediaQueryList;
    return mql;
  };
}

function bringIoToRecognition(harness: ReturnType<typeof bootAftersignWindowGame>): void {
  // meet → save → load → meet flips ioRecognizesPlayer from false
  // (fresh state) → true, which is the shape that gates
  // `dialogue.recognitionFeel` on the returned dialogue.
  harness.meetNpc("io");
  harness.load(harness.save());
  harness.meetNpc("io");
}

describe("remembering NPC recognition feel — shipped harness wiring", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
    // Default: reduced-motion NOT set. Individual tests override.
    window.matchMedia = makeMatchMedia(false);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("mounts the recognition layer when the shipped seam resolves a returning-Io dialogue", () => {
    const game = bootAftersignWindowGame();
    bringIoToRecognition(game);

    const dialogue = game.getRememberingNpcDialogue("io");

    expect(dialogue.npc).toBe("io");
    expect(dialogue.recognizesPlayer).toBe(true);
    expect(dialogue.recognitionFeel).not.toBeNull();

    const mounted = layers();
    expect(mounted).toHaveLength(1);
    expect(mounted[0]!.dataset.npc).toBe("io");
    expect(mounted[0]!.dataset.recognizesPlayer).toBe("true");
    expect(mounted[0]!.textContent).toContain("Io remembers you");
  });

  it("stamps the flagship feel numbers onto the mounted layer", () => {
    const game = bootAftersignWindowGame();
    bringIoToRecognition(game);
    game.getRememberingNpcDialogue("io");

    const layer = layers()[0];
    expect(layer).toBeDefined();
    const feel = getAftersignRememberingNpcRecognitionFeel();

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

  it("collapses motion distance + audio cue when prefers-reduced-motion is set, but keeps the layer", () => {
    window.matchMedia = makeMatchMedia(true);
    const game = bootAftersignWindowGame();
    bringIoToRecognition(game);
    game.getRememberingNpcDialogue("io");

    const layer = layers()[0];
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

  it("does not mount a layer for first-session dialogue (no recognitionFeel)", () => {
    const game = bootAftersignWindowGame();

    // No meet → save → load → meet: state is fresh, ioRecognizesPlayer
    // stays false, resolver returns dialogue.recognitionFeel === null.
    const dialogue = game.getRememberingNpcDialogue("io");

    expect(dialogue.recognizesPlayer).toBe(false);
    expect(dialogue.recognitionFeel).toBeNull();
    expect(layers()).toHaveLength(0);
  });

  it("tears the layer down after the beat's max envelope + cleanup buffer", () => {
    const game = bootAftersignWindowGame();
    bringIoToRecognition(game);
    game.getRememberingNpcDialogue("io");

    expect(layers()).toHaveLength(1);

    const feel = getAftersignRememberingNpcRecognitionFeel();
    const cleanupDelayMs =
      Math.max(
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

  it("also fires on the Orra recognition path (parity with Io)", () => {
    const game = bootAftersignWindowGame();
    game.meetNpc("orra");
    game.load(game.save());
    game.meetNpc("orra");

    const dialogue = game.getRememberingNpcDialogue("orra");
    expect(dialogue.recognizesPlayer).toBe(true);
    expect(dialogue.recognitionFeel).not.toBeNull();

    const mounted = layers();
    expect(mounted).toHaveLength(1);
    expect(mounted[0]!.dataset.npc).toBe("orra");
    expect(mounted[0]!.textContent).toContain("Orra remembers you");
  });
});
