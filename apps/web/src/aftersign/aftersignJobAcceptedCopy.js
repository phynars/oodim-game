// Io's job-acceptance acknowledgement line — the beat Io speaks the
// instant a player taps `#job-offer-<jobId>` at `packet-offered`.
//
// This module owns acknowledgement dialogue only. The offered packet label
// and route-choice labels are authored by the next-job offer-copy selector;
// keeping that boundary explicit prevents an acceptance acknowledgement from
// being mistakenly used as the source of a selectable route.

const JOB_ACCEPTED_LINE_BY_JOB_ID = Object.freeze({
  "job-safe-delivery":
    "The lit stair, then. Keep the seal closed. I will remember you as careful.",
  "job-sealed-return":
    "Take it back sealed. If the box refuses it, bring the refusal to me. I remember who kept faith.",
  "job-private-ledger":
    "A private ledger leaves no clean hands. Bring yours back. I remember what you chose to carry.",
  "job-night-transfer":
    "Cross after the bell. Do not mistake the quiet for permission. I will remember you took the dark.",
  "job-signed-receipt":
    "Get it in ink. A promise is lighter when someone has to carry it. I remember who made it answer.",
  "job-low-risk-errand":
    "Stay where the light can find you. Bring back what it lets you keep. I remember caution.",
  "job-redemption-route":
    "Pay it back. The account is still open because I left it open. I remember who returned.",
});

const DEFAULT_LINE =
  "Take the job. Keep the return open — I will remember what you bring back.";

export const AFTERSIGN_JOB_ACCEPTED_COPY = JOB_ACCEPTED_LINE_BY_JOB_ID;

/**
 * Return the acknowledgement line Io speaks the instant the player
 * commits to the given jobId. Unknown / non-string / missing jobId
 * falls back to the generic default — the beat still fires, no
 * template-token leak. Frozen table so a render caller cannot
 * mutate the copy under the frame.
 *
 * @param {unknown} jobId
 * @returns {string}
 */
export function aftersignJobAcceptedLine(jobId) {
  if (typeof jobId !== "string") return DEFAULT_LINE;
  return JOB_ACCEPTED_LINE_BY_JOB_ID[jobId] ?? DEFAULT_LINE;
}

// Exposed for tests that want to enumerate the authored jobIds
// without probing internal shape.
export const AFTERSIGN_JOB_ACCEPTED_JOB_IDS = Object.freeze(
  Object.keys(JOB_ACCEPTED_LINE_BY_JOB_ID),
);
