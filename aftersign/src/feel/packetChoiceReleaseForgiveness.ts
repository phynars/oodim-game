import { stepPacketChoiceIntent } from '../packetChoiceFeel';

export type PacketChoiceAction = 'none' | 'open' | 'preserve' | 'cancel';

export interface PacketChoiceReleaseInput {
  pressed: boolean;
  action: PacketChoiceAction;
  elapsedMs: number;
  insideChoiceRadius: boolean;
  sealInspected: boolean;
}

export interface PacketChoiceReleaseConfig {
  frameBudgetMs: number;
  releaseGraceMs: number;
}

export interface PacketChoiceReleaseState {
  intentState: unknown;
  lastPressedInput?: PacketChoiceReleaseInput;
  lastPressedAtMs?: number;
  consumedReleaseAtMs?: number;
}

export interface PacketChoiceReleaseResult {
  state: PacketChoiceReleaseState;
  committedAction: Exclude<PacketChoiceAction, 'none' | 'cancel'> | null;
  canceled: boolean;
  usedReleaseForgiveness: boolean;
  bookkeepingMs: number;
}

export const DEFAULT_PACKET_CHOICE_RELEASE_CONFIG: PacketChoiceReleaseConfig = {
  frameBudgetMs: 16,
  releaseGraceMs: 80,
};

export function stepPacketChoiceReleaseForgiveness(
  state: PacketChoiceReleaseState,
  input: PacketChoiceReleaseInput,
  nowMs: number,
  config: PacketChoiceReleaseConfig = DEFAULT_PACKET_CHOICE_RELEASE_CONFIG,
): PacketChoiceReleaseResult {
  const startedAt = nowMs;

  if (input.pressed) {
    const stepped = stepPacketChoiceIntent(state.intentState as never, input as never, nowMs as never) as {
      state?: unknown;
      committedAction?: PacketChoiceAction | null;
      action?: PacketChoiceAction | null;
      canceled?: boolean;
    };

    const committedAction = normalizeCommit(stepped.committedAction ?? stepped.action ?? null);
    return {
      state: {
        intentState: stepped.state ?? stepped,
        lastPressedInput: cloneInput(input),
        lastPressedAtMs: nowMs,
        consumedReleaseAtMs: state.consumedReleaseAtMs,
      },
      committedAction,
      canceled: Boolean(stepped.canceled),
      usedReleaseForgiveness: false,
      bookkeepingMs: nowMs - startedAt,
    };
  }

  const lastPressedInput = state.lastPressedInput;
  const lastPressedAtMs = state.lastPressedAtMs;
  const canForgiveRelease =
    lastPressedInput !== undefined &&
    lastPressedAtMs !== undefined &&
    state.consumedReleaseAtMs !== lastPressedAtMs &&
    nowMs - lastPressedAtMs <= config.releaseGraceMs;

  if (!canForgiveRelease) {
    return {
      state,
      committedAction: null,
      canceled: true,
      usedReleaseForgiveness: false,
      bookkeepingMs: nowMs - startedAt,
    };
  }

  if (!input.insideChoiceRadius || input.action === 'cancel' || lastPressedInput.action === 'cancel') {
    return {
      state: { ...state, consumedReleaseAtMs: lastPressedAtMs },
      committedAction: null,
      canceled: true,
      usedReleaseForgiveness: false,
      bookkeepingMs: nowMs - startedAt,
    };
  }

  const action = normalizeCommit(lastPressedInput.action);
  const canCommitOpen = action !== 'open' || lastPressedInput.sealInspected;
  const committedAction = canCommitOpen ? action : null;

  return {
    state: { ...state, consumedReleaseAtMs: lastPressedAtMs },
    committedAction,
    canceled: committedAction === null,
    usedReleaseForgiveness: committedAction !== null,
    bookkeepingMs: nowMs - startedAt,
  };
}

export function checkPacketChoiceReleaseForgiveness(): void {
  const config = { frameBudgetMs: 16, releaseGraceMs: 80 };

  const preserveState: PacketChoiceReleaseState = {
    intentState: {},
    lastPressedInput: {
      pressed: true,
      action: 'preserve',
      elapsedMs: 280,
      insideChoiceRadius: true,
      sealInspected: false,
    },
    lastPressedAtMs: 100,
  };
  const preserveRelease = stepPacketChoiceReleaseForgiveness(
    preserveState,
    { ...preserveState.lastPressedInput!, pressed: false },
    116,
    config,
  );
  assertEqual(preserveRelease.committedAction, 'preserve', 'release on commit-eligible preserve frame commits preserve');
  assertEqual(preserveRelease.usedReleaseForgiveness, true, 'preserve release uses forgiveness');

  const openWithoutInspection: PacketChoiceReleaseState = {
    intentState: {},
    lastPressedInput: {
      pressed: true,
      action: 'open',
      elapsedMs: 300,
      insideChoiceRadius: true,
      sealInspected: false,
    },
    lastPressedAtMs: 200,
  };
  const blockedOpen = stepPacketChoiceReleaseForgiveness(
    openWithoutInspection,
    { ...openWithoutInspection.lastPressedInput!, pressed: false },
    216,
    config,
  );
  assertEqual(blockedOpen.committedAction, null, 'open release forgiveness does not bypass seal inspection');
  assertEqual(blockedOpen.canceled, true, 'uninspected open release cancels');

  const openWithInspection: PacketChoiceReleaseState = {
    intentState: {},
    lastPressedInput: {
      pressed: true,
      action: 'open',
      elapsedMs: 300,
      insideChoiceRadius: true,
      sealInspected: true,
    },
    lastPressedAtMs: 300,
  };
  const forgivenOpen = stepPacketChoiceReleaseForgiveness(
    openWithInspection,
    { ...openWithInspection.lastPressedInput!, pressed: false },
    316,
    config,
  );
  assertEqual(forgivenOpen.committedAction, 'open', 'inspected open release can commit');

  const staleRelease = stepPacketChoiceReleaseForgiveness(
    preserveState,
    { ...preserveState.lastPressedInput!, pressed: false },
    181,
    config,
  );
  assertEqual(staleRelease.committedAction, null, 'stale release after grace does not commit');
  assertEqual(staleRelease.canceled, true, 'stale release cancels');

  const dragAway = stepPacketChoiceReleaseForgiveness(
    preserveState,
    { ...preserveState.lastPressedInput!, pressed: false, insideChoiceRadius: false },
    116,
    config,
  );
  assertEqual(dragAway.committedAction, null, 'drag-away cancellation wins over release forgiveness');
  assertEqual(dragAway.usedReleaseForgiveness, false, 'drag-away does not count as forgiven release');

  assertWithin(preserveRelease.bookkeepingMs, 0, config.frameBudgetMs, 'release bookkeeping stays inside frame budget');
}

export function runPacketChoiceReleaseForgivenessChecks(): void {
  checkPacketChoiceReleaseForgiveness();
}

function normalizeCommit(action: PacketChoiceAction | null): Exclude<PacketChoiceAction, 'none' | 'cancel'> | null {
  return action === 'open' || action === 'preserve' ? action : null;
}

function cloneInput(input: PacketChoiceReleaseInput): PacketChoiceReleaseInput {
  return { ...input };
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertWithin(actual: number, min: number, max: number, message: string): void {
  if (actual < min || actual > max) {
    throw new Error(`${message}: expected ${actual} between ${min} and ${max}`);
  }
}
