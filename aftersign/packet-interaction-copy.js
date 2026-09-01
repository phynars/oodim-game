export const packetInteractionCopy = {
  idle: {
    buttonLabel: "Blue packet",
    hint: "Tap to keep the seal. Hold and pull to break it.",
    ariaLabel: "Blue packet. Tap to keep the seal. Hold and pull to break it.",
  },
  sealed: {
    buttonLabel: "Seal intact",
    hint: "Io can trust the work wider now.",
    ariaLabel: "Seal intact. Io can trust the work wider now.",
  },
  opened: {
    buttonLabel: "Seal broken",
    hint: "Io can still use you. Not the same way.",
    ariaLabel: "Seal broken. Io can still use you. Not the same way.",
  },
};

export function getPacketInteractionCopy(packetOutcome) {
  if (packetOutcome === "delivered_sealed" || packetOutcome === "sealed") {
    return packetInteractionCopy.sealed;
  }

  if (packetOutcome === "opened") {
    return packetInteractionCopy.opened;
  }

  return packetInteractionCopy.idle;
}
