// AFTERSIGN vertical-slice story/state contract.
//
// Pure runtime state for the first playable slice: the player receives Vey's
// packet, chooses whether to keep it sealed or open it, meets Io, and can come
// back later with Io recognizing the remembered outcome. Keep this file free of
// rendering, storage, and network concerns so the harness can assert the public
// game contract before the scene implementation exists.
//
// FEEL NUMBERS: the recognition-beat feel exposed here is NOT reinvented —
// it re-exports the single frozen contract `IO_RETURNING_RECOGNITION_FEEL`
// from `aftersign/src/ioReturningRecognitionFeel.ts`, which itself derives
// its numbers from the live `recognitionFeedback.ts` constants. See PR #629
// review + PR #712 review — every prior draft that hardcoded feel numbers
// here drifted from the live implementation. Do not add fields with literal
// numeric types to this module; consume the frozen contract instead.

import {
  IO_RETURNING_RECOGNITION_FEEL,
  type IoReturningRecognitionFeel,
} from "../../../../aftersign/src/ioReturningRecognitionFeel";

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

export type AftersignPacketChoiceConfirmFeel = {
  durationMs: 180;
  screenShakePx: 2;
  packetLiftPx: 10;
  packetSettlePx: 3;
  glowPeakOpacity: 0.42;
  audioStartMs: 24;
  easing: "cubic-bezier(.2,.8,.2,1)";
};

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
 * Tiny confirmation pop for the vertical-slice packet choice. This is the
 * player's first authored action, so the kiosk should answer with a tactile
 * lift-settle instead of a silent state flip.
 */
export const AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL: AftersignPacketChoiceConfirmFeel = {
  durationMs: 180,
  screenShakePx: 2,
  packetLiftPx: 10,
  packetSettlePx: 3,
  glowPeakOpacity: 0.42,
  audioStartMs: 24,
  easing: "cubic-bezier(.2,.8,.2,1)",
};

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
