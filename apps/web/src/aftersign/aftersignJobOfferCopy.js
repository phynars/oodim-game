const FIRST_RUN_OFFER = Object.freeze({
  state: "first-run",
  eyebrow: "Night Post job",
  offer: "One safe job. One blue seal. Bring both back intact.",
  route: "blue rainline",
  risk: "sealed, short, watched",
  actions: Object.freeze([
    Object.freeze({
      id: "carry-blue-packet",
      label: "Carry the blue packet",
      detail: "A first run with Io watching the seal.",
    }),
  ]),
});

const TRUSTED_OFFER = Object.freeze({
  state: "trusted-seal",
  eyebrow: "Wider work",
  offer: "You kept the seal once. I can risk giving you a stranger door.",
  route: "pharmacy receipt by the lit stair",
  risk: "wider work, cleaner name",
  actions: Object.freeze([
    Object.freeze({
      id: "carry-pharmacy-receipt",
      label: "Carry the pharmacy receipt",
      detail: "Orra's paper, clean enough to cross the lit stair.",
    }),
    Object.freeze({
      id: "take-lit-stair",
      label: "Take the lit stair",
      detail: "Longer route. Fewer debts waiting in the dark.",
    }),
  ]),
});

const DISTRUSTED_OFFER = Object.freeze({
  state: "opened-seal",
  eyebrow: "Narrow work",
  offer: "The seal opened. So the work narrows.",
  route: "torn receipt by the dark cut",
  risk: "narrow work, debt carried",
  actions: Object.freeze([
    Object.freeze({
      id: "return-torn-receipt",
      label: "Return the torn receipt",
      detail: "A short job for hands Io is still counting.",
    }),
  ]),
});

const TRUSTED_PACKET_OUTCOMES = new Set([
  "sealed",
  "delivered_sealed",
  "kept_sealed",
  "packet_sealed",
]);

const DISTRUSTED_PACKET_OUTCOMES = new Set([
  "opened",
  "opened_packet",
  "packet_opened",
  "seal_broken",
]);

function readPacketOutcome(memory = {}) {
  return String(
    memory.packetOutcome ??
      memory.lastPacketOutcome ??
      memory.deliveryOutcome ??
      memory.firstPacketOutcome ??
      ""
  ).toLowerCase();
}

export function chooseAftersignJobOfferCopy(memory = {}) {
  const packetOutcome = readPacketOutcome(memory);

  if (TRUSTED_PACKET_OUTCOMES.has(packetOutcome)) {
    return TRUSTED_OFFER;
  }

  if (DISTRUSTED_PACKET_OUTCOMES.has(packetOutcome)) {
    return DISTRUSTED_OFFER;
  }

  return FIRST_RUN_OFFER;
}

export const aftersignJobOfferCopy = Object.freeze({
  firstRun: FIRST_RUN_OFFER,
  trusted: TRUSTED_OFFER,
  distrusted: DISTRUSTED_OFFER,
});
