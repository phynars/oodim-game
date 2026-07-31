export type PacketIntent = 'preserve' | 'open' | 'inspect';

export interface PacketGestureSample {
  readonly elapsedMs: number;
  readonly pressDistancePx: number;
  readonly movedAwayPx: number;
  readonly releaseInsideSeal: boolean;
}

export interface PacketIntentThresholds {
  readonly preserveTapMaxMs: number;
  readonly preserveTapMaxDistancePx: number;
  readonly openHoldMinMs: number;
  readonly openPressMinDistancePx: number;
  readonly cancelMoveAwayPx: number;
}

export const DEFAULT_PACKET_INTENT_THRESHOLDS: PacketIntentThresholds = {
  preserveTapMaxMs: 180,
  preserveTapMaxDistancePx: 8,
  openHoldMinMs: 420,
  openPressMinDistancePx: 14,
  cancelMoveAwayPx: 32,
};

export function resolvePacketIntent(
  sample: PacketGestureSample,
  thresholds: PacketIntentThresholds = DEFAULT_PACKET_INTENT_THRESHOLDS,
): PacketIntent {
  if (!sample.releaseInsideSeal || sample.movedAwayPx >= thresholds.cancelMoveAwayPx) {
    return 'inspect';
  }

  const isCleanTap =
    sample.elapsedMs <= thresholds.preserveTapMaxMs &&
    sample.pressDistancePx <= thresholds.preserveTapMaxDistancePx;

  if (isCleanTap) {
    return 'preserve';
  }

  const isDeliberateBreak =
    sample.elapsedMs >= thresholds.openHoldMinMs &&
    sample.pressDistancePx >= thresholds.openPressMinDistancePx;

  if (isDeliberateBreak) {
    return 'open';
  }

  return 'inspect';
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkPacketIntentHarness(): void {
  assert(
    resolvePacketIntent({
      elapsedMs: 120,
      pressDistancePx: 3,
      movedAwayPx: 0,
      releaseInsideSeal: true,
    }) === 'preserve',
    'quick, steady tap should preserve the blue packet seal',
  );

  assert(
    resolvePacketIntent({
      elapsedMs: 520,
      pressDistancePx: 18,
      movedAwayPx: 2,
      releaseInsideSeal: true,
    }) === 'open',
    'breaking the blue packet seal should require a held press plus clear pressure travel',
  );

  assert(
    resolvePacketIntent({
      elapsedMs: 260,
      pressDistancePx: 12,
      movedAwayPx: 3,
      releaseInsideSeal: true,
    }) === 'inspect',
    'ambiguous packet handling should inspect, not silently commit the story fork',
  );

  assert(
    resolvePacketIntent({
      elapsedMs: 620,
      pressDistancePx: 24,
      movedAwayPx: 40,
      releaseInsideSeal: true,
    }) === 'inspect',
    'dragging away from the seal should cancel instead of opening the packet',
  );

  assert(
    resolvePacketIntent({
      elapsedMs: 560,
      pressDistancePx: 20,
      movedAwayPx: 0,
      releaseInsideSeal: false,
    }) === 'inspect',
    'releasing outside the seal should never break the packet',
  );
}

export function runPacketIntentChecks(): void {
  checkPacketIntentHarness();
}
