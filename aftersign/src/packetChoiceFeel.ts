export type PacketChoiceIntent = "sealed" | "opened" | "undecided";

export type PacketChoiceFeelConfig = {
  readonly tapCommitMs: number;
  readonly holdCommitMs: number;
  readonly driftCancelPx: number;
  readonly minimumDecisionGapMs: number;
};

export type PacketChoiceGesture = {
  readonly elapsedMs: number;
  readonly driftPx: number;
  readonly released: boolean;
};

export type PacketChoiceFeelResult = {
  readonly intent: PacketChoiceIntent;
  readonly committed: boolean;
  readonly reason: "tap-preserves-seal" | "hold-breaks-seal" | "drift-cancels" | "still-deciding";
};

export const DEFAULT_PACKET_CHOICE_FEEL: PacketChoiceFeelConfig = {
  tapCommitMs: 180,
  holdCommitMs: 620,
  driftCancelPx: 18,
  minimumDecisionGapMs: 320,
};

const assertFiniteNumber = (name: string, value: number) => {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite`);
  }
};

export const evaluatePacketChoiceFeel = (
  gesture: PacketChoiceGesture,
  config: PacketChoiceFeelConfig = DEFAULT_PACKET_CHOICE_FEEL,
): PacketChoiceFeelResult => {
  assertFiniteNumber("gesture.elapsedMs", gesture.elapsedMs);
  assertFiniteNumber("gesture.driftPx", gesture.driftPx);

  if (gesture.driftPx > config.driftCancelPx) {
    return {
      intent: "undecided",
      committed: false,
      reason: "drift-cancels",
    };
  }

  if (gesture.elapsedMs >= config.holdCommitMs) {
    return {
      intent: "opened",
      committed: true,
      reason: "hold-breaks-seal",
    };
  }

  if (gesture.released && gesture.elapsedMs <= config.tapCommitMs) {
    return {
      intent: "sealed",
      committed: true,
      reason: "tap-preserves-seal",
    };
  }

  return {
    intent: "undecided",
    committed: false,
    reason: "still-deciding",
  };
};

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

export const checkPacketChoiceFeel = (
  config: PacketChoiceFeelConfig = DEFAULT_PACKET_CHOICE_FEEL,
) => {
  assert(config.tapCommitMs > 0, "tap must have a positive commit window");
  assert(config.holdCommitMs > config.tapCommitMs, "hold must be slower than tap");
  assert(
    config.holdCommitMs - config.tapCommitMs >= config.minimumDecisionGapMs,
    "open-vs-preserve needs enough time separation to feel intentional",
  );
  assert(config.driftCancelPx >= 14, "drift cancel must forgive small thumb motion");
  assert(config.driftCancelPx <= 28, "drift cancel must not allow sloppy accidental holds");

  const tap = evaluatePacketChoiceFeel({ elapsedMs: config.tapCommitMs - 20, driftPx: 3, released: true }, config);
  assert(tap.intent === "sealed" && tap.committed, "quick tap should preserve the seal");

  const holdBeforeCommit = evaluatePacketChoiceFeel({ elapsedMs: config.holdCommitMs - 1, driftPx: 3, released: false }, config);
  assert(!holdBeforeCommit.committed, "hold must not open before the commit threshold");

  const hold = evaluatePacketChoiceFeel({ elapsedMs: config.holdCommitMs, driftPx: 3, released: false }, config);
  assert(hold.intent === "opened" && hold.committed, "intentional hold should open the packet");

  const drift = evaluatePacketChoiceFeel({ elapsedMs: config.holdCommitMs + 200, driftPx: config.driftCancelPx + 1, released: false }, config);
  assert(drift.intent === "undecided" && !drift.committed, "dragging away should cancel instead of opening");

  return true;
};

export const runPacketChoiceFeelChecks = () => checkPacketChoiceFeel();

checkPacketChoiceFeel();
