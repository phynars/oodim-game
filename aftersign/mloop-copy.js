// AFTERSIGN — M-LOOP per-jobId authored copy layer.
//
// `computeOfferedJobs` owns which jobs appear from durable memory. This
// module gives each offered job an accessible name and records the memory
// posture behind the player's committed action.

/** @typedef {Object} MloopMemory
 *  @property {string=} packetOutcome — sealed / opened / unknown.
 */

/** @typedef {"fresh"|"returning"|"deep-recall"|"default"} MloopMemoryGate */

/** @typedef {Object} MloopJobCopy
 *  @property {string} id
 *  @property {string} label
 */

/** @typedef {Object} MloopAvailableAction
 *  @property {string} id
 *  @property {MloopMemoryGate} memoryGate
 *  @property {string} label
 */

// The visible offer still comes from `IoJobOffer`. These short labels are
// exposed to assistive technology, where the choice needs its own stake.
const MLOOP_JOB_COPY_BY_ID = Object.freeze({
  "job-safe-delivery": Object.freeze({
    id: "job-safe-delivery",
    label: "The lit stair",
  }),
  "job-sealed-return": Object.freeze({
    id: "job-sealed-return",
    label: "Bring it back closed",
  }),
  "job-private-ledger": Object.freeze({
    id: "job-private-ledger",
    label: "Carry the private ledger",
  }),
  "job-night-transfer": Object.freeze({
    id: "job-night-transfer",
    label: "Cross after the bell",
  }),
  "job-signed-receipt": Object.freeze({
    id: "job-signed-receipt",
    label: "Get it in ink",
  }),
  "job-low-risk-errand": Object.freeze({
    id: "job-low-risk-errand",
    label: "Keep to the light",
  }),
  "job-redemption-route": Object.freeze({
    id: "job-redemption-route",
    label: "Pay it back",
  }),
});

const DEFAULT_JOB_COPY = Object.freeze({
  id: "mloop-copy-default",
  label: "The job waiting for you",
});

const MLOOP_ACTION_TABLE_BY_ID = Object.freeze({
  "job-safe-delivery": Object.freeze({
    default: { id: "mloop-safe-delivery-take", label: "Take the lit stair" },
    fresh: { id: "mloop-safe-delivery-take", label: "Take the lit stair" },
    returning: { id: "mloop-safe-delivery-again", label: "Take the lit stair again" },
    "deep-recall": { id: "mloop-safe-delivery-again", label: "Take the lit stair again" },
  }),
  "job-sealed-return": Object.freeze({
    default: { id: "mloop-sealed-return-accept", label: "Bring it back closed" },
    fresh: { id: "mloop-sealed-return-accept", label: "Bring it back closed" },
    returning: { id: "mloop-sealed-return-accept-again", label: "Bring it back closed again" },
    "deep-recall": { id: "mloop-sealed-return-accept-again", label: "Bring it back closed again" },
  }),
  "job-private-ledger": Object.freeze({
    default: { id: "mloop-private-ledger-carry", label: "Carry the private ledger" },
    fresh: { id: "mloop-private-ledger-carry", label: "Carry the private ledger" },
    returning: { id: "mloop-private-ledger-carry-again", label: "Carry the private ledger again" },
    "deep-recall": { id: "mloop-private-ledger-carry-again", label: "Carry the private ledger again" },
  }),
  "job-night-transfer": Object.freeze({
    default: { id: "mloop-night-transfer-take", label: "Cross after the bell" },
    fresh: { id: "mloop-night-transfer-take", label: "Cross after the bell" },
    returning: { id: "mloop-night-transfer-take-again", label: "Cross after the bell again" },
    "deep-recall": { id: "mloop-night-transfer-take-again", label: "Cross after the bell again" },
  }),
  "job-signed-receipt": Object.freeze({
    default: { id: "mloop-signed-receipt-take", label: "Get it in ink" },
    fresh: { id: "mloop-signed-receipt-take", label: "Get it in ink" },
    returning: { id: "mloop-signed-receipt-take-again", label: "Get it in ink again" },
    "deep-recall": { id: "mloop-signed-receipt-take-again", label: "Get it in ink again" },
  }),
  "job-low-risk-errand": Object.freeze({
    default: { id: "mloop-low-risk-errand-take", label: "Keep to the light" },
    fresh: { id: "mloop-low-risk-errand-take", label: "Keep to the light" },
    returning: { id: "mloop-low-risk-errand-take-again", label: "Keep to the light again" },
    "deep-recall": { id: "mloop-low-risk-errand-take-again", label: "Keep to the light again" },
  }),
  "job-redemption-route": Object.freeze({
    default: { id: "mloop-redemption-route-take", label: "Pay it back" },
    fresh: { id: "mloop-redemption-route-take", label: "Pay it back" },
    returning: { id: "mloop-redemption-route-take-again", label: "Pay it back again" },
    "deep-recall": { id: "mloop-redemption-route-take-again", label: "Pay it back again" },
  }),
});

const DEFAULT_ACTION = Object.freeze({
  id: "mloop-take",
  memoryGate: "default",
  label: "Take the job waiting for you",
});

function memoryGateFor(mloopMemory) {
  if (!mloopMemory || typeof mloopMemory !== "object") return "default";
  const outcome = mloopMemory.packetOutcome;
  if (outcome === "opened") return "deep-recall";
  if (outcome === "sealed") return "returning";
  return "fresh";
}

/**
 * Per-jobId accessible copy for the offered-jobs surface.
 *
 * @param {string} jobId
 * @param {MloopMemory | null | undefined} _mloopMemory
 * @returns {MloopJobCopy}
 */
export function selectMloopJobCopy(jobId, _mloopMemory) {
  if (typeof jobId !== "string") return DEFAULT_JOB_COPY;
  return MLOOP_JOB_COPY_BY_ID[jobId] ?? DEFAULT_JOB_COPY;
}

/**
 * Return the action a job commits under the player's current memory posture.
 * The action id is composed with its job id by the served-page caller.
 *
 * @param {string} jobId
 * @param {MloopMemory | null | undefined} mloopMemory
 * @returns {MloopAvailableAction}
 */
export function getMloopAvailableAction(jobId, mloopMemory) {
  const gate = memoryGateFor(mloopMemory);
  if (typeof jobId !== "string") {
    return { ...DEFAULT_ACTION, memoryGate: gate };
  }
  const byGate = MLOOP_ACTION_TABLE_BY_ID[jobId];
  if (!byGate) {
    return { ...DEFAULT_ACTION, memoryGate: gate };
  }
  const row = byGate[gate] ?? byGate.default;
  return { id: row.id, memoryGate: gate, label: row.label };
}

export const MLOOP_JOB_COPY_IDS = Object.freeze(Object.keys(MLOOP_JOB_COPY_BY_ID));
