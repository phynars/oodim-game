export type PacketChoiceIntent = 'preserve' | 'open';
export type PacketChoicePhase = 'idle' | 'aiming' | 'committed' | 'cancelled';

export interface PacketChoiceFeelConfig {
  readonly intentionalHoldMs: number;
  readonly confirmHoldMs: number;
  readonly openDragMeters: number;
  readonly preserveDragMeters: number;
  readonly cancelRadiusMeters: number;
  readonly frameBudgetMs: number;
}

export interface PacketChoiceState {
  readonly phase: PacketChoicePhase;
  readonly heldMs: number;
  readonly dragMeters: number;
  readonly intent: PacketChoiceIntent | null;
  readonly committedIntent: PacketChoiceIntent | null;
  readonly lastStepMs: number;
}

export interface PacketChoiceInput {
  readonly pressed: boolean;
  readonly dragMeters: number;
  readonly dtMs: number;
}

export const DEFAULT_PACKET_CHOICE_FEEL: PacketChoiceFeelConfig = {
  intentionalHoldMs: 120,
  confirmHoldMs: 280,
  openDragMeters: 0.18,
  preserveDragMeters: -0.14,
  cancelRadiusMeters: 0.045,
  frameBudgetMs: 16.67,
};

export const INITIAL_PACKET_CHOICE_STATE: PacketChoiceState = {
  phase: 'idle',
  heldMs: 0,
  dragMeters: 0,
  intent: null,
  committedIntent: null,
  lastStepMs: 0,
};

export function stepPacketChoice(
  state: PacketChoiceState,
  input: PacketChoiceInput,
  config: PacketChoiceFeelConfig = DEFAULT_PACKET_CHOICE_FEEL,
): PacketChoiceState {
  if (!input.pressed) {
    return state.phase === 'committed'
      ? { ...state, lastStepMs: input.dtMs }
      : { ...INITIAL_PACKET_CHOICE_STATE, lastStepMs: input.dtMs };
  }

  const heldMs = state.phase === 'idle' ? input.dtMs : state.heldMs + input.dtMs;
  const dragMeters = input.dragMeters;

  if (heldMs < config.intentionalHoldMs && Math.abs(dragMeters) <= config.cancelRadiusMeters) {
    return {
      phase: 'aiming',
      heldMs,
      dragMeters,
      intent: null,
      committedIntent: null,
      lastStepMs: input.dtMs,
    };
  }

  const intent = readPacketChoiceIntent(dragMeters, config);
  const committedIntent = heldMs >= config.confirmHoldMs ? intent : null;

  return {
    phase: committedIntent ? 'committed' : 'aiming',
    heldMs,
    dragMeters,
    intent,
    committedIntent,
    lastStepMs: input.dtMs,
  };
}

export function readPacketChoiceIntent(
  dragMeters: number,
  config: PacketChoiceFeelConfig = DEFAULT_PACKET_CHOICE_FEEL,
): PacketChoiceIntent | null {
  if (dragMeters >= config.openDragMeters) return 'open';
  if (dragMeters <= config.preserveDragMeters) return 'preserve';
  return null;
}

export function assertPacketChoiceFeelContract(
  config: PacketChoiceFeelConfig = DEFAULT_PACKET_CHOICE_FEEL,
): void {
  const oneFrame = config.frameBudgetMs;
  let state = INITIAL_PACKET_CHOICE_STATE;

  state = stepPacketChoice(state, { pressed: true, dragMeters: 0, dtMs: oneFrame }, config);
  assert(state.phase === 'aiming', 'first contact should enter aiming on the same frame');
  assert(state.intent === null, 'first contact must not pick open/preserve by accident');
  assert(state.lastStepMs <= config.frameBudgetMs, 'packet choice step must stay inside one 60Hz frame');

  state = INITIAL_PACKET_CHOICE_STATE;
  state = stepPacketChoice(state, { pressed: true, dragMeters: config.openDragMeters + 0.01, dtMs: config.intentionalHoldMs - oneFrame }, config);
  assert(state.intent === 'open', 'open drag should preview opening once outside the dead zone');
  assert(state.committedIntent === null, 'open preview before confirm hold must not commit');
  state = stepPacketChoice(state, { pressed: true, dragMeters: config.openDragMeters + 0.01, dtMs: config.confirmHoldMs }, config);
  assert(state.committedIntent === 'open', 'open must commit only after the confirm hold');

  state = INITIAL_PACKET_CHOICE_STATE;
  state = stepPacketChoice(state, { pressed: true, dragMeters: config.preserveDragMeters - 0.01, dtMs: config.confirmHoldMs }, config);
  assert(state.intent === 'preserve', 'preserve drag should preview preserving the seal');
  assert(state.committedIntent === 'preserve', 'preserve must commit after the same confirm hold as open');

  state = stepPacketChoice(state, { pressed: false, dragMeters: 0, dtMs: oneFrame }, config);
  assert(state.phase === 'committed', 'releasing after commit must keep the chosen result readable');

  state = INITIAL_PACKET_CHOICE_STATE;
  state = stepPacketChoice(state, { pressed: true, dragMeters: config.cancelRadiusMeters * 0.5, dtMs: config.intentionalHoldMs - 1 }, config);
  state = stepPacketChoice(state, { pressed: false, dragMeters: 0, dtMs: oneFrame }, config);
  assert(state.phase === 'idle', 'release inside cancel radius before intent should return to idle');
  assert(state.committedIntent === null, 'cancelled packet contact must not write a story choice');
}

export function runPacketChoiceFeelChecks(): void {
  assertPacketChoiceFeelContract();
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
