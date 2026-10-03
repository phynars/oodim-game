// Packet interaction is deliberately state-agnostic: callers provide the
// packet slice and receive the next slice plus presentation metadata. It does
// not import or mutate story, audio, movement, or offer-tray state.

export const PACKET_INTERACTION_OUTCOME = Object.freeze({
  SEALED: "sealed",
  OPENED: "opened",
  CANCELLED: "cancelled",
  UNKNOWN: "unknown",
});

const COMMITTED_OUTCOMES = new Set([
  PACKET_INTERACTION_OUTCOME.SEALED,
  PACKET_INTERACTION_OUTCOME.OPENED,
]);

export const isPacketInteractionOutcome = (outcome) =>
  typeof outcome === "string" && Object.values(PACKET_INTERACTION_OUTCOME).includes(outcome);

export const isCommittedPacketInteractionOutcome = (outcome) =>
  COMMITTED_OUTCOMES.has(outcome);

export const packetChoiceForOutcome = (outcome) => {
  if (outcome === PACKET_INTERACTION_OUTCOME.SEALED) return "packet-sealed";
  if (outcome === PACKET_INTERACTION_OUTCOME.OPENED) return "packet-opened";
  return null;
};

export const feedbackForPacketOutcome = (outcome, previousOutcome = null) => ({
  state: outcome === PACKET_INTERACTION_OUTCOME.CANCELLED ? "failure" :
    isCommittedPacketInteractionOutcome(outcome) ? "success" : "pending",
  shouldTriggerFailure:
    outcome === PACKET_INTERACTION_OUTCOME.CANCELLED
    && previousOutcome !== PACKET_INTERACTION_OUTCOME.CANCELLED,
  buttonCopy:
    outcome === PACKET_INTERACTION_OUTCOME.SEALED ? "sealed" :
      outcome === PACKET_INTERACTION_OUTCOME.OPENED ? "opened" : null,
});

export const registerPacketChoice = ({ packet, outcome }) => {
  const currentPacket = packet && typeof packet === "object" ? packet : null;
  if (!currentPacket || !isPacketInteractionOutcome(outcome)) {
    return { accepted: false, packet: currentPacket, choiceId: null, feedback: feedbackForPacketOutcome(PACKET_INTERACTION_OUTCOME.UNKNOWN) };
  }
  const choiceId = packetChoiceForOutcome(outcome);
  if (!choiceId) {
    return { accepted: false, packet: { ...currentPacket }, choiceId: null, feedback: feedbackForPacketOutcome(outcome) };
  }
  return {
    accepted: true,
    packet: { ...currentPacket, sealed: outcome === PACKET_INTERACTION_OUTCOME.SEALED },
    choiceId,
    feedback: feedbackForPacketOutcome(outcome),
  };
};

// The caller owns rendering. This helper only applies precomputed metadata to
// a supplied writer, keeping DOM operations non-authoritative and testable.
export const applyPacketFeedback = (feedback, { applyButtonCopy, triggerFailure } = {}) => {
  if (!feedback || typeof feedback !== "object") return false;
  if (feedback.buttonCopy && typeof applyButtonCopy === "function") {
    applyButtonCopy(feedback.buttonCopy);
  }
  if (feedback.shouldTriggerFailure && typeof triggerFailure === "function") {
    triggerFailure();
  }
  return true;
};
