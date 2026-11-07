/**
 * Authoritative player-visible copy for Io's next-job offer. The outcome comes
 * from the just-completed packet; an absent outcome represents the first run.
 */
const FIRST_RUN = Object.freeze({
  heading: "One clean job. Start there.",
  safeJobLabel: "Take the safe job",
  returnLine: "Bring it back sealed. We can talk when you're through.",
});

const TRUSTED_RUN = Object.freeze({
  heading: "You kept the seal. Take the harder work.",
  safeJobLabel: "Take another safe job",
  returnLine: "You kept the seal. I have another quiet route for you.",
});

const DISTRUSTED_RUN = Object.freeze({
  heading: "You opened it. The work narrows.",
  safeJobLabel: "Take the careful job",
  returnLine: "You opened it. This one stays in sight until you return.",
});

export const ioOfferCopyFor = (packetOutcome) => {
  if (packetOutcome === "sealed") return TRUSTED_RUN;
  if (packetOutcome === "opened") return DISTRUSTED_RUN;
  return FIRST_RUN;
};

export const ioOfferHeading = (packetOutcome) => ioOfferCopyFor(packetOutcome).heading;
