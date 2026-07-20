export const SECOND_ACTION = {
  DONE: "done",
  SKIPPED: "skipped",
};

export const deriveSecondAction = (beat) => (
  beat === "packet-choice" ? SECOND_ACTION.DONE : SECOND_ACTION.SKIPPED
);

export const buildPacketOutcomeMemoryFact = ({ outcome, sessionId }) => ({
  id: `io-remembers-blue-packet-${outcome}`,
  kind: "delivery-outcome",
  subject: "player",
  predicate: "delivered-blue-packet",
  object: outcome,
  deliveryId: "blue-packet",
  sessionId,
  source: "server",
});

export const buildSecondActionMemoryFact = ({ secondAction, sessionId }) => ({
  id: `io-remembers-kiosk-second-action-${secondAction}`,
  kind: "route-attention",
  subject: "player",
  predicate: "kiosk-second-action",
  object: secondAction,
  sessionId,
  source: "server",
});

export const secondActionFromMemory = (memory = []) => {
  const fact = memory.find((entry) => entry.predicate === "kiosk-second-action");
  return fact?.object === SECOND_ACTION.DONE ? SECOND_ACTION.DONE : SECOND_ACTION.SKIPPED;
};

export const memoryRefsFromMemory = (memory = []) => {
  const packetOutcome = memory.find((entry) => entry.kind === "delivery-outcome")?.id ?? null;
  const secondAction = memory.find((entry) => entry.predicate === "kiosk-second-action")?.id ?? null;
  return { packetOutcome, secondAction };
};
