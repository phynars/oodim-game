// AFTERSIGN vertical-slice story/state contract.
//
// Pure runtime state for the first playable slice: the player receives Vey's
// packet, chooses whether to keep it sealed or open it, meets Io, and can come
// back later with Io recognizing the remembered outcome. Keep this file free of
// rendering, storage, and network concerns so the harness can assert the public
// game contract before the scene implementation exists.
//
// FEEL NUMBERS: the feel contracts exposed here are NOT reinvented —
// they re-export the live single-source constants:
//   • `AFTERSIGN_IO_RECOGNITION_FEEL` ← `IO_RETURNING_RECOGNITION_FEEL`
//     (`aftersign/src/ioReturningRecognitionFeel.ts`, itself derived
//     from the live `recognitionFeedback.ts` constants).
//   • `AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL` ← `DELIVER_PACKET_CONFIRM_FEEL`
//     (`packages/aftersign/src/interactionConfirm.ts`, the live confirm cue).
// See PR #629 / #712 / #728 review — every prior draft that hardcoded feel
// numbers here drifted from the live implementation. Do not add fields with
// literal numeric types to this module; consume the live contract instead.

import {
  IO_RETURNING_RECOGNITION_FEEL,
  type IoReturningRecognitionFeel,
} from "../../../../aftersign/src/ioReturningRecognitionFeel";
import {
  DELIVER_PACKET_CONFIRM_FEEL,
} from "../../../../packages/aftersign/src/interactionConfirm";
import {
  createIoRecognitionBeatState,
  playIoRecognitionBeat,
  type IoRecognitionBeatCue,
  type IoRecognitionBeatState,
} from "../../../../packages/aftersign/src/ioRecognitionBeat";
import {
  sampleRecognitionFeedbackBeat,
  type RecognitionFeedbackSample,
} from "./recognitionFeedback";

export type AftersignPacketOutcome = "sealed" | "opened";

export type AftersignSceneId = "kiosk" | "io-return";

export type AftersignVerticalSliceState = {
  scene: AftersignSceneId;
  packetOutcome: AftersignPacketOutcome | null;
  ioHasMetPlayer: boolean;
  ioRecognizesPlayer: boolean;
};

export type AftersignVerticalSliceSave = {
  version: 1;
  packetOutcome: AftersignPacketOutcome | null;
  ioHasMetPlayer: boolean;
};

export type AftersignDurableSaveEnvelope = {
  key: "aftersign.verticalSlice.v1";
  savedAtTurn: number;
  state: AftersignVerticalSliceSave;
};

/**
 * Type alias for the frozen recognition-feel contract. Kept as an alias
 * (not a redefinition) so this module cannot drift from the live source.
 */
export type AftersignIoRecognitionFeel = IoReturningRecognitionFeel;

/**
 * Type alias for the live packet-confirm feel. Kept as an alias (not a
 * redefinition) so this module cannot drift from the live source in
 * `packages/aftersign/src/interactionConfirm.ts`. Same discipline as
 * `AftersignIoRecognitionFeel` above.
 */
export type AftersignPacketChoiceConfirmFeel = typeof DELIVER_PACKET_CONFIRM_FEEL;

export type AftersignIoMemoryBeat = {
  scene: AftersignSceneId;
  recognizesPlayer: boolean;
  packetOutcome: AftersignPacketOutcome | null;
  recognitionFeel: AftersignIoRecognitionFeel | null;
};

const DURABLE_SAVE_KEY: AftersignDurableSaveEnvelope["key"] =
  "aftersign.verticalSlice.v1";

/**
 * Re-export of the frozen live contract. Consumers reading this constant
 * observe exactly the numbers `recognitionFeedback.ts` uses at runtime —
 * `RECOGNITION_FEEDBACK_TOTAL_MS`, `_CAMERA_YAW_DEGREES`, `_STING_START_MS`, etc.
 */
export const AFTERSIGN_IO_RECOGNITION_FEEL: AftersignIoRecognitionFeel =
  IO_RETURNING_RECOGNITION_FEEL;

