export type PacketIntent = "preserve" | "open" | "cancel";

export interface PacketPointerSample {
  durationMs: number;
  travelPx: number;
}

export interface PacketIntentState {
  opened: boolean;
}

export const PACKET_PRESERVE_TAP_MAX_MS = 180;
export const PACKET_OPEN_HOLD_MIN_MS = 520;
export const PACKET_OPEN_MAX_TRAVEL_PX = 14;

/**
 * A short, stationary tap preserves the seal. Opening requires a deliberate
 * hold, and a drag always wins over an accidental open.
 */
export function resolvePacketIntent(sample: PacketPointerSample): PacketIntent {
  if (sample.travelPx > PACKET_OPEN_MAX_TRAVEL_PX) return "cancel";
  if (sample.durationMs <= PACKET_PRESERVE_TAP_MAX_MS) return "preserve";
  if (sample.durationMs >= PACKET_OPEN_HOLD_MIN_MS) return "open";
  return "cancel";
}

export function applyPacketIntent(
  state: PacketIntentState,
  intent: PacketIntent,
): PacketIntentState {
  return { opened: state.opened || intent === "open" };
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`packet intent feel check failed: ${message}`);
}

/** Regression harness for the packet's two physical commitments. */
export function runPacketIntentFeelChecks(): void {
  check(
    resolvePacketIntent({ durationMs: PACKET_PRESERVE_TAP_MAX_MS, travelPx: 0 }) === "preserve",
    "a quick stationary tap preserves the packet",
  );
  check(
    resolvePacketIntent({ durationMs: PACKET_OPEN_HOLD_MIN_MS, travelPx: 0 }) === "open",
    "a stationary hold opens the packet",
  );
  check(
    resolvePacketIntent({ durationMs: PACKET_OPEN_HOLD_MIN_MS + 100, travelPx: PACKET_OPEN_MAX_TRAVEL_PX + 1 }) === "cancel",
    "a dragged hold cannot accidentally open the packet",
  );
  check(
    applyPacketIntent({ opened: true }, "preserve").opened,
    "a packet remains opened after a later preserve tap",
  );
}
