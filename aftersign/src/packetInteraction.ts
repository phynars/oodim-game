export type PacketSealState = 'sealed' | 'opening' | 'opened';

export interface PacketInteractionState {
  sealState: PacketSealState;
  holdElapsedMs: number;
  strainVisible: boolean;
  committedAtMs: number | null;
}

export interface PacketInteractionOptions {
  /** Hold duration required before the wax seal opens. */
  openHoldMs: number;
  /** Earliest time the player should see wax strain feedback. */
  strainFeedbackMs: number;
}

export const DEFAULT_PACKET_INTERACTION: PacketInteractionOptions = {
  openHoldMs: 750,
  strainFeedbackMs: 150,
};

export function createPacketInteractionState(): PacketInteractionState {
  return {
    sealState: 'sealed',
    holdElapsedMs: 0,
    strainVisible: false,
    committedAtMs: null,
  };
}

export function beginPacketOpenHold(
  state: PacketInteractionState,
): PacketInteractionState {
  if (state.sealState === 'opened') {
    return state;
  }

  return {
    sealState: 'opening',
    holdElapsedMs: 0,
    strainVisible: false,
    committedAtMs: null,
  };
}

export function cancelPacketOpenHold(
  state: PacketInteractionState,
): PacketInteractionState {
  if (state.sealState !== 'opening') {
    return state;
  }

  return {
    sealState: 'sealed',
    holdElapsedMs: 0,
    strainVisible: false,
    committedAtMs: null,
  };
}

export function tickPacketOpenHold(
  state: PacketInteractionState,
  deltaMs: number,
  nowMs: number,
  options: PacketInteractionOptions = DEFAULT_PACKET_INTERACTION,
): PacketInteractionState {
  if (state.sealState !== 'opening') {
    return state;
  }

  const holdElapsedMs = Math.max(0, state.holdElapsedMs + deltaMs);
  const strainVisible = holdElapsedMs >= options.strainFeedbackMs;

  if (holdElapsedMs >= options.openHoldMs) {
    return {
      sealState: 'opened',
      holdElapsedMs: options.openHoldMs,
      strainVisible: true,
      committedAtMs: nowMs,
    };
  }

  return {
    sealState: 'opening',
    holdElapsedMs,
    strainVisible,
    committedAtMs: null,
  };
}

export function getPacketSealStoryValue(
  state: PacketInteractionState,
): 'sealed' | 'opened' {
  return state.sealState === 'opened' ? 'opened' : 'sealed';
}
