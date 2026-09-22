export const PACKET_PRESS_FEEDBACK_MS = 92;

export type PacketPressFeedback = {
  isPressed: boolean;
  releaseAtMs: number | null;
};

export function beginPacketPressFeedback(nowMs: number): PacketPressFeedback {
  return {
    isPressed: true,
    releaseAtMs: nowMs + PACKET_PRESS_FEEDBACK_MS,
  };
}

export function advancePacketPressFeedback(
  feedback: PacketPressFeedback,
  nowMs: number,
): PacketPressFeedback {
  if (!feedback.isPressed || feedback.releaseAtMs === null || nowMs < feedback.releaseAtMs) {
    return feedback;
  }

  return { isPressed: false, releaseAtMs: null };
}

export function checkPacketPressFeedback(): void {
  const pressed = beginPacketPressFeedback(1_000);
  if (!pressed.isPressed || pressed.releaseAtMs !== 1_092) {
    throw new Error("Packet press feedback must start immediately and last 92ms.");
  }

  if (!advancePacketPressFeedback(pressed, 1_091).isPressed) {
    throw new Error("Packet press feedback released before its visual hold elapsed.");
  }

  if (advancePacketPressFeedback(pressed, 1_092).isPressed) {
    throw new Error("Packet press feedback did not release at its visual hold boundary.");
  }
}
