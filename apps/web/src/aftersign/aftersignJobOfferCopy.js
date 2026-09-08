// AFTERSIGN — served job-offer copy.
// Consumed by aftersign/main.js when the packet-offered beat renders
// the live #offeredJobs surface. Keep this file small: it is player-
// visible copy, not a parallel job-selection engine.

const JOB_OFFER_COPY = Object.freeze({
  firstRun: Object.freeze({
    route: "blue rainline",
    risk: "sealed, short, watched",
  }),
  trusted: Object.freeze({
    route: "pharmacy receipt by the lit stair",
    risk: "wider work, cleaner name",
  }),
  opened: Object.freeze({
    route: "torn receipt by the dark cut",
    risk: "narrow work, debt carried",
  }),
});

const normalizePacketOutcome = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : null;

export function chooseAftersignJobOfferCopy({
  firstPacketOutcome = null,
  packetOpened = false,
  deliveredSealed = false,
} = {}) {
  const outcome = normalizePacketOutcome(firstPacketOutcome);
  if (packetOpened || outcome === "opened") {
    return JOB_OFFER_COPY.opened;
  }
  if (deliveredSealed || outcome === "sealed" || outcome === "delivered_sealed") {
    return JOB_OFFER_COPY.trusted;
  }
  return JOB_OFFER_COPY.firstRun;
}

export { JOB_OFFER_COPY as AFTERSIGN_JOB_OFFER_COPY };
