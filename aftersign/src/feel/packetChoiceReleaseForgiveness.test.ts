import {
  DEFAULT_PACKET_CHOICE_RELEASE_CONFIG,
  createPacketChoiceReleaseState,
  isPacketChoiceReleaseWithinFrameBudget,
  stepPacketChoiceReleaseForgiveness,
  type PacketChoiceReleaseState,
} from './packetChoiceReleaseForgiveness';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function pressUntil(
  intent: 'open' | 'preserve',
  durationMs: number,
  options: { sealInspected?: boolean } = {},
): PacketChoiceReleaseState {
  let state = createPacketChoiceReleaseState();
  const first = stepPacketChoiceReleaseForgiveness(state, {
    nowMs: 0,
    pressed: true,
    intent,
    sealInspected: options.sealInspected,
  });
  state = first.state;

  const second = stepPacketChoiceReleaseForgiveness(state, {
    nowMs: durationMs,
    pressed: true,
    intent,
    sealInspected: options.sealInspected,
  });

  return second.state;
}

export function checkReleaseOnFirstEligibleOpenFrameCommits(): void {
  const state = pressUntil('open', DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.openHoldMs, { sealInspected: true });

  const release = stepPacketChoiceReleaseForgiveness(state, {
    nowMs: DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.openHoldMs,
    pressed: false,
  });

  assert(release.decision === 'open', 'releasing on the first eligible open frame should commit open');
  assert(release.state.committed === 'open', 'open commit should be recorded in state');
}

export function checkReleaseOnFirstEligiblePreserveFrameCommits(): void {
  const state = pressUntil('preserve', DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.preserveConfirmMs);

  const release = stepPacketChoiceReleaseForgiveness(state, {
    nowMs: DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.preserveConfirmMs,
    pressed: false,
  });

  assert(release.decision === 'preserve', 'releasing on the first eligible preserve frame should commit preserve');
  assert(release.state.committed === 'preserve', 'preserve commit should be recorded in state');
}

export function checkOpenReleaseStillRequiresSealInspection(): void {
  const state = pressUntil('open', DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.openHoldMs, { sealInspected: false });

  const release = stepPacketChoiceReleaseForgiveness(state, {
    nowMs: DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.openHoldMs,
    pressed: false,
  });

  assert(release.decision === 'hold', 'open release forgiveness must not bypass seal inspection');
  assert(release.state.committed === null, 'uninspected open release should not commit');
}

export function checkStaleReleaseCancels(): void {
  const state = pressUntil('preserve', DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.preserveConfirmMs - 1);
  const release = stepPacketChoiceReleaseForgiveness(state, {
    nowMs: DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.preserveConfirmMs - 1,
    pressed: false,
  });

  const stale = stepPacketChoiceReleaseForgiveness(release.state, {
    nowMs:
      DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.preserveConfirmMs -
      1 +
      DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.releaseGraceMs +
      1,
    pressed: false,
  });

  assert(stale.decision === 'cancel', 'stale release outside the forgiveness window should cancel');
  assert(stale.state.cancelled, 'stale release cancellation should be recorded');
}

export function checkDragAwayCancellationWins(): void {
  const state = pressUntil('preserve', DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.preserveConfirmMs);

  const dragAway = stepPacketChoiceReleaseForgiveness(state, {
    nowMs: DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.preserveConfirmMs,
    pressed: false,
    pointerInsideChoice: false,
  });

  assert(dragAway.decision === 'cancel', 'drag-away should cancel instead of using release forgiveness');
  assert(dragAway.state.cancelled, 'drag-away cancellation should be recorded');
  assert(dragAway.state.committed === null, 'drag-away should not commit a packet choice');
}

export function checkReleaseForgivenessBookkeepingStaysInsideFrameBudget(): void {
  const state = pressUntil('open', DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.openHoldMs, { sealInspected: true });

  const release = stepPacketChoiceReleaseForgiveness(state, {
    nowMs: DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.openHoldMs,
    pressed: false,
  });

  assert(
    isPacketChoiceReleaseWithinFrameBudget(release),
    `release-forgiveness bookkeeping should stay within ${DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.frameBudgetMs}ms`,
  );
}

export function runPacketChoiceReleaseForgivenessChecks(): void {
  checkReleaseOnFirstEligibleOpenFrameCommits();
  checkReleaseOnFirstEligiblePreserveFrameCommits();
  checkOpenReleaseStillRequiresSealInspection();
  checkStaleReleaseCancels();
  checkDragAwayCancellationWins();
  checkReleaseForgivenessBookkeepingStaysInsideFrameBudget();
}

runPacketChoiceReleaseForgivenessChecks();
