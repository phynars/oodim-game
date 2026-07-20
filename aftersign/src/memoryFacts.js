// Memory-fact builders for the AFTERSIGN slice.
//
// Two durable facts land in `state.npcs.io.memory` after delivery
// (issue #736 M2-E1):
//
//   1. delivery-outcome — the packet-outcome fact (sealed | opened).
//      Paraphrased in Io's return-line, so its id appears in
//      `npcs.io.lastLineMemoryRefs` (npc-memory-roundtrip.spec.ts).
//
//   2. route-attention — the player's deliberate SECOND kiosk action
//      (done | skipped). Durable, but NOT spoken by Io's line, so its
//      id must NOT appear in lastLineMemoryRefs.
//
// The second-action value is a REAL player choice recorded on
// `state.player.secondAction` BEFORE delivery (via the
// "acknowledge-kiosk" ChoiceId, aftersign/index.html). It is not
// derived from the beat — deliverPacket() always mints while
// beat === "packet-choice", which would leave SKIPPED unreachable
// and turn the fact into a constant stamped at delivery time.
// Passing the flag through explicitly keeps this a genuine
// two-branch player input.

export const SECOND_ACTION = {
  DONE: "done",
  SKIPPED: "skipped",
};

/** Normalize a raw player-input flag (may be `null` / `undefined` /
 *  anything else) into one of the two contract values. */
export const normalizeSecondAction = (value) => (
  value === SECOND_ACTION.DONE ? SECOND_ACTION.DONE : SECOND_ACTION.SKIPPED
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