/**
 * Re-export of the live packet-confirm feel. Consumers reading this
 * constant observe exactly the numbers `packages/aftersign/src/interactionConfirm.ts`
 * uses at runtime (`DELIVER_PACKET_CONFIRM_FEEL`: `pulseMs`, `phoneLiftPx`,
 * `shakePx`, `ringScaleFrom/To`, `ringEase`, `audioLeadMs`, `maxDriftMs`).
 * No numbers are fabricated here — this is the tactile lift-settle answer
 * to the player's first authored action, sourced from the one place that
 * owns it.
 */
export const AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL: AftersignPacketChoiceConfirmFeel =
  DELIVER_PACKET_CONFIRM_FEEL;

export function createAftersignVerticalSliceState(): AftersignVerticalSliceState {
  return {
    scene: "kiosk",
    packetOutcome: null,
    ioHasMetPlayer: false,
    ioRecognizesPlayer: false,
  };
}

export function recordAftersignPacketChoice(
  state: AftersignVerticalSliceState,
  packetOutcome: AftersignPacketOutcome,
): AftersignVerticalSliceState {
  return {
    ...state,
    packetOutcome,
  };
}

export function meetIoForAftersignSlice(
  state: AftersignVerticalSliceState,
): AftersignVerticalSliceState {
  return {
    ...state,
    scene: "io-return",
    ioHasMetPlayer: true,
    ioRecognizesPlayer: state.ioHasMetPlayer,
  };
}

export function createAftersignVerticalSliceSave(
  state: AftersignVerticalSliceState,
): AftersignVerticalSliceSave {
  return {
    version: 1,
    packetOutcome: state.packetOutcome,
    ioHasMetPlayer: state.ioHasMetPlayer,
  };
}

export function encodeAftersignDurableSave(
  state: AftersignVerticalSliceState,
  savedAtTurn: number,
): string {
  assertValidSavedAtTurn(savedAtTurn);

  return JSON.stringify({
    key: DURABLE_SAVE_KEY,
    savedAtTurn,
    state: createAftersignVerticalSliceSave(state),
  } satisfies AftersignDurableSaveEnvelope);
}

export function decodeAftersignDurableSave(
  payload: string,
): AftersignDurableSaveEnvelope {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("Invalid Aftersign durable save: payload is not JSON");
  }

  if (!isRecord(parsed)) {
    throw new Error("Invalid Aftersign durable save: payload is not an object");
  }

  if (parsed.key !== DURABLE_SAVE_KEY) {
    throw new Error("Invalid Aftersign durable save: unsupported key");
  }

  if (!isValidSavedAtTurn(parsed.savedAtTurn)) {
    throw new Error("Invalid Aftersign durable save: savedAtTurn must be a safe integer");
  }

  if (!isVerticalSliceSave(parsed.state)) {
    throw new Error("Invalid Aftersign durable save: state is malformed");
  }

  return {
    key: DURABLE_SAVE_KEY,
    savedAtTurn: parsed.savedAtTurn,
    state: parsed.state,
  };
}

export function restoreAftersignVerticalSliceState(
  save: AftersignVerticalSliceSave,
): AftersignVerticalSliceState {
  return {
    scene: "kiosk",
    packetOutcome: save.packetOutcome,
    ioHasMetPlayer: save.ioHasMetPlayer,
    ioRecognizesPlayer: false,
  };
}

export function restoreAftersignDurableSave(payload: string): AftersignVerticalSliceState {
  return restoreAftersignVerticalSliceState(decodeAftersignDurableSave(payload).state);
}

export function sampleAftersignIoMemoryBeat(
  state: AftersignVerticalSliceState,
): AftersignIoMemoryBeat {
  return {
    scene: state.scene,
    recognizesPlayer: state.ioRecognizesPlayer,
    packetOutcome: state.packetOutcome,
    recognitionFeel: state.ioRecognizesPlayer ? AFTERSIGN_IO_RECOGNITION_FEEL : null,
  };
}

