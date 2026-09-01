const PACKET_INTERACTION_COPY = Object.freeze({
  idle: Object.freeze({
    label: "Blue packet",
    hint: "Tap to keep the seal. Hold and pull to break it.",
  }),
  sealed: Object.freeze({
    label: "Seal intact.",
    hint: "Io can trust the work wider now.",
  }),
  opened: Object.freeze({
    label: "Seal broken.",
    hint: "Io can still use you. Not the same way.",
  }),
});

function normalizePacketOutcome(packetOutcome) {
  if (packetOutcome === "delivered_sealed" || packetOutcome === "sealed") {
    return "sealed";
  }

  if (packetOutcome === "opened") {
    return "opened";
  }

  return "idle";
}

export function getPacketInteractionCopy(memory = {}) {
  const key = normalizePacketOutcome(memory.packetOutcome);
  return PACKET_INTERACTION_COPY[key];
}

export { PACKET_INTERACTION_COPY };
