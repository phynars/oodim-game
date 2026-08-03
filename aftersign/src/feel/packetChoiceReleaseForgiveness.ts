// AFTERSIGN packet-choice release-forgiveness feel contract.
//
// The vertical slice's blue-seal choice is deliberately hold-heavy: a
// preserve tap must land inside a short window, an open hold must
// survive `openHoldMs`. Both thresholds are sharp — one frame short
// and the gesture is punished as "inspect-only" (open) or nothing
// (preserve). That sharpness is correct for the intent, but on real
// hardware a finger-up frequently trails the *intent* to release by a
// frame or two. This module pins the invariants that keep those
// good-faith finger-ups from being scored as cancels.
//
// Repo convention (see aftersign/src/packetChoiceFeel.ts + its
// packetChoiceFeel.test.ts shim; PR #973 for the pure-runner reasoning):
//   - The `.ts` module OWNS `check*()` + `run*Checks()`.  The sibling
//     `.test.ts` is an EXPORT-ONLY shim so pure-runner + Playwright can
//     import the runner without double-executing it.
//   - Everything is plain TS: no vitest, no jest.  `typecheck:aftersign`
//     is the type gate; `test:aftersign:pure` executes the checks.
//
// Consumer (Soren's rule, PR #994 re-review): this module is not a
// self-referential harness.  Its `releaseGraceMs` constant is imported
// by `apps/web/src/aftersign/packetChoiceFeel.ts` (`evaluatePacketChoiceGesture`),
// the ONE gesture judge, so the forgiveness window here and the
// forgiveness applied at the input surface cannot drift.  The pure
// checks below pin the state-machine version; the vitest suite on the
// gesture judge pins the same behaviour on the runtime API.

export type PacketChoiceReleaseIntent = 'open' | 'preserve';
export type PacketChoiceReleaseDecision = PacketChoiceReleaseIntent | 'cancel' | 'hold';

export interface PacketChoiceReleaseState {
  readonly intent: PacketChoiceReleaseIntent | null;
  readonly armedAtMs: number | null;
  readonly releasedAtMs: number | null;
  readonly sealInspected: boolean;
  readonly pointerInsideChoice: boolean;
  readonly committed: PacketChoiceReleaseIntent | null;
  readonly cancelled: boolean;
}

export interface PacketChoiceReleaseInput {
  readonly nowMs: number;
  readonly pressed: boolean;
  readonly intent?: PacketChoiceReleaseIntent | null;
  readonly sealInspected?: boolean;
  readonly pointerInsideChoice?: boolean;
}

export interface PacketChoiceReleaseConfig {
  readonly openHoldMs: number;
  readonly preserveConfirmMs: number;
  readonly minArmedVisibleMs: number;
  readonly releaseGraceMs: number;
  readonly frameBudgetMs: number;
}

export interface PacketChoiceReleaseStep {
  readonly state: PacketChoiceReleaseState;
  readonly decision: PacketChoiceReleaseDecision;
  readonly elapsedMs: number;
}

export const DEFAULT_PACKET_CHOICE_RELEASE_CONFIG: PacketChoiceReleaseConfig = {
  openHoldMs: 420,
  preserveConfirmMs: 220,
  minArmedVisibleMs: 96,
  releaseGraceMs: 96,
  frameBudgetMs: 16,
};

export const createPacketChoiceReleaseState = (): PacketChoiceReleaseState => ({
  intent: null,
  armedAtMs: null,
  releasedAtMs: null,
  sealInspected: false,
  pointerInsideChoice: true,
  committed: null,
  cancelled: false,
});

