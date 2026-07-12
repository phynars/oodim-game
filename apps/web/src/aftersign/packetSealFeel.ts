// AFTERSIGN — blue-packet seal feel contract for the flagship slice.
//
// Pure-data state machine for the opening hold. Runtime code can drive this
// from pointer/touch/key input, and the harness can assert the timing envelope
// without depending on DOM or WebGL.

export type PacketSealPhase = "sealed" | "straining" | "opened";

export type PacketSealFeelConfig = {
  /** Hold duration, in milliseconds, required to commit opening the packet. */
  openThresholdMs: number;
  /** Elapsed hold time where wax strain becomes visible but story is not committed. */
  strainVisibleMs: number;
};

export type PacketSealFeelState = {
  phase: PacketSealPhase;
  elapsedMs: number;
  strainVisible: boolean;
  opened: boolean;
  storyCommitted: boolean;
};

export const DEFAULT_PACKET_SEAL_FEEL: PacketSealFeelConfig = {
  openThresholdMs: 720,
  strainVisibleMs: 150,
};

export function createPacketSealState(): PacketSealFeelState {
  return {
    phase: "sealed",
    elapsedMs: 0,
    strainVisible: false,
    opened: false,
    storyCommitted: false,
  };
}

export function samplePacketSealHold(
  elapsedMs: number,
  config: PacketSealFeelConfig = DEFAULT_PACKET_SEAL_FEEL,
): PacketSealFeelState {
  const clampedElapsedMs = Math.max(0, elapsedMs);
  const opened = clampedElapsedMs >= config.openThresholdMs;
  const strainVisible = opened || clampedElapsedMs >= config.strainVisibleMs;

  return {
    phase: opened ? "opened" : strainVisible ? "straining" : "sealed",
    elapsedMs: clampedElapsedMs,
    strainVisible,
    opened,
    storyCommitted: opened,
  };
}

export function cancelPacketSealHold(state: PacketSealFeelState): PacketSealFeelState {
  if (state.opened) {
    return state;
  }

  return createPacketSealState();
}
