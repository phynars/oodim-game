// Packet choice intent primitives for AFTERSIGN's first player action.
//
// Goal: opening the blue packet must be a deliberate hold, not an accidental
// tap or drag while navigating. Keeping the seal is the low-friction default;
// breaking it requires sustained intent inside a small movement dead-zone.

export type PacketChoiceIntentKind = "preserve-seal" | "open-packet" | "cancel";

export type PacketChoiceInput = {
  pressDurationMs: number;
  movementPixels: number;
  startedOnPacket: boolean;
};

export type PacketChoiceIntentTuning = {
  tapPreserveMaxMs: number;
  holdOpenMinMs: number;
  movementCancelPixels: number;
};

export type PacketChoiceIntent = {
  kind: PacketChoiceIntentKind;
  confidence: number;
  reason: string;
};

export const DEFAULT_PACKET_CHOICE_INTENT_TUNING: PacketChoiceIntentTuning = {
  tapPreserveMaxMs: 220,
  holdOpenMinMs: 650,
  movementCancelPixels: 18,
};

const assertFiniteNonNegative = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number`);
  }
};

const assertTuning = (tuning: PacketChoiceIntentTuning): void => {
  assertFiniteNonNegative(tuning.tapPreserveMaxMs, "tapPreserveMaxMs");
  assertFiniteNonNegative(tuning.holdOpenMinMs, "holdOpenMinMs");
  assertFiniteNonNegative(tuning.movementCancelPixels, "movementCancelPixels");
  if (tuning.tapPreserveMaxMs >= tuning.holdOpenMinMs) {
    throw new Error("tapPreserveMaxMs must be lower than holdOpenMinMs");
  }
};

const confidenceFromRatio = (value: number): number =>
  Number(Math.max(0, Math.min(1, value)).toFixed(3));

export const classifyPacketChoiceIntent = (
  input: PacketChoiceInput,
  tuning: PacketChoiceIntentTuning = DEFAULT_PACKET_CHOICE_INTENT_TUNING,
): PacketChoiceIntent => {
  assertTuning(tuning);
  assertFiniteNonNegative(input.pressDurationMs, "pressDurationMs");
  assertFiniteNonNegative(input.movementPixels, "movementPixels");

  if (!input.startedOnPacket) {
    return {
      kind: "cancel",
      confidence: 1,
      reason: "gesture did not begin on the packet",
    };
  }

  if (input.movementPixels > tuning.movementCancelPixels) {
    return {
      kind: "cancel",
      confidence: confidenceFromRatio(input.movementPixels / tuning.movementCancelPixels),
      reason: "gesture moved outside the packet intent dead-zone",
    };
  }

  if (input.pressDurationMs >= tuning.holdOpenMinMs) {
    return {
      kind: "open-packet",
      confidence: confidenceFromRatio(input.pressDurationMs / tuning.holdOpenMinMs),
      reason: "sustained hold broke the seal deliberately",
    };
  }

  return {
    kind: "preserve-seal",
    confidence: confidenceFromRatio(
      1 - input.pressDurationMs / tuning.holdOpenMinMs,
    ),
    reason:
      input.pressDurationMs <= tuning.tapPreserveMaxMs
        ? "quick packet tap kept the seal intact"
        : "hold released before the opening threshold",
  };
};

export const checkPacketChoiceIntent = (
  tuning: PacketChoiceIntentTuning = DEFAULT_PACKET_CHOICE_INTENT_TUNING,
): void => {
  const quickTap = classifyPacketChoiceIntent(
    { pressDurationMs: 90, movementPixels: 2, startedOnPacket: true },
    tuning,
  );
  if (quickTap.kind !== "preserve-seal") {
    throw new Error("a quick packet tap must preserve the seal");
  }

  const deliberateHold = classifyPacketChoiceIntent(
    {
      pressDurationMs: tuning.holdOpenMinMs + 80,
      movementPixels: 4,
      startedOnPacket: true,
    },
    tuning,
  );
  if (deliberateHold.kind !== "open-packet") {
    throw new Error("a sustained packet hold must open the packet");
  }

  const navigationDrag = classifyPacketChoiceIntent(
    {
      pressDurationMs: tuning.holdOpenMinMs + 120,
      movementPixels: tuning.movementCancelPixels + 1,
      startedOnPacket: true,
    },
    tuning,
  );
  if (navigationDrag.kind !== "cancel") {
    throw new Error("movement past the dead-zone must cancel packet choice intent");
  }

  const offPacket = classifyPacketChoiceIntent(
    { pressDurationMs: tuning.holdOpenMinMs + 80, movementPixels: 0, startedOnPacket: false },
    tuning,
  );
  if (offPacket.kind !== "cancel") {
    throw new Error("off-packet holds must not mutate packet state");
  }
};
