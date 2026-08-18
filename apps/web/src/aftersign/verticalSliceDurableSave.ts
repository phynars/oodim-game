import type {
  AftersignOrraAction,
  AftersignPacketOutcome,
  AftersignRememberedTone,
  AftersignVerticalSliceState,
} from "./verticalSliceRuntimeState";

export type AftersignVerticalSliceSave = {
  version: 1;
  packetOutcome: AftersignPacketOutcome | null;
  ioHasMetPlayer: boolean;
  orraAction?: AftersignOrraAction | null;
  orraHasMetPlayer?: boolean;
  /**
   * M-CONTINUE-E2: the returning player has committed a return-tone
   * choice. Persisted so a fresh boot restore lands back on
   * `return-tone-choice` (or later) instead of replaying the choice.
   * Optional so pre-E2 saves round-trip unchanged.
   */
  hasChosenReturnTone?: boolean;
  /**
   * M-CONTINUE-E2: the exact posture the player struck. Optional so
   * pre-E2 saves round-trip unchanged; readers treat `undefined` and
   * a missing `hasChosenReturnTone` identically.
   *
   * NOTE — `hasAskedForNextJob` is deliberately NOT persisted. The
   * next-job request is an in-session beat advance; on restore the
   * player re-asks Io, but the TONE they struck sticks.
   */
  rememberedTone?: AftersignRememberedTone;
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
    ...(state.orraHasMetPlayer || state.orraAction
      ? {
          orraHasMetPlayer: state.orraHasMetPlayer,
          orraAction: state.orraAction,
        }
      : {}),
    // M-CONTINUE-E2: only stamp the tone axes when the player has
    // actually committed a choice — pre-E2 saves stay byte-identical.
    ...(state.hasChosenReturnTone
      ? {
          hasChosenReturnTone: true,
          ...(state.rememberedTone
            ? { rememberedTone: state.rememberedTone }
            : {}),
        }
      : {}),
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
    orraAction: save.orraAction ?? null,
    orraHasMetPlayer: save.orraHasMetPlayer ?? false,
    orraRecognizesPlayer: false,
    // M-CONTINUE-E2: rehydrate the durable tone axes. `hasAskedForNextJob`
    // is intentionally omitted (see save-shape comment) — restore lands
    // the player back at `return-tone-choice`, remembering their posture
    // but re-prompting the next-job request.
    hasChosenReturnTone: save.hasChosenReturnTone === true,
    rememberedTone: save.rememberedTone,
  };
}

export function restoreAftersignDurableSave(payload: string): AftersignVerticalSliceState {
  const envelope = decodeAftersignDurableSave(payload);
  const { savedAtTurn } = envelope;
  if (!isValidSavedAtTurn(savedAtTurn)) {
    throw new Error("Invalid Aftersign durable save: savedAtTurn must be a safe integer");
  }
  return {
    ...restoreAftersignVerticalSliceState(envelope.state),
    savedAtTurn,
  };
}

function assertValidSavedAtTurn(savedAtTurn: number): void {
  if (!isValidSavedAtTurn(savedAtTurn)) {
    throw new Error("Invalid Aftersign durable save: savedAtTurn must be a safe integer");
  }
}

function isValidSavedAtTurn(savedAtTurn: unknown): savedAtTurn is number {
  return typeof savedAtTurn === "number" && Number.isSafeInteger(savedAtTurn) && savedAtTurn >= 0;
}

function isVerticalSliceSave(save: unknown): save is AftersignVerticalSliceSave {
  if (!isRecord(save)) {
    return false;
  }

  return (
    save.version === 1 &&
    isPacketOutcomeOrNull(save.packetOutcome) &&
    typeof save.ioHasMetPlayer === "boolean" &&
    (save.orraAction === undefined || isOrraActionOrNull(save.orraAction)) &&
    (save.orraHasMetPlayer === undefined || typeof save.orraHasMetPlayer === "boolean") &&
    (save.hasChosenReturnTone === undefined ||
      typeof save.hasChosenReturnTone === "boolean") &&
    (save.rememberedTone === undefined || isRememberedTone(save.rememberedTone))
  );
}

function isRememberedTone(value: unknown): value is AftersignRememberedTone {
  return value === "kind" || value === "evasive" || value === "blunt";
}

function isPacketOutcomeOrNull(
  packetOutcome: unknown,
): packetOutcome is AftersignPacketOutcome | null {
  return packetOutcome === null || packetOutcome === "sealed" || packetOutcome === "opened";
}

function isOrraActionOrNull(orraAction: unknown): orraAction is AftersignOrraAction | null {
  return orraAction === null || orraAction === "answered-saint-orra";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
