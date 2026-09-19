/**
 * Io's job-board heading makes the previous run legible before the player
 * chooses the next piece of work. The job buttons remain the mechanical proof.
 */
export const ioOfferHeading = (packetOutcome) => {
  if (packetOutcome === "sealed") return "You kept the seal. Take the harder work.";
  if (packetOutcome === "opened") return "You opened it. The work narrows.";
  return "One clean job. Start there.";
};
