export type PacketIntentPressureAction = 'preserve' | 'open' | 'undecided';

export interface PacketIntentPressureSample {
  readonly heldMs: number;
  readonly movedPx: number;
  readonly maxPressure: number;
  readonly released: boolean;
}

export interface PacketIntentPressureConfig {
  readonly preserveHoldMs: number;
  readonly openPressure: number;
  readonly cancelMovePx: number;
}

export interface PacketIntentPressureDecision {
  readonly action: PacketIntentPressureAction;
  readonly committed: boolean;
  readonly progress: number;
  readonly reason: 'hold-complete' | 'pressure-break' | 'gesture-cancelled' | 'waiting';
}

export const DEFAULT_PACKET_INTENT_PRESSURE_FEEL: PacketIntentPressureConfig = {
  preserveHoldMs: 420,
  openPressure: 0.78,
  cancelMovePx: 18,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const evaluatePacketIntentPressure = (
  sample: PacketIntentPressureSample,
  config: PacketIntentPressureConfig = DEFAULT_PACKET_INTENT_PRESSURE_FEEL,
): PacketIntentPressureDecision => {
  const holdProgress = clamp01(sample.heldMs / config.preserveHoldMs);
  const pressureProgress = clamp01(sample.maxPressure / config.openPressure);

  if (sample.movedPx > config.cancelMovePx) {
    return {
      action: 'undecided',
      committed: false,
      progress: Math.max(holdProgress, pressureProgress),
      reason: 'gesture-cancelled',
    };
  }

  if (sample.maxPressure >= config.openPressure) {
    return {
      action: 'open',
      committed: true,
      progress: 1,
      reason: 'pressure-break',
    };
  }

  if (sample.released && sample.heldMs >= config.preserveHoldMs) {
    return {
      action: 'preserve',
      committed: true,
      progress: 1,
      reason: 'hold-complete',
    };
  }

  return {
    action: 'undecided',
    committed: false,
    progress: Math.max(holdProgress, pressureProgress),
    reason: 'waiting',
  };
};
