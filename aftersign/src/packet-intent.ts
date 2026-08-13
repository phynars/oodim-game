export type PacketIntentOutcome = 'sealed' | 'opened' | 'pending';

export interface PacketIntentSample {
  readonly elapsedMs: number;
  readonly pressed: boolean;
  readonly movedPx?: number;
}

export interface PacketIntentLimits {
  readonly openHoldMs: number;
  readonly preserveTapMs: number;
  readonly forgivenessMs: number;
  readonly driftCancelPx: number;
}

export interface PacketIntentState {
  readonly outcome: PacketIntentOutcome;
  readonly elapsedMs: number;
  readonly forgivenGapMs: number;
  readonly driftPx: number;
}

export const PACKET_INTENT_LIMITS: PacketIntentLimits = {
  openHoldMs: 220,
  preserveTapMs: 160,
  forgivenessMs: 48,
  driftCancelPx: 18,
};

export function createPacketIntentState(): PacketIntentState {
  return {
    outcome: 'pending',
    elapsedMs: 0,
    forgivenGapMs: 0,
    driftPx: 0,
  };
}

export function samplePacketIntent(
  previous: PacketIntentState,
  sample: PacketIntentSample,
  limits: PacketIntentLimits = PACKET_INTENT_LIMITS,
): PacketIntentState {
  if (previous.outcome !== 'pending') {
    return previous;
  }

  const movedPx = Math.max(0, sample.movedPx ?? previous.driftPx);
  if (movedPx > limits.driftCancelPx) {
    return {
      ...previous,
      outcome: 'sealed',
      driftPx: movedPx,
    };
  }

  if (sample.pressed) {
    const elapsedMs = Math.max(previous.elapsedMs, sample.elapsedMs);
    return {
      outcome: elapsedMs >= limits.openHoldMs ? 'opened' : 'pending',
      elapsedMs,
      forgivenGapMs: previous.forgivenGapMs,
      driftPx: movedPx,
    };
  }

  const gapMs = Math.max(0, sample.elapsedMs - previous.elapsedMs);
  const forgivenGapMs = previous.forgivenGapMs + gapMs;

  if (previous.elapsedMs <= limits.preserveTapMs && forgivenGapMs > limits.forgivenessMs) {
    return {
      outcome: 'sealed',
      elapsedMs: previous.elapsedMs,
      forgivenGapMs,
      driftPx: movedPx,
    };
  }

  return {
    outcome: 'pending',
    elapsedMs: previous.elapsedMs,
    forgivenGapMs,
    driftPx: movedPx,
  };
}

export function resolvePacketIntent(samples: readonly PacketIntentSample[]): PacketIntentState {
  return samples.reduce((state, sample) => samplePacketIntent(state, sample), createPacketIntentState());
}

function assertPacketIntent(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkFastTapPreservesSeal(): void {
  const state = resolvePacketIntent([
    { elapsedMs: 0, pressed: true },
    { elapsedMs: 96, pressed: true },
    { elapsedMs: 145, pressed: false },
    { elapsedMs: 194, pressed: false },
  ]);

  assertPacketIntent(state.outcome === 'sealed', `fast tap should preserve the seal; got ${state.outcome}`);
  assertPacketIntent(state.elapsedMs <= PACKET_INTENT_LIMITS.preserveTapMs, 'preserve tap must stay inside the tap window');
}

export function checkDeliberateHoldOpensPacket(): void {
  const state = resolvePacketIntent([
    { elapsedMs: 0, pressed: true },
    { elapsedMs: 80, pressed: true },
    { elapsedMs: 160, pressed: true },
    { elapsedMs: 220, pressed: true },
  ]);

  assertPacketIntent(state.outcome === 'opened', `220ms hold should open the packet; got ${state.outcome}`);
  assertPacketIntent(state.elapsedMs === PACKET_INTENT_LIMITS.openHoldMs, 'open should resolve exactly at the authored hold threshold');
}

export function checkDroppedTouchFrameIsForgiven(): void {
  const state = resolvePacketIntent([
    { elapsedMs: 0, pressed: true },
    { elapsedMs: 112, pressed: true },
    { elapsedMs: 160, pressed: false },
    { elapsedMs: 208, pressed: true },
    { elapsedMs: 220, pressed: true },
  ]);

  assertPacketIntent(state.outcome === 'opened', `one 48ms dropped touch frame should not seal the packet; got ${state.outcome}`);
  assertPacketIntent(state.forgivenGapMs === PACKET_INTENT_LIMITS.forgivenessMs, 'forgiven gap should match the one-frame budget');
}

export function runPacketIntentChecks(): void {
  checkFastTapPreservesSeal();
  checkDeliberateHoldOpensPacket();
  checkDroppedTouchFrameIsForgiven();
}
