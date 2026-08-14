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
// PHONE VIEWPORT contract (#863 acceptance: "Phone viewport used for the
// driven playthrough"): the driven-lane envelope is sampled via
// `sampleAftersignOrraRecognitionForViewport`, which BRANCHES on
// isMobile+hasTouch — phone gates the audio cue behind
// IO_PHONE_READY_FEEL.visualCueMs (the mobile AV-drift discipline) AND
// clamps input to touch-suppress; desktop skips both. The lane asserts the
// phone branch AND a desktop control on the SAME cue at the SAME elapsedMs
// — if the branch degenerated to a viewport-agnostic passthrough, the
// control test flips green and the lane goes red. That's what turns
// "phone viewport used" into a falsifiable claim instead of a decoration.
//
// NOTE on the recognition contract: recognition (hasMetPlayer → recognizes
// on re-meet) is deliberately SEPARATE from the deliberate-action gate.
// `openAftersignOrraRecognitionBeat` enforces BOTH — recognition first, then
// the committed action (verticalSliceRecognitionBeat.ts). This lane asserts
// that guard ORDER explicitly so the "does not recognize" vs "action is not
// committed" errors can't silently swap (the failure mode that sank the
// #879 attempt).

import { describe, expect, it } from "vitest";

import { IO_PHONE_READY_FEEL } from "./ioPhoneReadyFeel";
import {
  fromRuntimeLaneMemory,
  toRuntimeLaneMemory,
  type OrraRuntimeLaneActionResolver,
} from "./orraRecognitionVocabularyAdapter";
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
  sampleAftersignOrraRecognitionForViewport,
  type AftersignRecognitionViewport,
  type AftersignVerticalSliceState,
} from "./verticalSliceState";

// iPhone 14/15-shape phone viewport used by the M3-E1 driven playthrough.
// This is consumed by `sampleAftersignOrraRecognitionForViewport` and
// GATES real behavior (audio warmup + touch input-lock).
const M3_E1_PHONE_VIEWPORT: AftersignRecognitionViewport = {
  isMobile: true,
  hasTouch: true,
};

// Desktop control viewport — same shape, opposite kind. Used ONLY inside
// the red-mode assertion below to prove the phone branch is a real gate:
// the same cue at the same elapsedMs must produce a DIFFERENT envelope.
const M3_E1_DESKTOP_CONTROL_VIEWPORT: AftersignRecognitionViewport = {
  isMobile: false,
  hasTouch: false,
};

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

