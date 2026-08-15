export type PacketIntentOutcome = 'sealed' | 'opened' | 'cancelled';

export interface PacketIntentConfig {
  readonly openHoldMs: number;
  readonly tapPreserveMaxMs: number;
  readonly driftCancelPx: number;
  readonly droppedTouchForgivenessMs: number;
}

export interface PacketIntentSample {
  readonly elapsedMs: number;
  readonly driftPx: number;
  readonly isTouchDown: boolean;
}

export interface PacketIntentState {
  readonly outcome: PacketIntentOutcome | null;
  readonly progress: number;
  readonly holdMs: number;
  readonly forgivenGapMs: number;
}

export const DEFAULT_PACKET_INTENT_CONFIG: PacketIntentConfig = {
  openHoldMs: 220,
  tapPreserveMaxMs: 120,
  driftCancelPx: 18,
  droppedTouchForgivenessMs: 48,
};

export function clampPacketIntentProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function resolvePacketIntent(
  samples: readonly PacketIntentSample[],
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentState {
  let holdMs = 0;
  let forgivenGapMs = 0;
  let outcome: PacketIntentOutcome | null = null;

  for (const sample of samples) {
    if (outcome) break;

    const elapsedMs = Math.max(0, sample.elapsedMs);
    const driftPx = Math.max(0, sample.driftPx);

    if (driftPx > config.driftCancelPx) {
      outcome = 'cancelled';
      break;
    }

    if (sample.isTouchDown) {
      holdMs += elapsedMs;
    } else if (holdMs > 0 && elapsedMs <= config.droppedTouchForgivenessMs) {
      holdMs += elapsedMs;
      forgivenGapMs += elapsedMs;
    } else if (holdMs > 0) {
      outcome = holdMs <= config.tapPreserveMaxMs ? 'sealed' : 'cancelled';
      break;
    }

    if (holdMs >= config.openHoldMs) {
      outcome = 'opened';
    }
  }

  return {
    outcome,
    progress: clampPacketIntentProgress(holdMs / config.openHoldMs),
    holdMs,
    forgivenGapMs,
  };
}

export function checkPacketIntent(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

export function runPacketIntentChecks(): void {
  const fastTap = resolvePacketIntent([
    { elapsedMs: 80, driftPx: 2, isTouchDown: true },
    { elapsedMs: 80, driftPx: 2, isTouchDown: false },
  ]);
  checkPacketIntent(fastTap.outcome === 'sealed', 'fast tap should preserve the packet seal');
  checkPacketIntent(fastTap.progress < 0.5, 'fast tap should not look like an opening hold');

  const deliberateHold = resolvePacketIntent([
    { elapsedMs: 96, driftPx: 1, isTouchDown: true },
    { elapsedMs: 76, driftPx: 1, isTouchDown: true },
    { elapsedMs: 48, driftPx: 1, isTouchDown: true },
  ]);
  checkPacketIntent(deliberateHold.outcome === 'opened', '220ms hold should open the packet');
  checkPacketIntent(deliberateHold.progress === 1, 'opened packet should report full progress');

  const forgivenDrop = resolvePacketIntent([
    { elapsedMs: 100, driftPx: 3, isTouchDown: true },
    { elapsedMs: 48, driftPx: 3, isTouchDown: false },
    { elapsedMs: 72, driftPx: 3, isTouchDown: true },
  ]);
  checkPacketIntent(forgivenDrop.outcome === 'opened', 'one dropped touch frame should not cancel a committed hold');
  checkPacketIntent(forgivenDrop.forgivenGapMs === 48, 'forgiven gap should be reported for diagnostics');

  const driftCancel = resolvePacketIntent([
    { elapsedMs: 92, driftPx: 4, isTouchDown: true },
    { elapsedMs: 20, driftPx: 19, isTouchDown: true },
  ]);
  checkPacketIntent(driftCancel.outcome === 'cancelled', 'drifting beyond 18px should cancel instead of opening');
}
