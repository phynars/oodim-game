// Consumer test: `sampleAftersignRememberingNpcRecognitionEnvelope` is
// consumed by the SHIPPED harness surface via
// `window.__game.sampleRecognitionEnvelope({ elapsedMs, reducedMotion })`.
//
// PR #1309 re-review (Soren) called the envelope "test-only" because the
// only importers were its own tests + the barrel re-export. This test
// locks the wiring on the real harness surface — same shape as
// `recallFeel({elapsedMs})` — so the envelope becomes a runtime
// contract on `window.__game`, not just a pure module.
//
// Wiring shape:
//   1. seed a returning-Io state (packet sealed + first meet), restore it
//   2. call `meetNpc("io")` — recognition transition fires the trigger
//   3. `game.sampleRecognitionEnvelope({elapsedMs})` returns the same
//      numeric envelope the pure sampler would produce
//   4. before any trigger, and on a first-contact-only fresh boot,
//      `sampleRecognitionEnvelope` returns null (same null-contract as
//      `recallFeel`)

import { beforeEach, describe, expect, it } from "vitest";

import { bootAftersignWindowGame } from "./bootWindowGame";

import {
  AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL,
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
  sampleAftersignRememberingNpcRecognitionEnvelope,
} from "../verticalSliceState";

const FEEL = AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL;

function seedReturningIoDurableSave(): string {
  const seedState = meetIoForAftersignSlice(
    recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
  );
  return encodeAftersignDurableSave(seedState, 4);
}

describe("window.__game.sampleRecognitionEnvelope — remembering-NPC recognition consumer", () => {
  beforeEach(() => {
    // Fresh harness per test — `bootAftersignWindowGame()` re-publishes
    // `window.__game`, clearing any trigger from a prior test.
    bootAftersignWindowGame();
  });

  it("is published on the shipped harness surface as a function", () => {
    const game = window.__game;
    expect(game).toBeTruthy();
    expect(typeof game?.sampleRecognitionEnvelope).toBe("function");
  });

  it("returns null before any recognition trigger has fired (fresh boot)", () => {
    const game = window.__game;
    // No meetNpc / restoreDurableSave yet — no trigger.
    expect(game?.sampleRecognitionEnvelope({ elapsedMs: 300 })).toBeNull();
  });

  it("returns null on a first-contact meet (no prior memory to recognize)", () => {
    const game = window.__game;
    // A fresh state's first meet does NOT flip `ioRecognizesPlayer` on
    // — it just sets `ioHasMetPlayer`. So no trigger fires; envelope is null.
    game?.meetNpc("io");
    expect(game?.sampleRecognitionEnvelope({ elapsedMs: 300 })).toBeNull();
  });

  it("returns the pure-sampler envelope once a recognition trigger fires", () => {
    const game = window.__game;
    game?.restoreDurableSave(seedReturningIoDurableSave());
    // Seed state already has `ioHasMetPlayer === true`, so THIS meet is
    // the recognition transition that fires the trigger.
    game?.meetNpc("io");

    const elapsedMs = 300; // peak of the ring sin-fade
    const envelope = game?.sampleRecognitionEnvelope({ elapsedMs });

    expect(envelope).not.toBeNull();
    // Same numeric contract as the pure sampler — no drift between the
    // shipped surface and the primitive it wraps.
    expect(envelope).toEqual(
      sampleAftersignRememberingNpcRecognitionEnvelope(elapsedMs),
    );
    expect(envelope?.elapsedMs).toBe(elapsedMs);
    expect(envelope?.recognitionRingOpacity).toBeCloseTo(
      FEEL.recognitionRingOpacity,
      6,
    );
    expect(envelope?.lineHoldComplete).toBe(true);
    expect(envelope?.audioCueArmed).toBe(true);
  });

  it("passes reducedMotion through to the pure sampler", () => {
    const game = window.__game;
    game?.restoreDurableSave(seedReturningIoDurableSave());
    game?.meetNpc("io");

    const elapsedMs = 300;
    const motion = game?.sampleRecognitionEnvelope({ elapsedMs });
    const reduced = game?.sampleRecognitionEnvelope({
      elapsedMs,
      reducedMotion: true,
    });

    expect(motion).not.toBeNull();
    expect(reduced).not.toBeNull();
    // Spatial channels collapse to zero, ring scale collapses to 1.
    expect(reduced?.portraitPushInPx).toBe(0);
    expect(reduced?.subtitlePopDistancePx).toBe(0);
    expect(reduced?.recognitionRingScale).toBe(1);
    // Opacity + timing semantics are preserved across the two modes.
    expect(reduced?.recognitionRingOpacity).toBe(
      motion?.recognitionRingOpacity,
    );
    expect(reduced?.subtitleOpacity).toBe(motion?.subtitleOpacity);
    expect(reduced?.audioCueArmed).toBe(motion?.audioCueArmed);
    expect(reduced?.lineHoldComplete).toBe(motion?.lineHoldComplete);
  });

  it("elapsedMs=0 collapses to the opening frame (no drift vs pure sampler)", () => {
    const game = window.__game;
    game?.restoreDurableSave(seedReturningIoDurableSave());
    game?.meetNpc("io");

    const envelope = game?.sampleRecognitionEnvelope({ elapsedMs: 0 });
    expect(envelope).not.toBeNull();
    expect(envelope?.elapsedMs).toBe(0);
    expect(envelope?.portraitPushInPx).toBe(0);
    expect(envelope?.recognitionRingOpacity).toBe(0);
    expect(envelope?.subtitleOpacity).toBe(0);
    expect(envelope?.lineHoldComplete).toBe(false);
    expect(envelope?.audioCueArmed).toBe(false);
  });

  it("NaN elapsedMs clamps to the opening frame instead of leaking NaN", () => {
    const game = window.__game;
    game?.restoreDurableSave(seedReturningIoDurableSave());
    game?.meetNpc("io");

    const envelope = game?.sampleRecognitionEnvelope({ elapsedMs: NaN });
    expect(envelope).not.toBeNull();
    expect(envelope?.elapsedMs).toBe(0);
    expect(Number.isFinite(envelope?.portraitPushInPx ?? NaN)).toBe(true);
    expect(Number.isFinite(envelope?.recognitionRingOpacity ?? NaN)).toBe(
      true,
    );
    expect(Number.isFinite(envelope?.subtitleOpacity ?? NaN)).toBe(true);
  });
});
