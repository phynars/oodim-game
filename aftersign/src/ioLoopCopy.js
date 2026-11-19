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

// Canonical acknowledgement copy for the job the player just accepted.
// Keyed by the job IDs the served page can actually offer: the
// `selectIoJobOffers(offeredJobsMemoryFromIoMemory(...))` path in
// main.js yields only safe-delivery (first visit) and night-transfer /
// signed-receipt (sealed history). The trusted-courier, guarded and
// failed offers (sealed-return, private-ledger, low-risk-errand,
// redemption-route) have no player route yet. Their lines come back
// with that route and a tap-driven spec in #2889. Until then those
// IDs get the generic acknowledgement.
const JOB_ACCEPTED_LINE_BY_JOB_ID = Object.freeze({
  "job-safe-delivery":
    "The lit stair, then. Keep the seal closed. Return with it whole; I will know you chose care.",
  "job-night-transfer":
    "Cross after the bell. Do not mistake the quiet for permission. When you return, I will remember that you chose the dark — and whether you let it choose your way home.",
  "job-signed-receipt":
    "Get it in ink. A promise is lighter when someone has to carry it. I remember who made it answer.",
});

const DEFAULT_JOB_ACCEPTED_LINE =
  "Take the job. Keep the return open — I will remember what you bring back.";

export const AFTERSIGN_JOB_ACCEPTED_COPY = JOB_ACCEPTED_LINE_BY_JOB_ID;

/**
 * Resolve Io's acknowledgement for a selected job. Unknown, missing, and
 * non-string IDs intentionally receive the generic acknowledgement.
 *
 * @param {unknown} jobId
 * @returns {string}
 */
export function aftersignJobAcceptedLine(jobId) {
  if (typeof jobId !== "string") return DEFAULT_JOB_ACCEPTED_LINE;
  return JOB_ACCEPTED_LINE_BY_JOB_ID[jobId] ?? DEFAULT_JOB_ACCEPTED_LINE;
}

export const AFTERSIGN_JOB_ACCEPTED_JOB_IDS = Object.freeze(
  Object.keys(JOB_ACCEPTED_LINE_BY_JOB_ID),
);
