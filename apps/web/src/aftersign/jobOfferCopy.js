const FIRST_RUN_JOB = Object.freeze({
  id: "silt-stair-blue-seal",
  tone: "safe",
  offer: "One safe job. One blue seal. Bring both back intact.",
  actions: Object.freeze([
    Object.freeze({
      id: "carry-blue-packet",
      label: "Carry the blue packet",
      hint: "Io watches the seal, not your speed.",
      ariaLabel: "Carry the blue packet for Io",
    }),
  ]),
});

const TRUSTED_JOB = Object.freeze({
  id: "orra-pharmacy-receipt",
  tone: "trusted",
  offer: "You kept the seal once. I can risk wider work.",
  actions: Object.freeze([
    Object.freeze({
      id: "carry-pharmacy-receipt",
      label: "Carry the pharmacy receipt",
      hint: "A stranger door opens when Io trusts your hands.",
      ariaLabel: "Carry Saint Orra's pharmacy receipt",
    }),
    Object.freeze({
      id: "take-lit-stair",
      label: "Take the lit stair",
      hint: "Longer. Safer. Seen by everyone.",
      ariaLabel: "Take the long lit stair route",
    }),
  ]),
});

const DISTRUSTED_JOB = Object.freeze({
  id: "torn-receipt-return",
  tone: "narrowed",
  offer: "The seal opened. So the work narrows.",
  actions: Object.freeze([
    Object.freeze({
      id: "return-torn-receipt",
      label: "Return the torn receipt",
      hint: "Io can still use you. Not the same way.",
      ariaLabel: "Return the torn receipt to Io",
    }),
  ]),
});

function getPacketOutcome(memory = {}) {
  return memory.packetOutcome ?? memory.lastPacketOutcome ?? memory.firstPacketOutcome ?? null;
}

export function getAftersignJobOfferCopy(memory = {}) {
  const packetOutcome = getPacketOutcome(memory);

  if (packetOutcome === "delivered_sealed" || packetOutcome === "sealed") {
    return TRUSTED_JOB;
  }

  if (packetOutcome === "opened" || packetOutcome === "opened_packet") {
    return DISTRUSTED_JOB;
  }

  return FIRST_RUN_JOB;
}

export function getAftersignJobActionIds(memory = {}) {
  return getAftersignJobOfferCopy(memory).actions.map((action) => action.id);
}

export const aftersignJobOfferCopy = Object.freeze({
  firstRun: FIRST_RUN_JOB,
  trusted: TRUSTED_JOB,
  distrusted: DISTRUSTED_JOB,
});
