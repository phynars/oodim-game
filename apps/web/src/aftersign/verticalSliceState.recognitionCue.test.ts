// Wire-up test for the Io recognition-beat cue (PR #751 re-review).
//
// This exists to prove — end to end — that the `IoRecognitionBeatCue`
// module in `packages/aftersign/src/ioRecognitionBeat.ts` is actually
// consumed by the vertical-slice code:
//
//   1. `openAftersignIoRecognitionBeat` (PRODUCER) stamps a cue on story
//      state the moment Io recognizes the player, using the packet
//      outcome the player already committed.
//   2. `sampleAftersignIoRecognitionEnvelope` (RENDERER) reads that cue
//      and turns it into the live `recognitionFeedbackContract` envelope
//      the harness/PW tests already consume.
//
// If either the producer or the renderer regresses, this file fails.
// That's the "runnable slice code" the reviewer asked for.

import { describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  openAftersignIoRecognitionBeat,
  recordAftersignPacketChoice,
  restoreAftersignVerticalSliceState,
  sampleAftersignIoRecognitionEnvelope,
} from "./verticalSliceState";
import { recognitionFeedbackContract } from "./recognitionFeedback";

function returningRecognizedState(outcome: "sealed" | "opened") {
  // Play through: choose outcome, meet Io once, save, reload, meet Io again.
  // Only the second meeting sets `ioRecognizesPlayer = true`.
  const firstMeeting = meetIoForAftersignSlice(
    recordAftersignPacketChoice(createAftersignVerticalSliceState(), outcome),
  );
  const restored = restoreAftersignVerticalSliceState({
    version: 1,
    packetOutcome: firstMeeting.packetOutcome,
    ioHasMetPlayer: firstMeeting.ioHasMetPlayer,
  });
  return meetIoForAftersignSlice(restored);
}

describe("Io recognition-beat cue wire-up (producer + renderer)", () => {
  it("producer stamps a cue on story state when Io recognizes the sealed packet", () => {
    const returned = returningRecognizedState("sealed");

    const { cueState, cue } = openAftersignIoRecognitionBeat(returned, 4200);

    expect(cue).toEqual({
      kind: "io-recognition-beat",
      packetOutcome: "sealed",
      startedAtMs: 4200,
    });
    expect(cueState.lastCue).toBe("io-recognition-beat");
    expect(cueState.lastCueAt).toBe(4200);
    expect(cueState.ioRecognitionBeat).toBe(cue);
    expect(cueState.statePublishVersion).toBe(1);
  });

  it("producer carries the opened outcome through to the cue", () => {
    const returned = returningRecognizedState("opened");

    const { cue } = openAftersignIoRecognitionBeat(returned, 9100);

    expect(cue.packetOutcome).toBe("opened");
    expect(cue.startedAtMs).toBe(9100);
  });

  it("producer refuses to open the beat when Io does not recognize the player", () => {
    const firstMeeting = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );
    expect(firstMeeting.ioRecognizesPlayer).toBe(false);

    expect(() => openAftersignIoRecognitionBeat(firstMeeting, 100)).toThrow(
      /Io does not recognize/,
    );
  });

  it("producer refuses to open the beat when no packet outcome has been committed", () => {
    // Manually construct an impossible-in-practice state to prove the guard.
    const state = {
      ...createAftersignVerticalSliceState(),
      ioHasMetPlayer: true,
      ioRecognizesPlayer: true,
    };

    expect(() => openAftersignIoRecognitionBeat(state, 100)).toThrow(
      /packetOutcome is not committed/,
    );
  });

  it("renderer samples the envelope at cue start with zero progress and camera at rest", () => {
    const returned = returningRecognizedState("sealed");
    const { cue } = openAftersignIoRecognitionBeat(returned, 2000);

    const atStart = sampleAftersignIoRecognitionEnvelope(cue, 2000);

    expect(atStart.elapsedMs).toBe(0);
    expect(atStart.progress).toBe(0);
    expect(atStart.cameraDeltaMeters).toBe(0);
    expect(atStart.outcome).toBe("sealed");
    expect(atStart.startedAt).toBe(2000);
  });

  it("renderer sampling the cue at the camera peak matches the live contract", () => {
    const returned = returningRecognizedState("opened");
    const { cue } = openAftersignIoRecognitionBeat(returned, 5000);

    const nowMs = 5000 + recognitionFeedbackContract.cameraPeakMs;
    const atPeak = sampleAftersignIoRecognitionEnvelope(cue, nowMs);

    expect(atPeak.outcome).toBe("opened");
    expect(atPeak.cameraTargetOffsetMeters).toBe(
      recognitionFeedbackContract.openedTargetOffsetMeters,
    );
    // camera delta at peak == contract's peak delta (easeOutCubic(1) === 1)
    expect(atPeak.cameraDeltaMeters).toBeCloseTo(
      recognitionFeedbackContract.cameraDeltaMeters,
      6,
    );
    expect(atPeak.cameraYawDegrees).toBeCloseTo(
      recognitionFeedbackContract.cameraYawDegrees,
      6,
    );
  });

  it("renderer honors reducedMotion when sampling the cue", () => {
    const returned = returningRecognizedState("sealed");
    const { cue } = openAftersignIoRecognitionBeat(returned, 0);

    const reduced = sampleAftersignIoRecognitionEnvelope(cue, 80, {
      reducedMotion: true,
    });

    expect(reduced.totalMs).toBe(
      recognitionFeedbackContract.reducedMotionTotalMs,
    );
    expect(reduced.cameraDeltaMeters).toBe(0);
    expect(reduced.cameraYawDegrees).toBe(0);
  });

  it("nowMs before cue.startedAtMs clamps to elapsed=0 instead of going negative", () => {
    const returned = returningRecognizedState("sealed");
    const { cue } = openAftersignIoRecognitionBeat(returned, 10_000);

    const early = sampleAftersignIoRecognitionEnvelope(cue, 9_500);

    expect(early.elapsedMs).toBe(0);
    expect(early.progress).toBe(0);
  });
});
