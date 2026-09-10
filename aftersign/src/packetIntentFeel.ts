export type PacketIntentDecision = 'preserve' | 'open' | 'pending' | 'cancelled';

export interface PacketIntentSample {
  readonly elapsedMs: number;
  readonly travelPx: number;
  readonly released: boolean;
}

export interface PacketIntentState {
  readonly opened: boolean;
}

export interface PacketIntentThresholds {
  readonly quickTapMs: number;
  readonly openHoldMs: number;
  readonly cancelTravelPx: number;
}

export const DEFAULT_PACKET_INTENT_THRESHOLDS: PacketIntentThresholds = {
  quickTapMs: 180,
  openHoldMs: 520,
  cancelTravelPx: 14,
};

export function readPacketIntent(
  sample: PacketIntentSample,
  state: PacketIntentState = { opened: false },
  thresholds: PacketIntentThresholds = DEFAULT_PACKET_INTENT_THRESHOLDS,
): PacketIntentDecision {
  if (state.opened) {
    return 'open';
  }

  if (sample.travelPx > thresholds.cancelTravelPx) {
    return 'cancelled';
  }

  if (sample.elapsedMs >= thresholds.openHoldMs) {
    return 'open';
  }

  if (sample.released && sample.elapsedMs <= thresholds.quickTapMs) {
    return 'preserve';
  }

  return sample.released ? 'cancelled' : 'pending';
}

export function applyPacketIntent(
  state: PacketIntentState,
  decision: PacketIntentDecision,
): PacketIntentState {
  if (state.opened || decision === 'open') {
    return { opened: true };
  }

  return state;
}

function assertPacketIntent(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkPacketIntentFeel(): void {
  assertPacketIntent(
    readPacketIntent({ elapsedMs: 120, travelPx: 2, released: true }) === 'preserve',
    'quick tap should preserve the sealed packet',
  );

  assertPacketIntent(
    readPacketIntent({ elapsedMs: 560, travelPx: 3, released: false }) === 'open',
    'stationary hold should open the packet once the hold threshold is crossed',
  );

  assertPacketIntent(
    readPacketIntent({ elapsedMs: 700, travelPx: 18, released: false }) === 'cancelled',
    'dragging beyond the travel threshold should cancel opening intent',
  );

  const opened = applyPacketIntent({ opened: false }, 'open');
  const afterPreserve = applyPacketIntent(opened, 'preserve');

  assertPacketIntent(
    opened.opened && afterPreserve.opened,
    'opened packet should not be resealed by a later preserve intent',
  );
}

export function runPacketIntentFeelChecks(): void {
  checkPacketIntentFeel();
}
