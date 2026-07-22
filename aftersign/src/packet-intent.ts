export type PacketIntent = 'idle' | 'considering-open' | 'committed-open' | 'committed-preserve';

export type PacketGestureEvent =
  | { type: 'press-start'; t: number }
  | { type: 'press-end'; t: number }
  | { type: 'drag'; t: number; distancePx: number }
  | { type: 'cancel'; t: number };

export interface PacketIntentState {
  readonly intent: PacketIntent;
  readonly pressStartedAt: number | null;
  readonly progress: number;
  readonly lastEventAt: number;
}

export interface PacketIntentConfig {
  /** Time before the seal is allowed to break. Keeps opening from feeling like an accidental tap. */
  readonly openHoldMs: number;
  /** Minimum visible progress before the UI should show the wax straining. */
  readonly revealMs: number;
  /** Finger travel allowed while holding before we treat the gesture as navigation, not packet intent. */
  readonly cancelDistancePx: number;
}

export const DEFAULT_PACKET_INTENT_CONFIG: PacketIntentConfig = {
  openHoldMs: 620,
  revealMs: 140,
  cancelDistancePx: 18,
};

export const initialPacketIntentState = (): PacketIntentState => ({
  intent: 'idle',
  pressStartedAt: null,
  progress: 0,
  lastEventAt: 0,
});

export const updatePacketIntent = (
  state: PacketIntentState,
  event: PacketGestureEvent,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentState => {
  if (state.intent === 'committed-open' || state.intent === 'committed-preserve') {
    return { ...state, lastEventAt: event.t };
  }

  if (event.type === 'cancel') {
    return {
      intent: 'idle',
      pressStartedAt: null,
      progress: 0,
      lastEventAt: event.t,
    };
  }

  if (event.type === 'press-start') {
    return {
      intent: 'idle',
      pressStartedAt: event.t,
      progress: 0,
      lastEventAt: event.t,
    };
  }

  if (state.pressStartedAt === null) {
    return { ...state, lastEventAt: event.t };
  }

  if (event.type === 'drag' && event.distancePx > config.cancelDistancePx) {
    return {
      intent: 'idle',
      pressStartedAt: null,
      progress: 0,
      lastEventAt: event.t,
    };
  }

  const heldMs = Math.max(0, event.t - state.pressStartedAt);
  const progress = Math.min(1, heldMs / config.openHoldMs);

  if (event.type === 'press-end') {
    if (heldMs >= config.openHoldMs) {
      return {
        intent: 'committed-open',
        pressStartedAt: null,
        progress: 1,
        lastEventAt: event.t,
      };
    }

    return {
      intent: 'committed-preserve',
      pressStartedAt: null,
      progress: 0,
      lastEventAt: event.t,
    };
  }

  return {
    intent: heldMs >= config.revealMs ? 'considering-open' : 'idle',
    pressStartedAt: state.pressStartedAt,
    progress,
    lastEventAt: event.t,
  };
};

export const reducePacketIntent = (
  events: readonly PacketGestureEvent[],
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentState => events.reduce((state, event) => updatePacketIntent(state, event, config), initialPacketIntentState());

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

export const checkQuickTapPreservesPacket = (): void => {
  const state = reducePacketIntent([
    { type: 'press-start', t: 1000 },
    { type: 'press-end', t: 1120 },
  ]);

  assert(state.intent === 'committed-preserve', 'quick tap should preserve the sealed packet');
  assert(state.progress === 0, 'preserve commit should not leave partial open progress');
};

export const checkHoldCommitsOpenOnlyAfterThreshold = (): void => {
  const beforeThreshold = reducePacketIntent([
    { type: 'press-start', t: 2000 },
    { type: 'drag', t: 2580, distancePx: 0 },
    { type: 'press-end', t: 2580 },
  ]);

  assert(beforeThreshold.intent === 'committed-preserve', 'release before hold threshold should preserve the packet');

  const afterThreshold = reducePacketIntent([
    { type: 'press-start', t: 2000 },
    { type: 'drag', t: 2640, distancePx: 0 },
    { type: 'press-end', t: 2640 },
  ]);

  assert(afterThreshold.intent === 'committed-open', 'hold past threshold should commit opening the packet');
  assert(afterThreshold.progress === 1, 'open commit should finish at full progress');
};

export const checkMovementCancelsPacketIntent = (): void => {
  const state = reducePacketIntent([
    { type: 'press-start', t: 3000 },
    { type: 'drag', t: 3300, distancePx: 24 },
    { type: 'press-end', t: 3700 },
  ]);

  assert(state.intent === 'idle', 'movement beyond the dead zone should cancel packet intent instead of opening');
  assert(state.pressStartedAt === null, 'cancelled packet intent should clear press start');
};

export const checkConsideringStateStartsAfterReadableDelay = (): void => {
  const hidden = reducePacketIntent([
    { type: 'press-start', t: 4000 },
    { type: 'drag', t: 4100, distancePx: 0 },
  ]);

  assert(hidden.intent === 'idle', 'packet should not show open intent before reveal delay');

  const visible = reducePacketIntent([
    { type: 'press-start', t: 4000 },
    { type: 'drag', t: 4160, distancePx: 0 },
  ]);

  assert(visible.intent === 'considering-open', 'packet should expose considering-open after reveal delay');
  assert(visible.progress > 0 && visible.progress < 1, 'considering-open should expose partial progress for UI feedback');
};

export const runPacketIntentChecks = (): void => {
  checkQuickTapPreservesPacket();
  checkHoldCommitsOpenOnlyAfterThreshold();
  checkMovementCancelsPacketIntent();
  checkConsideringStateStartsAfterReadableDelay();
};