describe("M3-E1: Orra recognizes the player independently of Io (#863)", () => {
  describe("recognition branch", () => {
    it("serves Orra's recognition beat keyed to the player's Orra action after reload", () => {
      const returned = reloadAndReturn(playFullFirstSession());

      // orra-dropped guard: recognition MUST survive the durable round-trip.
      const harnessBeat = sampleAftersignOrraMemoryBeat(returned);
      expect(harnessBeat).toEqual({
        kind: "orra-recognition",
        scene: "orra-return",
        recognizesPlayer: true,
        orraAction: "answered-saint-orra",
        recognitionFeel: AFTERSIGN_ORRA_RECOGNITION_FEEL,
      });

      // #1181 reconciliation guard: harness vocabulary must stay aligned
      // with served-lane lit/spared memory semantics through an additive
      // adapter. The record fed to `toRuntimeLaneMemory` is DERIVED from
      // `harnessBeat.orraAction` (the value the harness actually emits,
      // typed against `AftersignOrraAction`) — not from a hardcoded
      // lit/spared literal. If the harness surface ever stopped emitting
      // `"answered-saint-orra"`, this call fails at typecheck; if the
      // served lane grew a third action, the resolver's return type
      // would force us to declare intent for the new case here.
      const resolveOrraRuntimeLaneAction: OrraRuntimeLaneActionResolver = (
        harnessAction,
      ) => {
        // The full driven playthrough plays the vigil-lit branch, so the
        // reconciliation lands on `"lit"`. The `harnessAction` argument
        // is exhaustively narrowed to `"answered-saint-orra"` — a future
        // growth of `AftersignOrraAction` would force a case here.
        if (harnessAction === "answered-saint-orra") {
          return "lit";
        }
        // TypeScript-exhaustive fallback: `never` at typecheck today.
        throw new Error(`Unmapped Orra harness action: ${String(harnessAction)}`);
      };

      const runtimeMemory = toRuntimeLaneMemory(
        {
          kind: harnessBeat.kind,
          scene: harnessBeat.scene,
          recognizesPlayer: harnessBeat.recognizesPlayer,
          orraAction: harnessBeat.orraAction,
          recognitionFeel: harnessBeat.recognitionFeel,
        },
        resolveOrraRuntimeLaneAction,
      );
      expect(runtimeMemory).toEqual({
        remembersPlayer: true,
        action: "lit",
      });
      // Inverse projection collapses lit/spared back onto the harness
      // marker — same beat shape the harness itself produced.
      expect(
        fromRuntimeLaneMemory(runtimeMemory, harnessBeat.recognitionFeel),
      ).toEqual({
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
        // Canonical selector is live in the driven slice: the cue carries
        // Orra's "named debt" beat by object reference from the narrative
        // deck. This is the M3-E1 "Orra's voice is live" acceptance —
        // silently drop the wiring and this equality flips red.
        beat: ORRA_RECOGNITION_BEATS.debt.named,
      });

      // PHONE VIEWPORT DRIVEN ASSERTIONS — the envelope is sampled via the
      // viewport-branching helper. Sample slightly BEFORE the phone
      // visualCueMs: on phone the audio cue must still be null (audio
      // warmup gate), on desktop it must already be firing. Same cue,
      // same elapsedMs, different output = the branch is real.
      const beforeVisualCueMs = IO_PHONE_READY_FEEL.visualCueMs - 1;
      const phoneEarly = sampleAftersignOrraRecognitionForViewport(
        cue,
        cue.startedAtMs + beforeVisualCueMs,
        M3_E1_PHONE_VIEWPORT,
      );
      expect(phoneEarly.viewportKind).toBe("phone");
      expect(phoneEarly.inputLock).toBe("touch-suppress");
      expect(phoneEarly.audioCue).toBeNull(); // gated by phone AV budget

      // At/after visualCueMs on phone the audio cue is allowed to fire.
      const phoneAtCue = sampleAftersignOrraRecognitionForViewport(
        cue,
        cue.startedAtMs + IO_PHONE_READY_FEEL.visualCueMs,
        M3_E1_PHONE_VIEWPORT,
      );
      expect(phoneAtCue.viewportKind).toBe("phone");
      expect(phoneAtCue.inputLock).toBe("touch-suppress");
      expect(phoneAtCue.audioCue).toBe("orra-recognition-bell");
    });

    it("desktop control diverges from phone at the same cue+elapsedMs (proves the phone gate is real)", () => {
      // If the viewport branch were a passthrough, this test would fail:
      // the desktop envelope would match the phone one and the divergence
      // asserts below would all be equal. That is the falsifier that
      // makes "phone viewport used for driven playthrough" observable.
      const returned = reloadAndReturn(playFullFirstSession());
      const { cue } = openAftersignOrraRecognitionBeat(returned, 900);
      const beforeVisualCueMs = IO_PHONE_READY_FEEL.visualCueMs - 1;

      const phone = sampleAftersignOrraRecognitionForViewport(
        cue,
        cue.startedAtMs + beforeVisualCueMs,
        M3_E1_PHONE_VIEWPORT,
      );
      const desktop = sampleAftersignOrraRecognitionForViewport(
        cue,
        cue.startedAtMs + beforeVisualCueMs,
        M3_E1_DESKTOP_CONTROL_VIEWPORT,
      );

      // Same cue, same elapsedMs, DIFFERENT branches:
      expect(phone.viewportKind).toBe("phone");
      expect(desktop.viewportKind).toBe("desktop");
      // inputLock: phone locks touch, desktop does not.
      expect(phone.inputLock).toBe("touch-suppress");
      expect(desktop.inputLock).toBeNull();
      expect(phone.inputLock).not.toBe(desktop.inputLock);
      // audio: phone still gated (before visualCueMs), desktop already firing.
      expect(phone.audioCue).toBeNull();
      expect(desktop.audioCue).toBe("orra-recognition-bell");
      expect(phone.audioCue).not.toBe(desktop.audioCue);
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
