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
    const armedAtMs = nextIntent === null ? null : intentChanged || previous.armedAtMs === null ? input.nowMs : previous.armedAtMs;

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

// Re-exported from the sibling `.test.ts` so the aftersign e2e spec (on the
// `typecheck:aftersign` lane) can `import { runPacketChoiceReleaseForgivenessChecks }`
// from this module path — matches the packet-intent contract convention and
// unblocks the Playwright pure-lane spec at
// aftersign/e2e/packet-choice-release-forgiveness-contract.spec.ts.
export { runPacketChoiceReleaseForgivenessChecks } from './packetChoiceReleaseForgiveness.test';

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
