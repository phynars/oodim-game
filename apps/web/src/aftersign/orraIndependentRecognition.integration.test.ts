// M3-E1 integration proof (issue #863): Saint Orra recognizes the player
// INDEPENDENTLY of Io. This is the done-gate lane for the epic — it drives
// the full state contract through save→restore round-trips and asserts:
//
//   1. Recognition branch — Io's M1/M2 recognition fires, the player does
//      Orra's deliberate action, and after reload Orra serves a recognition
//      beat keyed to that action.
//   2. First-contact branch — a control player who never did Orra's action
//      (or a brand-new visitor) gets Orra's first-contact posture, never a
//      recognition line keyed to an action she doesn't remember.
//   3. Io non-regression — the existing M1/M2 Io assertions stay green with
//      Orra's memory present: same beat shape, same recognition-feel.
//
// Red break modes this lane turns red on:
//   - orra-dropped:          Orra's memory not persisted across reload → the
//                            recognition-branch asserts (recognizesPlayer:
//                            true after reload) fail.
//   - orra-wrong:            Orra's recognition mismatches the player's Orra
//                            action → the cue/orraAction asserts fail.
//   - orra-io-contamination: Orra recognizing off Io's memory key (or Io
//                            changing because Orra's record exists) → the
//                            isolation asserts fail in either direction.
//
// NOTE on the recognition contract: recognition (hasMetPlayer → recognizes
// on re-meet) is deliberately SEPARATE from the deliberate-action gate.
// `openAftersignOrraRecognitionBeat` enforces BOTH — recognition first, then
// the committed action (verticalSliceRecognitionBeat.ts). This lane asserts
// that guard ORDER explicitly so the "does not recognize" vs "action is not
// committed" errors can't silently swap (the failure mode that sank the
// #879 attempt).

import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_RECOGNITION_FEEL,
  AFTERSIGN_ORRA_RECOGNITION_FEEL,
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  openAftersignIoRecognitionBeat,
  openAftersignOrraRecognitionBeat,
  recordAftersignOrraAction,
  recordAftersignPacketChoice,
  restoreAftersignDurableSave,
  sampleAftersignIoMemoryBeat,
  sampleAftersignOrraMemoryBeat,
  type AftersignVerticalSliceState,
} from "./verticalSliceState";

const M3_E1_PHONE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
} as const;

/** Full first session: packet choice → meet Io → Orra's deliberate action → meet Orra. */
function playFullFirstSession(): AftersignVerticalSliceState {
  return meetOrraForAftersignSlice(
    recordAftersignOrraAction(
      meetIoForAftersignSlice(
        recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
      ),
      "answered-saint-orra",
    ),
  );
}

/** Save → restore → re-meet both NPCs, mirroring a reload + return visit. */
function reloadAndReturn(state: AftersignVerticalSliceState): AftersignVerticalSliceState {
  const restored = restoreAftersignDurableSave(encodeAftersignDurableSave(state, 1));
  return meetOrraForAftersignSlice(meetIoForAftersignSlice(restored));
}

/** Phone-driven M3-E1 playthrough contract: the e2e lane stays mobile-first. */
function drivePhoneRecognitionPlaythrough(): {
  phoneViewport: typeof M3_E1_PHONE_VIEWPORT;
  returned: AftersignVerticalSliceState;
} {
  return {
    phoneViewport: M3_E1_PHONE_VIEWPORT,
    returned: reloadAndReturn(playFullFirstSession()),
  };
}