export function stepPacketChoiceReleaseForgiveness(
  previous: PacketChoiceReleaseState,
  input: PacketChoiceReleaseInput,
  config: PacketChoiceReleaseConfig = DEFAULT_PACKET_CHOICE_RELEASE_CONFIG,
): PacketChoiceReleaseStep {
  const frameStartedAtMs = input.nowMs;

  if (previous.committed !== null) {
    return finish(previous, previous.committed, frameStartedAtMs, input.nowMs);
  }

  if (previous.cancelled) {
    return finish(previous, 'cancel', frameStartedAtMs, input.nowMs);
  }

  const pointerInsideChoice = input.pointerInsideChoice ?? previous.pointerInsideChoice;
  const sealInspected = previous.sealInspected || input.sealInspected === true;
  const nextIntent = input.intent ?? previous.intent;

  if (!pointerInsideChoice) {
    return finish(
      {
        ...previous,
        pointerInsideChoice,
        sealInspected,
        cancelled: true,
      },
      'cancel',
      frameStartedAtMs,
      input.nowMs,
    );
  }

  if (input.pressed) {
    const intentChanged = nextIntent !== previous.intent;
    const armedAtMs =
      nextIntent === null
        ? null
        : intentChanged || previous.armedAtMs === null
        ? input.nowMs
        : previous.armedAtMs;

    return finish(
      {
        intent: nextIntent,
        armedAtMs,
        releasedAtMs: null,
        sealInspected,
        pointerInsideChoice,
        committed: null,
        cancelled: false,
      },
      'hold',
      frameStartedAtMs,
      input.nowMs,
    );
  }

  if (previous.intent === null || previous.armedAtMs === null) {
    return finish(
      {
        ...previous,
        sealInspected,
        pointerInsideChoice,
        cancelled: true,
      },
      'cancel',
      frameStartedAtMs,
      input.nowMs,
    );
  }

  const releasedAtMs = previous.releasedAtMs ?? input.nowMs;
  const heldMs = releasedAtMs - previous.armedAtMs;
  const visibleMs = input.nowMs - previous.armedAtMs;
  const staleReleaseMs = input.nowMs - releasedAtMs;

  if (staleReleaseMs > config.releaseGraceMs) {
    return finish(
      {
        ...previous,
        releasedAtMs,
        sealInspected,
        pointerInsideChoice,
        cancelled: true,
      },
      'cancel',
      frameStartedAtMs,
      input.nowMs,
    );
  }

  const requiredHoldMs = previous.intent === 'open' ? config.openHoldMs : config.preserveConfirmMs;
  const canCommit = heldMs >= requiredHoldMs && visibleMs >= config.minArmedVisibleMs;
  const openAllowed = previous.intent !== 'open' || sealInspected;

  if (canCommit && openAllowed) {
    return finish(
      {
        ...previous,
        releasedAtMs,
        sealInspected,
        pointerInsideChoice,
        committed: previous.intent,
      },
      previous.intent,
      frameStartedAtMs,
      input.nowMs,
    );
  }

  return finish(
    {
      ...previous,
      releasedAtMs,
      sealInspected,
      pointerInsideChoice,
    },
    'hold',
    frameStartedAtMs,
    input.nowMs,
  );
}

export function isPacketChoiceReleaseWithinFrameBudget(
  step: PacketChoiceReleaseStep,
  config: PacketChoiceReleaseConfig = DEFAULT_PACKET_CHOICE_RELEASE_CONFIG,
): boolean {
  return step.elapsedMs <= config.frameBudgetMs;
}

function finish(
  state: PacketChoiceReleaseState,
  decision: PacketChoiceReleaseDecision,
  frameStartedAtMs: number,
  frameEndedAtMs: number,
): PacketChoiceReleaseStep {
  return {
    state,
    decision,
    elapsedMs: Math.max(0, frameEndedAtMs - frameStartedAtMs),
  };
}

// ---------------------------------------------------------------------------
// Pure-lane invariant checks
//
// These live in the `.ts` module (not the `.test.ts` shim) so
// `typecheck:aftersign` and `test:aftersign:pure` see the same source
// of truth. The sibling `.test.ts` re-exports `runPacketChoiceReleaseForgivenessChecks`
// so the aftersign/e2e/ pure Playwright spec's import path stays stable.
// ---------------------------------------------------------------------------

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function pressUntil(
  intent: PacketChoiceReleaseIntent,
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
  const state = pressUntil('open', DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.openHoldMs, {
    sealInspected: true,
  });

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

  assert(
    release.decision === 'preserve',
    'releasing on the first eligible preserve frame should commit preserve',
  );
  assert(release.state.committed === 'preserve', 'preserve commit should be recorded in state');
}

export function checkOpenReleaseStillRequiresSealInspection(): void {
  const state = pressUntil('open', DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.openHoldMs, {
    sealInspected: false,
  });

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

export function checkEarlyReleaseInsideGraceWindowStillHolds(): void {
  // Release BEFORE requiredHoldMs but still inside the grace window: the
  // state machine keeps the intent alive as `hold` — not committed, not
  // cancelled — so a subsequent frame within the grace can still resolve
  // per the real rules.
  const state = pressUntil('preserve', DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.preserveConfirmMs - 20);

  const earlyRelease = stepPacketChoiceReleaseForgiveness(state, {
    nowMs: DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.preserveConfirmMs - 20,
    pressed: false,
  });

  assert(
    earlyRelease.decision === 'hold',
    'early release inside the grace window but below requiredHoldMs should hold, not commit',
  );
  assert(earlyRelease.state.committed === null, 'early release must not commit a packet choice');
  assert(!earlyRelease.state.cancelled, 'early release inside the grace window must not cancel yet');
}

export function checkReleaseForgivenessBookkeepingStaysInsideFrameBudget(): void {
  const state = pressUntil('open', DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.openHoldMs, {
    sealInspected: true,
  });

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
  checkEarlyReleaseInsideGraceWindowStillHolds();
  checkReleaseForgivenessBookkeepingStaysInsideFrameBudget();
}
