// Consumer test for the NPC felt-recognition beat wiring.
//
// `resolveAndPlayAftersignFeltRecognitionBeat` is the served-surface
// entry point of the felt-recognition lane — a shipped page's NPC
// recognition beat resolves a stored memory line and mounts the
// `.aftersign-felt-recognition` layer onto `document.body`. This
// jsdom test drives the resolver on a plausible memory payload and
// asserts:
//   - the layer is appended to `document.body`;
//   - it's labeled per resolved cue (npc + player + remembered action);
//   - it exposes the pinned feel numbers via `dataset` so a served
//     renderer can drive CSS/audio from real, contract-backed values;
//   - `reducedMotion` zeroes the motion dataset entries but keeps the
//     layer + timing metadata intact;
//   - the layer is cleaned up at `durationMs + FELT_RECOGNITION_CLEANUP_TAIL_MS`,
//     matching the confirm-feel lane's cleanup shape;
//   - `dispose()` rips the layer down early (scene-transition safety).
//
// Scope guard: this test does NOT touch the ms/px numbers in
// AFTERSIGN_FELT_RECOGNITION_BEAT — `feltRecognitionBeat.test.ts` pins
// those. It only asserts the WIRING between the contract and the
// served DOM surface.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AFTERSIGN_FELT_RECOGNITION_BEAT,
  FELT_RECOGNITION_CLEANUP_TAIL_MS,
  playAftersignFeltRecognitionBeat,
  resolveAftersignFeltRecognitionCue,
  resolveAndPlayAftersignFeltRecognitionBeat,
} from "./feltRecognitionBeat";

const LAYER_SELECTOR = ".aftersign-felt-recognition";

function layers(): Element[] {
  return Array.from(document.body.querySelectorAll(LAYER_SELECTOR));
}

