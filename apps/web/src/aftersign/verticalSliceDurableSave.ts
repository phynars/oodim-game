import type {
  AftersignPacketOutcome,
  AftersignVerticalSliceState,
} from "./verticalSliceRuntimeState";

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

const DURABLE_SAVE_KEY: AftersignDurableSaveEnvelope["key"] =
  "aftersign.verticalSlice.v1";

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
