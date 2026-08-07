// Plain-TS check bundle for aftersign/src/packetChoiceIntent.ts.
// No top-level invocation: aftersign/pure-runner.ts owns execution.

import {
  DEFAULT_PACKET_CHOICE_INTENT_TUNING,
  checkPacketChoiceIntent,
  classifyPacketChoiceIntent,
} from "./packetChoiceIntent.ts";

const checkThresholds = (): void => {
  const tuning = DEFAULT_PACKET_CHOICE_INTENT_TUNING;

  const justBeforeOpen = classifyPacketChoiceIntent({
    pressDurationMs: tuning.holdOpenMinMs - 1,
    movementPixels: 0,
    startedOnPacket: true,
  });
  if (justBeforeOpen.kind !== "preserve-seal") {
    throw new Error("packet must stay sealed until the full hold threshold is crossed");
  }

  const atOpenThreshold = classifyPacketChoiceIntent({
    pressDurationMs: tuning.holdOpenMinMs,
    movementPixels: 0,
    startedOnPacket: true,
  });
  if (atOpenThreshold.kind !== "open-packet") {
    throw new Error("packet must open at the deliberate hold threshold");
  }
};

const checkMovementDeadZone = (): void => {
  const tuning = DEFAULT_PACKET_CHOICE_INTENT_TUNING;

  const onDeadZoneEdge = classifyPacketChoiceIntent({
    pressDurationMs: tuning.holdOpenMinMs,
    movementPixels: tuning.movementCancelPixels,
    startedOnPacket: true,
  });
  if (onDeadZoneEdge.kind !== "open-packet") {
    throw new Error("movement exactly on the dead-zone edge should still allow intent");
  }

  const pastDeadZone = classifyPacketChoiceIntent({
    pressDurationMs: tuning.holdOpenMinMs,
    movementPixels: tuning.movementCancelPixels + 0.1,
    startedOnPacket: true,
  });
  if (pastDeadZone.kind !== "cancel") {
    throw new Error("movement beyond the dead-zone must cancel packet intent");
  }
};

const checkBadTuningFails = (): void => {
  let rejectedBadTuning = false;
  try {
    classifyPacketChoiceIntent(
      { pressDurationMs: 100, movementPixels: 0, startedOnPacket: true },
      { tapPreserveMaxMs: 650, holdOpenMinMs: 220, movementCancelPixels: 18 },
    );
  } catch {
    rejectedBadTuning = true;
  }

  if (!rejectedBadTuning) {
    throw new Error("packet choice tuning must reject preserve/open threshold overlap");
  }
};

export const runPacketChoiceIntentChecks = (): void => {
  checkPacketChoiceIntent();
  checkThresholds();
  checkMovementDeadZone();
  checkBadTuningFails();
};
