export const PACKET_CHOICE_PRESS_MAX_MS = 80;
export const PACKET_CHOICE_PRESS_MIN_SCALE = 0.96;

export type PacketChoicePressState = "idle" | "pressed" | "committed";

/**
 * Keeps a packet choice visually coupled to the same pointer gesture that
 * commits it. Rendering code owns animation; this module owns the bounded
 * timing contract so the feedback cannot silently drift into a later frame.
 */
export function packetChoicePressState(
  pressedAtMs: number | null,
  committedAtMs: number | null,
  nowMs: number,
): PacketChoicePressState {
  if (committedAtMs !== null) return "committed";
  if (pressedAtMs === null) return "idle";
  return nowMs - pressedAtMs <= PACKET_CHOICE_PRESS_MAX_MS ? "pressed" : "idle";
}

export function packetChoicePressScale(state: PacketChoicePressState): number {
  return state === "pressed" ? PACKET_CHOICE_PRESS_MIN_SCALE : 1;
}
