// Standalone feel model + assertion contract for the AFTERSIGN packet choice.
//
// Repo convention (aftersign/README.md — reaffirmed in PR #453, #468, #590):
//   - Vitest is NOT a repo dependency. `import ... from "vitest"` is dead
//     code by construction and gates nothing in CI.
//   - `node:test` / `node:assert` are not wired into any npm script either;
//     `test:e2e:aftersign` only runs Playwright against aftersign/e2e.
//   - Therefore the convention is a plain-TS assertion contract that lives
//     alongside the model (or at `aftersign/src/*.test.ts`), exports
//     `assert*Contract()` + a `run*Checks()` entry, and is typechecked by
//     `typecheck:aftersign` (tsconfig `include: ["src"]`). If you need to
//     execute it, wire the runner into a harness entry — don't add a new
//     test framework.
//
// PR #590 CI note: the aftersign lane went red on `test:e2e:aftersign`
// (Playwright / SwiftShader cold-start against `aftersign/e2e/`), not on
// this file's typecheck. The packet-choice model has zero runtime imports
// from `aftersign/index.html` — it's a pure stepper that only `.test.ts`
// reads — so no e2e spec's behavior depends on it.
//
// This file's job is to keep the packetChoice API TYPECHECK-BOUND to real
// usage: `assertPacketChoiceFeelContract` calls `stepPacketChoice` and
// walks every documented phase transition, so any drift in the exported
// shape (a removed field, a renamed export, a changed state key) surfaces
// as a tsc error in the aftersign lane, not as a silent green.
//
// FOCUS-GUARD CONTRACT (moved out of the model — see PR #786 review):
//   `stepPacketChoice` is pure and takes `dtMs` directly, so it does NOT
//   freeze the hold clock when the tab is backgrounded. That is the
//   CALLER's responsibility: when `document.hasFocus() === false` (or the
//   equivalent visibility signal in the harness), the caller must either
//   skip the step or pass `dtMs: 0`. Passing a real dt on a hidden frame
//   will commit a story choice on the player's behalf — that is by design
//   of a pure stepper, and the guard belongs one layer up next to the
//   `requestAnimationFrame` / input-poll site.
//
// COMMIT-STICKY CONTRACT (also caller-owned — see PR #786 review):
//   Once `state.committedIntent` is non-null, the choice is decided and
//   the stepper should NOT be called again for that gesture. The pure
//   stepper does not lock the committed side: if you keep passing
//   `pressed: true` with a `dragMeters` that crosses to the opposite
//   band, `heldMs` continues to accumulate, `readPacketChoiceIntent`
//   re-reads from the new drag, and because `heldMs >= confirmHoldMs`
//   still holds, `committedIntent` will flip. That would silently
//   rewrite the player's story choice.
//   Caller contract: stop stepping (or hold `input.pressed = false`) as
//   soon as `state.committedIntent` is set; resume only after the player
//   releases and re-presses. Symmetric with the focus guard — locking
//   belongs at the input-poll site, not inside the pure reducer.

export type PacketChoiceIntent = 'preserve' | 'open';
export type PacketChoicePhase = 'idle' | 'aiming' | 'committed';

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
  assert(state.committedIntent === null, 'aborted packet contact must not write a story choice');
}

export function runPacketChoiceFeelChecks(): void {
  assertPacketChoiceFeelContract();
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
