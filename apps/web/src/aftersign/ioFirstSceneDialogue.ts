import type {
  AftersignPacketOutcome,
  AftersignVerticalSliceState,
} from "./verticalSliceRuntimeState";

/**
 * Io's first-scene voice for the Aftersign vertical slice.
 *
 * Two beats, one module:
 *   - The kiosk beat (arrival / route / packetOffer): Io setting the fork
 *     before the player commits to `packetOutcome`.
 *   - The return beat (io-return): what Io says when the player comes
 *     back, keyed off `AftersignVerticalSliceState` — the same runtime
 *     shape the durable-save contract and Orra alignment tests use.
 *
 * Contract seams we honor here (do not drift):
 *   - `AftersignPacketOutcome` from `./verticalSliceRuntimeState` is the
 *     single 'sealed' | 'opened' alias. This module MUST NOT redefine it.
 *   - Recognition memory keys `io_return_packet_sealed` and
 *     `io_return_packet_opened` are the identifiers the recognition-feel
 *     layer expects for the packet outcome memory. Route memory keys are
 *     `listened_to_route` / `skipped_route`.
 */

export type AftersignIoFirstScenePrompt =
  | "arrival"
  | "route"
  | "packetOffer"
  | "sealedReturn"
  | "openedReturn"
  | "listenedReturn"
  | "skippedReturn";

export type AftersignIoLineIntent =
  | "anchor"
  | "route"
  | "choice"
  | "returnPacket"
  | "returnRoute";

export type AftersignIoMemoryKey =
  | "io_return_packet_sealed"
  | "io_return_packet_opened"
  | "listened_to_route"
  | "skipped_route";

export type AftersignIoFirstSceneLine = Readonly<{
  id: AftersignIoFirstScenePrompt;
  text: string;
  intent: AftersignIoLineIntent;
  memoryKey?: AftersignIoMemoryKey;
}>;

export const AFTERSIGN_IO_FIRST_SCENE_DIALOGUE = [
  {
    id: "arrival",
    intent: "anchor",
    text: "You made the stairs after dark. Good. Vey still owes you a name.",
  },
  {
    id: "route",
    intent: "route",
    text: "Blue lantern, brass gutter, moth-burned sign box. Miss one and the stair forgets you.",
  },
  {
    id: "packetOffer",
    intent: "choice",
    text: "Carry it sealed. Not safe. Sealed. Different words, different jobs.",
  },
  {
    id: "sealedReturn",
    intent: "returnPacket",
    text: "You came back. So did the blue seal, unbroken. Two facts I can trust.",
    memoryKey: "io_return_packet_sealed",
  },
  {
    id: "openedReturn",
    intent: "returnPacket",
    text: "You came back. The seal did not. I can use one of those facts.",
    memoryKey: "io_return_packet_opened",
  },
  {
    id: "listenedReturn",
    intent: "returnRoute",
    text: "You listened before you ran. Rare habit. Keep it.",
    memoryKey: "listened_to_route",
  },
  {
    id: "skippedReturn",
    intent: "returnRoute",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    memoryKey: "skipped_route",
  },
] as const satisfies readonly AftersignIoFirstSceneLine[];

export function getAftersignIoFirstSceneLine(
  id: AftersignIoFirstScenePrompt,
): AftersignIoFirstSceneLine {
  const line = AFTERSIGN_IO_FIRST_SCENE_DIALOGUE.find((l) => l.id === id);
  if (!line) {
    throw new Error(`Unknown Aftersign Io first-scene prompt: ${id}`);
  }
  return line;
}

/**
 * Return-beat selector for the packet fork. Reads directly from the
 * committed runtime `AftersignPacketOutcome` so this module cannot drift
 * from what `recordAftersignPacketChoice` actually stored.
 */
export function getAftersignIoPacketReturnLine(
  packetOutcome: AftersignPacketOutcome,
): AftersignIoFirstSceneLine {
  return packetOutcome === "sealed"
    ? getAftersignIoFirstSceneLine("sealedReturn")
    : getAftersignIoFirstSceneLine("openedReturn");
}

/**
 * Return-beat selector for the route memory. `listenedToRoute` is
 * whether the player heard Io out at the kiosk before running the route.
 */
export function getAftersignIoRouteReturnLine(
  listenedToRoute: boolean,
): AftersignIoFirstSceneLine {
  return listenedToRoute
    ? getAftersignIoFirstSceneLine("listenedReturn")
    : getAftersignIoFirstSceneLine("skippedReturn");
}

/**
 * Compose Io's io-return beat from a live vertical-slice state. Throws
 * if the state hasn't committed a packet outcome yet — the return beat
 * doesn't exist without a fork to remember.
 */
export function composeAftersignIoReturnBeat(
  state: AftersignVerticalSliceState,
  options: { listenedToRoute: boolean },
): {
  readonly packetLine: AftersignIoFirstSceneLine;
  readonly routeLine: AftersignIoFirstSceneLine;
} {
  if (state.packetOutcome !== "sealed" && state.packetOutcome !== "opened") {
    throw new Error(
      "Cannot compose Io return beat: packetOutcome is not committed",
    );
  }
  return {
    packetLine: getAftersignIoPacketReturnLine(state.packetOutcome),
    routeLine: getAftersignIoRouteReturnLine(options.listenedToRoute),
  };
}