// ---------------------------------------------------------------------------
// Recognition-beat producer + renderer sampler wiring.
//
// `sampleAftersignIoMemoryBeat` above tells the harness *whether* the beat
// should play (`recognitionFeel !== null`). What follows wires the actual
// beat lifecycle:
//
//   producer: `openAftersignIoRecognitionBeat` — story-side code (the scene
//     controller) calls this the moment Io recognizes the player. It stamps
//     an `IoRecognitionBeatCue` on a small piece of story state
//     (`IoRecognitionBeatState`) so any renderer/harness watching that state
//     can react in the same frame.
//
//   renderer: `sampleAftersignIoRecognitionEnvelope` — the renderer/PW test
//     reads the cue and delegates to `sampleRecognitionFeedbackBeat` (the
//     live feel numbers) to get the per-ms envelope for camera/glow/sting.
//     This is the wire-up the reviewer asked for on PR #751: the cue module
//     is now both PUBLISHED to (producer) and READ from (renderer).
// ---------------------------------------------------------------------------

export type AftersignIoRecognitionBeatOpen = {
  readonly cueState: IoRecognitionBeatState;
  readonly cue: IoRecognitionBeatCue;
};

/**
 * Producer: stamp Io's recognition-beat cue when the slice enters the
 * moment where Io remembers the player's packet choice.
 *
 * Requires `state.ioRecognizesPlayer === true` and a committed
 * `state.packetOutcome`; otherwise there is no beat to open and calling
 * this is a programming error.
 */
export function openAftersignIoRecognitionBeat(
  state: AftersignVerticalSliceState,
  startedAtMs: number,
): AftersignIoRecognitionBeatOpen {
  if (!state.ioRecognizesPlayer) {
    throw new Error(
      "Cannot open Io recognition beat: Io does not recognize the player yet",
    );
  }
  if (state.packetOutcome !== "sealed" && state.packetOutcome !== "opened") {
    throw new Error(
      "Cannot open Io recognition beat: packetOutcome is not committed",
    );
  }
  if (!Number.isFinite(startedAtMs) || startedAtMs < 0) {
    throw new Error(
      "Cannot open Io recognition beat: startedAtMs must be a non-negative finite number",
    );
  }

  const cueState = createIoRecognitionBeatState();
  const cue = playIoRecognitionBeat(cueState, state.packetOutcome, startedAtMs);
  return { cueState, cue };
}

/**
 * Renderer: sample the recognition envelope from an open cue.
 *
 * The renderer holds the `IoRecognitionBeatCue` published by the producer
 * and calls this every frame with the current clock (`nowMs`). Timing and
 * feel numbers come from the live `recognitionFeedbackContract` /
 * `sampleRecognitionFeedbackBeat` — this function only converts
 * `nowMs - cue.startedAtMs` into the elapsed sample so the cue is what
 * anchors the envelope in time.
 */
export function sampleAftersignIoRecognitionEnvelope(
  cue: IoRecognitionBeatCue,
  nowMs: number,
  options: { reducedMotion?: boolean; lineId?: string } = {},
): RecognitionFeedbackSample {
  if (!Number.isFinite(nowMs)) {
    throw new Error("sampleAftersignIoRecognitionEnvelope: nowMs must be finite");
  }

  const elapsedMs = Math.max(0, nowMs - cue.startedAtMs);
  return sampleRecognitionFeedbackBeat(elapsedMs, {
    outcome: cue.packetOutcome,
    startedAt: cue.startedAtMs,
    reducedMotion: options.reducedMotion,
    lineId: options.lineId,
  });
}

function assertValidSavedAtTurn(savedAtTurn: number): void {
  if (!isValidSavedAtTurn(savedAtTurn)) {
    throw new Error("Invalid Aftersign durable save: savedAtTurn must be a safe integer");
  }
}

function isValidSavedAtTurn(savedAtTurn: unknown): savedAtTurn is number {
  return Number.isSafeInteger(savedAtTurn) && savedAtTurn >= 0;
}

function isVerticalSliceSave(save: unknown): save is AftersignVerticalSliceSave {
  if (!isRecord(save)) {
    return false;
  }

  return (
    save.version === 1 &&
    isPacketOutcomeOrNull(save.packetOutcome) &&
    typeof save.ioHasMetPlayer === "boolean"
  );
}

function isPacketOutcomeOrNull(
  packetOutcome: unknown,
): packetOutcome is AftersignPacketOutcome | null {
  return packetOutcome === null || packetOutcome === "sealed" || packetOutcome === "opened";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