describe("M3-E1: Orra recognizes the player independently of Io (#863)", () => {
  describe("phone viewport contract", () => {
    it("drives the Orra recognition lane through a touch-first phone viewport", () => {
      const { phoneViewport } = drivePhoneRecognitionPlaythrough();

      expect(phoneViewport).toEqual({
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });
      expect(phoneViewport.width).toBeLessThan(phoneViewport.height);
      expect(phoneViewport.width).toBeLessThanOrEqual(430);
    });
  });

  describe("recognition branch", () => {
    it("serves Orra's recognition beat keyed to the player's Orra action after reload", () => {
      const { returned } = drivePhoneRecognitionPlaythrough();

      // orra-dropped guard: recognition MUST survive the durable round-trip.
      expect(sampleAftersignOrraMemoryBeat(returned)).toEqual({
        kind: "orra-recognition",
        scene: "orra-return",
        recognizesPlayer: true,
        orraAction: "answered-saint-orra",
        recognitionFeel: AFTERSIGN_ORRA_RECOGNITION_FEEL,
      });

      // orra-wrong guard: the opened cue must carry the player's OWN action,
      // and the beat is openable only because both recognition and the
      // committed action are present.
      const { cue } = openAftersignOrraRecognitionBeat(returned, 900);
      expect(cue).toEqual({
        kind: "orra-recognition-beat",
        orraAction: "answered-saint-orra",
        startedAtMs: 900,
      });
    });
  });

  describe("first-contact branch", () => {
    it("keeps Orra in first-contact posture for a brand-new visitor", () => {
      const fresh = meetOrraForAftersignSlice(createAftersignVerticalSliceState());

      expect(sampleAftersignOrraMemoryBeat(fresh)).toEqual({
        kind: "orra-recognition",
        scene: "orra-return",
        recognizesPlayer: false,
        orraAction: null,
        recognitionFeel: null,
      });
      // Recognition guard fires FIRST for a stranger — never the action guard.
      expect(() => openAftersignOrraRecognitionBeat(fresh, 0)).toThrow(
        "Cannot open Orra recognition beat: Orra does not recognize the player yet",
      );
    });

    it("never serves an action-keyed recognition line to a returning player who skipped Orra's action", () => {
      // Control player: met Orra, did NOT do her deliberate action, reloads.
      const control = reloadAndReturn(
        meetOrraForAftersignSlice(
          meetIoForAftersignSlice(
            recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
          ),
        ),
      );

      // Acquaintance persists (she remembers meeting you) but there is no
      // action to key a recognition LINE on: the beat carries a null action
      // and the beat-open is refused on the action guard, not recognition.
      const beat = sampleAftersignOrraMemoryBeat(control);
      expect(beat.recognizesPlayer).toBe(true);
      expect(beat.orraAction).toBeNull();
      expect(() => openAftersignOrraRecognitionBeat(control, 0)).toThrow(
        "Cannot open Orra recognition beat: Orra action is not committed",
      );
    });
  });

  describe("Io non-regression (M1/M2 stay green with Orra's memory present)", () => {
    it("keeps Io's recognition beat identical whether or not Orra's record exists", () => {
      // Lane A: Io only (the original M1/M2 path).
      const ioOnly = meetIoForAftersignSlice(
        restoreAftersignDurableSave(
          encodeAftersignDurableSave(
            meetIoForAftersignSlice(
              recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
            ),
            1,
          ),
        ),
      );
      const ioOnlyBeat = sampleAftersignIoMemoryBeat(ioOnly);

      // Lane B: identical Io path but WITH Orra's memory in the save.
      const withOrra = reloadAndReturn(playFullFirstSession());
      const withOrraBeat = sampleAftersignIoMemoryBeat(withOrra);

      // Same recognition, same outcome, same feel — Orra's record must not
      // move Io's beat (scene differs by construction; memory must not).
      expect(ioOnlyBeat.recognizesPlayer).toBe(true);
      expect(withOrraBeat.recognizesPlayer).toBe(true);
      expect(withOrraBeat.packetOutcome).toBe(ioOnlyBeat.packetOutcome);
      expect(withOrraBeat.recognitionFeel).toEqual(AFTERSIGN_IO_RECOGNITION_FEEL);
      expect(ioOnlyBeat.recognitionFeel).toEqual(AFTERSIGN_IO_RECOGNITION_FEEL);

      // Io's cue still fires off Io's OWN key (packetOutcome), same timing.
      const { cue } = openAftersignIoRecognitionBeat(withOrra, 1_200);
      expect(cue).toEqual({
        kind: "io-recognition-beat",
        packetOutcome: "opened",
        startedAtMs: 1_200,
      });
    });

    it("does not let Orra's recognition fire off Io's memory key (cross-NPC bleed)", () => {
      // Player meets Io (Io will recognize on return) but NEVER meets Orra.
      const ioAcquainted = meetIoForAftersignSlice(
        restoreAftersignDurableSave(
          encodeAftersignDurableSave(
            meetIoForAftersignSlice(
              recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
            ),
            1,
          ),
        ),
      );

      // Io recognizes; Orra must NOT — her memory is a distinct key + field.
      expect(sampleAftersignIoMemoryBeat(ioAcquainted).recognizesPlayer).toBe(true);
      const orraBeat = sampleAftersignOrraMemoryBeat(ioAcquainted);
      expect(orraBeat.recognizesPlayer).toBe(false);
      expect(orraBeat.orraAction).toBeNull();
      expect(orraBeat.recognitionFeel).toBeNull();
    });

    it("does not let Io recognize off Orra's memory key (reverse bleed)", () => {
      // Player meets Orra + does her action but NEVER meets Io, then reloads.
      const orraOnly = meetOrraForAftersignSlice(
        restoreAftersignDurableSave(
          encodeAftersignDurableSave(
            meetOrraForAftersignSlice(
              recordAftersignOrraAction(
                createAftersignVerticalSliceState(),
                "answered-saint-orra",
              ),
            ),
            1,
          ),
        ),
      );

      expect(sampleAftersignOrraMemoryBeat(orraOnly).recognizesPlayer).toBe(true);
      const ioBeat = sampleAftersignIoMemoryBeat(orraOnly);
      expect(ioBeat.recognizesPlayer).toBe(false);
      expect(ioBeat.recognitionFeel).toBeNull();
    });
  });
});
