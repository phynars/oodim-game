// Consumer test: `sampleAftersignRememberingNpcRecognitionBeat` is the
// render-path entry the served renderer calls once per frame for both Io
// and Orra's remembering choreography. It joins the two halves the
// vertical slice already owns — the SOURCED dialogue (via
// `resolveAftersignRememberingNpcDialogue`) and the PURE numeric envelope
// (via `sampleAftersignRememberingNpcRecognitionEnvelope`) — into a
// single `{ dialogue, envelope }` shape.
//
// PR #1309 re-review (Soren): the envelope sampler was self-consumed by
// its own contract test. This test locks the WRAPPER call path — a real
// non-test caller in `verticalSliceRecognitionBeat.ts`, sibling to the
// existing `sampleAftersignIoRecognitionEnvelope` and
// `sampleAftersignOrraRecognitionEnvelope` render entries — so the
// numeric contract has a consumer in the recognition-beat render module.

import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL,
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  recordAftersignOrraAction,
  recordAftersignPacketChoice,
  sampleAftersignRememberingNpcRecognitionBeat,
  sampleAftersignRememberingNpcRecognitionEnvelope,
} from "./verticalSliceState";

const FEEL = AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL;

function returningIoState() {
  const fresh = createAftersignVerticalSliceState();
  const withPacket = recordAftersignPacketChoice(fresh, "sealed");
  const firstMeet = meetIoForAftersignSlice(withPacket);
  // Second meet flips `ioRecognizesPlayer` on (recognizes when
  // `ioHasMetPlayer` was true going in).
  return meetIoForAftersignSlice(firstMeet);
}

function returningOrraState() {
  const fresh = createAftersignVerticalSliceState();
  const withAction = recordAftersignOrraAction(fresh, "answered-saint-orra");
  const firstMeet = meetOrraForAftersignSlice(withAction);
  return meetOrraForAftersignSlice(firstMeet);
}

describe("sampleAftersignRememberingNpcRecognitionBeat — render-path wrapper", () => {
  it("recognition path: returns dialogue with feel AND a numeric envelope for Io", () => {
    const state = returningIoState();
    const nowMs = 300; // ring-opacity peak inside the choreography window.
    const beat = sampleAftersignRememberingNpcRecognitionBeat(state, "io", nowMs);

    expect(beat.dialogue.npc).toBe("io");
    expect(beat.dialogue.recognizesPlayer).toBe(true);
    expect(beat.dialogue.lines).toHaveLength(1);
    expect(beat.dialogue.recognitionFeel).toBe(FEEL);

    // Envelope is a real sample, NOT null — this is the recognition path.
    expect(beat.envelope).not.toBeNull();
    // And it matches the pure sampler on the same inputs (no drift).
    expect(beat.envelope).toEqual(
      sampleAftersignRememberingNpcRecognitionEnvelope(nowMs),
    );
    expect(beat.envelope?.recognitionRingOpacity).toBeCloseTo(
      FEEL.recognitionRingOpacity,
      6,
    );
  });

  it("recognition path: passes reducedMotion through to the envelope for Orra", () => {
    const state = returningOrraState();
    const nowMs = 300;
    const motion = sampleAftersignRememberingNpcRecognitionBeat(
      state,
      "orra",
      nowMs,
    );
    const reduced = sampleAftersignRememberingNpcRecognitionBeat(
      state,
      "orra",
      nowMs,
      { reducedMotion: true },
    );

    expect(motion.dialogue.recognizesPlayer).toBe(true);
    expect(reduced.dialogue.recognizesPlayer).toBe(true);

    // Motion channels: zeroed under reduced motion.
    expect(reduced.envelope?.portraitPushInPx).toBe(0);
    expect(reduced.envelope?.subtitlePopDistancePx).toBe(0);
    expect(reduced.envelope?.recognitionRingScale).toBe(1);
    // Opacity channel: identical between motion and reduced-motion samples.
    expect(reduced.envelope?.recognitionRingOpacity).toBe(
      motion.envelope?.recognitionRingOpacity,
    );
  });

  it("first-contact path: envelope is null (no recognition choreography to sample)", () => {
    // Fresh state → Io hasn't met the player before → first-contact line.
    const fresh = createAftersignVerticalSliceState();
    const firstMeet = meetIoForAftersignSlice(fresh);
    const beat = sampleAftersignRememberingNpcRecognitionBeat(
      firstMeet,
      "io",
      300,
    );

    expect(beat.dialogue.recognizesPlayer).toBe(false);
    expect(beat.dialogue.recognitionFeel).toBeNull();
    // Envelope MUST be null on the first-contact path — there is no
    // recognition beat to sample when the NPC hasn't met the player yet.
    expect(beat.envelope).toBeNull();
  });

  it("elapsedMs=0 collapses the recognition envelope to the opening frame", () => {
    const state = returningIoState();
    const beat = sampleAftersignRememberingNpcRecognitionBeat(state, "io", 0);

    expect(beat.envelope).not.toBeNull();
    expect(beat.envelope?.elapsedMs).toBe(0);
    expect(beat.envelope?.portraitPushInPx).toBe(0);
    expect(beat.envelope?.recognitionRingOpacity).toBe(0);
    expect(beat.envelope?.subtitleOpacity).toBe(0);
    expect(beat.envelope?.lineHoldComplete).toBe(false);
    expect(beat.envelope?.audioCueArmed).toBe(false);
  });
});
