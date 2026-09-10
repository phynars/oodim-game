const FIRST_RUN_JOB = Object.freeze({
  state: "first-run",
  eyebrow: "Night Post work",
  offer: "One safe job. One blue seal. Bring both back intact.",
  route: "blue rainline",
  risk: "sealed, short, watched",
  actions: Object.freeze([
    Object.freeze({
      id: "carry-blue-packet",
      label: "Carry the blue packet",
      tone: "safe",
    }),
  ]),
});

const TRUSTED_JOB = Object.freeze({
  state: "trusted-seal",
  eyebrow: "Io widens the ledger",
  offer: "You kept the seal once. I can risk giving you a stranger door.",
  route: "pharmacy receipt by the lit stair",
  risk: "wider work, cleaner name",
  actions: Object.freeze([
    Object.freeze({
      id: "carry-pharmacy-receipt",
      label: "Carry the pharmacy receipt",
      tone: "trusted",
    }),
    Object.freeze({
      id: "take-lit-stair",
      label: "Take the lit stair",
      tone: "trusted-route",
    }),
  ]),
});

const DISTRUSTED_JOB = Object.freeze({
  state: "opened-seal",
  eyebrow: "Io narrows the work",
  offer: "The seal opened. So the work narrows.",
  route: "torn receipt by the dark cut",
  risk: "narrow work, debt carried",
  actions: Object.freeze([
    Object.freeze({
      id: "return-torn-receipt",
      label: "Return the torn receipt",
      tone: "debt",
    }),
  ]),
});

function normalizePacketOutcome(memory = {}) {
  const outcome = memory.packetOutcome ?? memory.packet_outcome ?? memory.lastPacketOutcome;
  if (outcome === "delivered_sealed" || outcome === "sealed" || outcome === "packet-sealed") {
    return "sealed";
  }
  if (outcome === "opened" || outcome === "opened_packet" || outcome === "packet-opened") {
    return "opened";
  }
  return "unknown";
}

export function chooseAftersignJobOfferCopy(memory = {}) {
  const packetOutcome = normalizePacketOutcome(memory);
  if (packetOutcome === "sealed") {
    return TRUSTED_JOB;
  }
  if (packetOutcome === "opened") {
    return DISTRUSTED_JOB;
  }
  return FIRST_RUN_JOB;
}
