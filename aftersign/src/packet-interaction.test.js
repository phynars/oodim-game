import {
  PACKET_INTERACTION_OUTCOME,
  applyPacketFeedback,
  feedbackForPacketOutcome,
  registerPacketChoice,
} from "./packet-interaction.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

export const runPacketInteractionChecks = () => {
  const sealed = registerPacketChoice({
    packet: { sealed: false, delivered: false },
    outcome: PACKET_INTERACTION_OUTCOME.SEALED,
  });
  assert(sealed.accepted, "sealed choice is accepted");
  assert(sealed.packet.sealed === true, "sealed choice closes packet");
  assert(sealed.choiceId === "packet-sealed", "sealed choice has action id");
  assert(sealed.feedback.state === "success", "sealed choice succeeds");

  const opened = registerPacketChoice({
    packet: { sealed: true },
    outcome: PACKET_INTERACTION_OUTCOME.OPENED,
  });
  assert(opened.packet.sealed === false, "opened choice opens packet");

  const invalid = registerPacketChoice({ packet: { sealed: true }, outcome: "bad" });
  assert(!invalid.accepted, "invalid outcome is rejected");
  assert(invalid.packet.sealed === true, "invalid outcome preserves packet");

  const firstFailure = feedbackForPacketOutcome(
    PACKET_INTERACTION_OUTCOME.CANCELLED,
    PACKET_INTERACTION_OUTCOME.UNKNOWN,
  );
  const repeatedFailure = feedbackForPacketOutcome(
    PACKET_INTERACTION_OUTCOME.CANCELLED,
    PACKET_INTERACTION_OUTCOME.CANCELLED,
  );
  assert(firstFailure.shouldTriggerFailure, "cancel transition triggers feedback once");
  assert(!repeatedFailure.shouldTriggerFailure, "repeated cancel does not replay feedback");

  let copy = null;
  let failures = 0;
  applyPacketFeedback(firstFailure, {
    applyButtonCopy: (next) => { copy = next; },
    triggerFailure: () => { failures += 1; },
  });
  assert(copy === null, "failure does not overwrite button copy");
  assert(failures === 1, "failure writer receives transition");
};
