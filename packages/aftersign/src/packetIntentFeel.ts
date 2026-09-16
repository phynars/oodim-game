export const PACKET_PRESERVE_TAP_MAX_MS = 180;
export const PACKET_OPEN_HOLD_MIN_MS = 520;
export const PACKET_OPEN_MAX_TRAVEL_PX = 14;

export type PacketIntent = "preserve" | "open" | "none";

export interface PacketGesture {
  durationMs: number;
  travelPx: number;
}

/**
 * Resolves the packet's first deliberate action without making a hold that
 * turned into camera movement look like an accidental open.
 */
export function resolvePacketIntent({ durationMs, travelPx }: PacketGesture): PacketIntent {
  if (durationMs <= PACKET_PRESERVE_TAP_MAX_MS) {
    return "preserve";
  }

  if (durationMs >= PACKET_OPEN_HOLD_MIN_MS && travelPx <= PACKET_OPEN_MAX_TRAVEL_PX) {
    return "open";
  }

  return "none";
}

/** Packet state is irreversible for the current delivery run. */
export function applyPacketIntent(
  wasOpened: boolean,
  intent: PacketIntent,
): boolean {
  return wasOpened || intent === "open";
}