describe("feltRecognitionBeat consumer (NPC recognition wiring)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("mounts exactly one layer on document.body when the served surface plays the beat", () => {
    const handle = resolveAndPlayAftersignFeltRecognitionBeat({
      playerName: "Inez Vale",
      rememberedAction: "opened the violet packet",
      npcName: "Courier Sen",
    });

    expect(layers()).toHaveLength(1);
    expect(handle.layer.isConnected).toBe(true);
    expect(handle.layer.parentElement).toBe(document.body);
  });

  it("labels the served layer with the resolved recognition line and aria label", () => {
    resolveAndPlayAftersignFeltRecognitionBeat({
      playerName: "Inez Vale",
      rememberedAction: "opened the violet packet",
      npcName: "Courier Sen",
    });

    const layer = layers()[0] as HTMLElement;
    expect(layer.textContent).toBe(
      "Courier Sen remembers you, Inez Vale: opened the violet packet.",
    );
    expect(layer.getAttribute("aria-label")).toBe(
      "Courier Sen recognizes Inez Vale and recalls opened the violet packet.",
    );
    expect(layer.getAttribute("role")).toBe("status");
    expect(layer.getAttribute("aria-live")).toBe("polite");
  });

  it("carries the pinned feel numbers on the mounted layer's dataset", () => {
    resolveAndPlayAftersignFeltRecognitionBeat({
      playerName: "Inez",
      rememberedAction: "sealed the packet",
      npcName: "Sen",
    });

    const layer = layers()[0] as HTMLElement;
    expect(layer.dataset.durationMs).toBe(
      String(AFTERSIGN_FELT_RECOGNITION_BEAT.durationMs),
    );
    expect(layer.dataset.cameraPushPx).toBe(
      String(AFTERSIGN_FELT_RECOGNITION_BEAT.cameraPushPx),
    );
    expect(layer.dataset.easing).toBe(AFTERSIGN_FELT_RECOGNITION_BEAT.easing);
    expect(layer.dataset.whisperCue).toBe(
      AFTERSIGN_FELT_RECOGNITION_BEAT.audio.whisperCue,
    );
    expect(layer.dataset.chimeCue).toBe(
      AFTERSIGN_FELT_RECOGNITION_BEAT.audio.chimeCue,
    );
  });

  it("supports mounting to a caller-provided root instead of document.body", () => {
    const stage = document.createElement("section");
    stage.id = "aftersign-stage";
    document.body.appendChild(stage);

    const handle = resolveAndPlayAftersignFeltRecognitionBeat(
      {
        playerName: "Inez",
        rememberedAction: "sealed the packet",
      },
      { root: stage },
    );

    expect(handle.layer.parentElement).toBe(stage);
    // `document.body.querySelectorAll` traverses descendants — the layer
    // is inside the custom root but still reachable from body.
    expect(layers()).toHaveLength(1);
  });

  it("zeroes motion dataset values under reducedMotion but keeps timing metadata", () => {
    resolveAndPlayAftersignFeltRecognitionBeat(
      {
        playerName: "Inez",
        rememberedAction: "sealed the packet",
      },
      { reducedMotion: true },
    );

    const layer = layers()[0] as HTMLElement;
    expect(layer.dataset.reducedMotion).toBe("true");
    expect(layer.dataset.cameraPushPx).toBe("0");
    expect(layer.dataset.shoulderLiftPx).toBe("0");
    expect(layer.dataset.shakePx).toBe("0");
    expect(layer.dataset.shakeFrames).toBe("0");
    // Timing / audio metadata must survive reducedMotion — the beat
    // still reads (name reveal, memory echo) at the pinned tempo.
    expect(layer.dataset.durationMs).toBe(
      String(AFTERSIGN_FELT_RECOGNITION_BEAT.durationMs),
    );
    expect(layer.dataset.nameRevealDelayMs).toBe(
      String(AFTERSIGN_FELT_RECOGNITION_BEAT.nameRevealDelayMs),
    );
    expect(layer.dataset.whisperCue).toBe(
      AFTERSIGN_FELT_RECOGNITION_BEAT.audio.whisperCue,
    );
  });

  it("cleans up the served layer at durationMs + tailMs", () => {
    resolveAndPlayAftersignFeltRecognitionBeat({
      playerName: "Inez",
      rememberedAction: "sealed the packet",
    });
    expect(layers()).toHaveLength(1);

    const { durationMs } = AFTERSIGN_FELT_RECOGNITION_BEAT;

    // Just before the cleanup deadline the layer must still exist.
    vi.advanceTimersByTime(durationMs + FELT_RECOGNITION_CLEANUP_TAIL_MS - 1);
    expect(layers()).toHaveLength(1);

    // At the deadline it must be removed.
    vi.advanceTimersByTime(1);
    expect(layers()).toHaveLength(0);
  });

  it("dispose() rips the layer down early and cancels the auto-cleanup", () => {
    const handle = resolveAndPlayAftersignFeltRecognitionBeat({
      playerName: "Inez",
      rememberedAction: "sealed the packet",
    });
    expect(layers()).toHaveLength(1);

    handle.dispose();
    expect(layers()).toHaveLength(0);

    // Running any remaining timers must not re-throw or resurrect the layer.
    vi.advanceTimersByTime(
      AFTERSIGN_FELT_RECOGNITION_BEAT.durationMs +
        FELT_RECOGNITION_CLEANUP_TAIL_MS +
        200,
    );
    expect(layers()).toHaveLength(0);

    // Second dispose is a no-op.
    expect(() => handle.dispose()).not.toThrow();
  });

  it("supports staging multiple concurrent recognition beats, each cleaned up independently", () => {
    resolveAndPlayAftersignFeltRecognitionBeat({
      playerName: "Inez",
      rememberedAction: "opened the violet packet",
      npcName: "Sen",
    });
    resolveAndPlayAftersignFeltRecognitionBeat({
      playerName: "Inez",
      rememberedAction: "held the door for Mara",
      npcName: "Mara",
    });

    expect(layers()).toHaveLength(2);

    vi.advanceTimersByTime(
      AFTERSIGN_FELT_RECOGNITION_BEAT.durationMs +
        FELT_RECOGNITION_CLEANUP_TAIL_MS,
    );
    expect(layers()).toHaveLength(0);
  });

  it("plays a pre-resolved cue without re-running the resolver", () => {
    // Splitting resolve + play mirrors the confirm-feel lane's
    // resolveAftersign… / playAftersign… pair — a served surface that
    // wants to inspect the cue before mounting can go through the
    // two-step path.
    const cue = resolveAftersignFeltRecognitionCue({
      playerName: "Inez",
      rememberedAction: "sealed the packet",
      npcName: "Sen",
    });
    const handle = playAftersignFeltRecognitionBeat(cue);

    expect(handle.cue).toBe(cue);
    expect(handle.feel).toBe(AFTERSIGN_FELT_RECOGNITION_BEAT);
    expect(layers()).toHaveLength(1);
    expect(layers()[0]!.textContent).toBe(cue.line);
  });
});
