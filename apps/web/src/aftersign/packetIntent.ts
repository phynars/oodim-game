export type AftersignPacketIntent = "inspect" | "opening" | "opened";

export type AftersignPacketGestureEvent =
  | { type: "press"; nowMs: number }
  | { type: "move"; nowMs: number; stillWithinIntentRadius: boolean }
  | { type: "release"; nowMs: number }
  | { type: "cancel"; nowMs: number }
  | { type: "tick"; nowMs: number; hasFocus: boolean };

export interface AftersignPacketIntentState {
  intent: AftersignPacketIntent;
  holdStartedAtMs: number | null;
  heldForMs: number;
  openedAtMs: number | null;
}

export const AFTERSIGN_PACKET_OPEN_HOLD_MS = 420;

export function createAftersignPacketIntentState(): AftersignPacketIntentState {
  return {
    intent: "inspect",
    holdStartedAtMs: null,
    heldForMs: 0,
    openedAtMs: null,
  };
}

export function reduceAftersignPacketIntent(
  state: AftersignPacketIntentState,
  event: AftersignPacketGestureEvent,
): AftersignPacketIntentState {
  if (state.intent === "opened") {
    return state;
  }

  switch (event.type) {
    case "press":
      return {
        intent: "opening",
        holdStartedAtMs: event.nowMs,
        heldForMs: 0,
        openedAtMs: null,
      };

    case "move":
      if (!event.stillWithinIntentRadius) {
        return createAftersignPacketIntentState();
      }
      return advanceAftersignPacketHold(state, event.nowMs, true);

    case "tick":
      return advanceAftersignPacketHold(state, event.nowMs, event.hasFocus);

    case "release":
    case "cancel":
      return createAftersignPacketIntentState();
  }
}

function advanceAftersignPacketHold(
  state: AftersignPacketIntentState,
  nowMs: number,
  canOpen: boolean,
): AftersignPacketIntentState {
  if (state.intent !== "opening" || state.holdStartedAtMs === null) {
    return state;
  }

  const heldForMs = Math.max(0, nowMs - state.holdStartedAtMs);
  if (!canOpen || heldForMs < AFTERSIGN_PACKET_OPEN_HOLD_MS) {
    return {
      ...state,
      heldForMs,
    };
  }

  return {
    intent: "opened",
    holdStartedAtMs: state.holdStartedAtMs,
    heldForMs,
    openedAtMs: nowMs,
  };
}
