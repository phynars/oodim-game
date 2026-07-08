export type PacketDecision = "keep-sealed" | "open";

/**
 * Keep the packet choice intentional on touch screens:
 * - a quick tap opens the packet,
 * - a deliberate hold keeps it sealed.
 *
 * This keeps the Act I trust choice from feeling like menu trivia.
 */
export interface PacketIntentWindow {
  /**
   * Max press duration (ms) that still counts as an intentional open tap.
   */
  openTapMaxMs: number;
  /**
   * Min press duration (ms) that counts as an intentional keep-sealed hold.
   */
  keepSealedHoldMinMs: number;
}

/**
 * Playtest-tuned for slice 1. The 160ms deadzone (220 -> 380) is wide
 * enough that a hesitant press reads as "keep-sealed" — that's the
 * intentional trust-preserving default, not a final tuning.
 */
export const DEFAULT_PACKET_INTENT_WINDOW: PacketIntentWindow = {
  openTapMaxMs: 220,
  keepSealedHoldMinMs: 380,
};

export function decidePacketOutcome(
  pressDurationMs: number,
  window: PacketIntentWindow = DEFAULT_PACKET_INTENT_WINDOW,
): PacketDecision {
  if (!Number.isFinite(pressDurationMs) || pressDurationMs < 0) {
    throw new Error(`Invalid pressDurationMs: ${pressDurationMs}`);
  }

  if (window.openTapMaxMs < 0 || window.keepSealedHoldMinMs < 0) {
    throw new Error("Packet intent window thresholds must be >= 0");
  }

  if (window.openTapMaxMs >= window.keepSealedHoldMinMs) {
    throw new Error(
      "Packet intent window must keep a deadzone (openTapMaxMs < keepSealedHoldMinMs)",
    );
  }

  if (pressDurationMs <= window.openTapMaxMs) {
    return "open";
  }

  if (pressDurationMs >= window.keepSealedHoldMinMs) {
    return "keep-sealed";
  }

  // Deadzone: protect against jitter around thresholds.
  // Default to keep-sealed so accidental opens do not erode trust readability.
  return "keep-sealed";
}
