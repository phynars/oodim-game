export const AFTERSIGN_PACKET_INTERACTION_COPY = Object.freeze({
  idle: Object.freeze({
    label: "Blue packet",
    hint: "Tap to keep the seal. Hold and pull to break it.",
    ariaLabel: "Blue packet. Tap to keep the seal. Hold and pull to break it.",
  }),
  sealed: Object.freeze({
    label: "Seal intact.",
    hint: "Io can trust the work wider now.",
    ariaLabel: "Seal intact. Io can trust the work wider now.",
  }),
  opened: Object.freeze({
    label: "Seal broken.",
    hint: "Io can still use you. Not the same way.",
    ariaLabel: "Seal broken. Io can still use you. Not the same way.",
  }),
});

export function getAftersignPacketInteractionCopy(packetOutcome) {
  if (packetOutcome === "delivered_sealed" || packetOutcome === "sealed") {
    return AFTERSIGN_PACKET_INTERACTION_COPY.sealed;
  }

  if (packetOutcome === "opened") {
    return AFTERSIGN_PACKET_INTERACTION_COPY.opened;
  }

  return AFTERSIGN_PACKET_INTERACTION_COPY.idle;
}
