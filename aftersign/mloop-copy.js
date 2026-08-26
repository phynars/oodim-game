// AFTERSIGN — M-LOOP per-jobId authored copy layer.
//
// PR #1422. `computeOfferedJobs` (packages/aftersign/src/computeOfferedJobs.ts)
// already owns the SELECTION axis: which jobIds are offered given the
// player's durable memory (safe-default / completed / trusted / etc.).
// Its `IoJobOffer` shape carries `id`, `label`, `routeRisk` — enough to
// stamp the shipped button's visible text.
//
// What this module ADDS is the memory-gated ACTION axis: for each
// jobId, what is the M-LOOP action id the player's tap commits, and
// what `memoryGate` did that action id come from (fresh / returning /
// deep-recall)? The action id rides on `state.interaction.lastAction`
// as `${mloopAction.id}:${jobId}` so downstream consumers (memory
// facts, cross-slice analytics, the harness) can tell WHICH offer the
// player took AND under WHICH memory posture — one axis, no drift
// between the label the player saw and the fact the game records.
//
// Two seams:
//   • `selectMloopJobCopy(jobId, mloopMemory)` — returns `{ id, label }`.
//     `id` is the authored copy id (currently equal to `jobId` when
//     authored, otherwise the fallback "mloop-copy-default"); `label`
//     is a per-jobId short string used ONLY for accessibility
//     (`aria-label`) — the button's visible textContent still comes
//     from the `IoJobOffer` selector's `label · routeRisk risk`
//     format so the shipped e2e (`job-offers-played.spec.ts`) that
//     asserts that exact text stays green.
//
//   • `getMloopAvailableAction(jobId, mloopMemory)` — returns
//     `{ id, memoryGate, label }`. `id` is the action id stamped on
//     `data-mloop-job-id` and composed into `lastAction`;
//     `memoryGate` is the posture the id came from (fresh /
//     returning / deep-recall / default); `label` is the same short
//     ARIA-friendly string as above so a caller can pick one seam
//     without looking up the other.
//
// Pure. No DOM, no state, no timers — every input is passed by the
// caller. The served page consumes both exports inside `renderText()`'s
// offered-jobs render loop; the tap-driven e2e
// (`aftersign/e2e/mloop-job-copy-played.spec.ts`) plays through to
// `packet-offered`, taps a real `<button id="job-offer-*">`, and
// asserts the stamped `data-mloop-*` attributes and composed
// `lastAction` axis.

/** @typedef {Object} MloopMemory
 *  @property {string=} packetOutcome  — sealed / opened / unknown
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

// Per-jobId authored M-LOOP copy. Keys are `jobId`s from
// `packages/aftersign/src/computeOfferedJobs.ts` (SAFE_DEFAULT_JOB_ID
// + COMPLETED_JOB_IDS + TRUSTED_COURIER_JOB_IDS + GUARDED_JOB_IDS +
// FAILED_JOB_IDS).  Every jobId the selector can return is authored
// here so `selectMloopJobCopy` never falls through to the default
// under any completed / trusted / guarded / failed branch.
const MLOOP_JOB_COPY_BY_ID = Object.freeze({
  "job-safe-delivery": Object.freeze({
    id: "job-safe-delivery",
    label: "Safe delivery",
  }),
  "job-sealed-return": Object.freeze({
    id: "job-sealed-return",
    label: "Sealed return",
  }),
  "job-private-ledger": Object.freeze({
    id: "job-private-ledger",
    label: "Private ledger",
  }),
  "job-night-transfer": Object.freeze({
    id: "job-night-transfer",
    label: "Night transfer",
  }),
  "job-signed-receipt": Object.freeze({
    id: "job-signed-receipt",
    label: "Signed receipt",
  }),
  "job-low-risk-errand": Object.freeze({
    id: "job-low-risk-errand",
    label: "Low-risk errand",
  }),
  "job-redemption-route": Object.freeze({
    id: "job-redemption-route",
    label: "Redemption route",
  }),
});

const DEFAULT_JOB_COPY = Object.freeze({
  id: "mloop-copy-default",
  label: "Offered job",
});

// Per-jobId × memory-gate action authoring. Maps every jobId × gate
// to an action id (rides on `lastAction`) and a short accessible
// label. `default` is the fallback when the memory gate can't be
// inferred (no packetOutcome yet — the pre-first-delivery visit).
const MLOOP_ACTION_TABLE_BY_ID = Object.freeze({
  "job-safe-delivery": Object.freeze({
    default: { id: "mloop-safe-delivery-take", label: "Take the safe delivery" },
    fresh: { id: "mloop-safe-delivery-take", label: "Take the safe delivery" },
    returning: { id: "mloop-safe-delivery-again", label: "Take the safe delivery again" },
    "deep-recall": { id: "mloop-safe-delivery-again", label: "Take the safe delivery again" },
  }),
  "job-sealed-return": Object.freeze({
    default: { id: "mloop-sealed-return-accept", label: "Accept the sealed return" },
    fresh: { id: "mloop-sealed-return-accept", label: "Accept the sealed return" },
    returning: { id: "mloop-sealed-return-accept-again", label: "Accept the sealed return again" },
    "deep-recall": { id: "mloop-sealed-return-accept-again", label: "Accept the sealed return again" },
  }),
  "job-private-ledger": Object.freeze({
    default: { id: "mloop-private-ledger-carry", label: "Carry the private ledger" },
    fresh: { id: "mloop-private-ledger-carry", label: "Carry the private ledger" },
    returning: { id: "mloop-private-ledger-carry-again", label: "Carry the private ledger again" },
    "deep-recall": { id: "mloop-private-ledger-carry-again", label: "Carry the private ledger again" },
  }),
  "job-night-transfer": Object.freeze({
    default: { id: "mloop-night-transfer-take", label: "Take the night transfer" },
    fresh: { id: "mloop-night-transfer-take", label: "Take the night transfer" },
    returning: { id: "mloop-night-transfer-take-again", label: "Take the night transfer again" },
    "deep-recall": { id: "mloop-night-transfer-take-again", label: "Take the night transfer again" },
  }),
  "job-signed-receipt": Object.freeze({
    default: { id: "mloop-signed-receipt-take", label: "Take the signed-receipt run" },
    fresh: { id: "mloop-signed-receipt-take", label: "Take the signed-receipt run" },
    returning: { id: "mloop-signed-receipt-take-again", label: "Take the signed-receipt run again" },
    "deep-recall": { id: "mloop-signed-receipt-take-again", label: "Take the signed-receipt run again" },
  }),
  "job-low-risk-errand": Object.freeze({
    default: { id: "mloop-low-risk-errand-take", label: "Take the low-risk errand" },
    fresh: { id: "mloop-low-risk-errand-take", label: "Take the low-risk errand" },
    returning: { id: "mloop-low-risk-errand-take-again", label: "Take the low-risk errand again" },
    "deep-recall": { id: "mloop-low-risk-errand-take-again", label: "Take the low-risk errand again" },
  }),
  "job-redemption-route": Object.freeze({
    default: { id: "mloop-redemption-route-take", label: "Take the redemption route" },
    fresh: { id: "mloop-redemption-route-take", label: "Take the redemption route" },
    returning: { id: "mloop-redemption-route-take-again", label: "Take the redemption route again" },
    "deep-recall": { id: "mloop-redemption-route-take-again", label: "Take the redemption route again" },
  }),
});

const DEFAULT_ACTION = Object.freeze({
  id: "mloop-take",
  memoryGate: "default",
  label: "Take the offered job",
});

/**
 * Derive the memory gate from an `MloopMemory` shape. Kept exported-
 * shape-free (an internal helper) so the two public seams share one
 * rule: a delivery outcome is known → returning; the outcome is
 * `opened` → deep-recall (the player already saw inside); no outcome
 * → fresh/default.
 *
 * @param {MloopMemory | null | undefined} mloopMemory
 * @returns {MloopMemoryGate}
 */
function memoryGateFor(mloopMemory) {
  if (!mloopMemory || typeof mloopMemory !== "object") return "default";
  const outcome = mloopMemory.packetOutcome;
  if (outcome === "opened") return "deep-recall";
  if (outcome === "sealed") return "returning";
  return "fresh";
}

/**
 * Per-jobId authored copy for the M-LOOP offered-jobs surface.
 *
 * @param {string} jobId
 * @param {MloopMemory | null | undefined} _mloopMemory  — unused today;
 *   reserved so a future authoring pass can vary the LABEL (not the
 *   action id) by memory posture without breaking the seam's arity.
 * @returns {MloopJobCopy}
 */
export function selectMloopJobCopy(jobId, _mloopMemory) {
  if (typeof jobId !== "string") return DEFAULT_JOB_COPY;
  return MLOOP_JOB_COPY_BY_ID[jobId] ?? DEFAULT_JOB_COPY;
}

/**
 * Per-jobId × memory-gate action authoring for the M-LOOP offered-
 * jobs surface. The returned `id` rides on `state.interaction.
 * lastAction` as `${id}:${jobId}` so downstream consumers can read
 * BOTH the mloop action id AND the underlying offered jobId off one
 * axis — no drift between the label the player saw and the fact the
 * game records.
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

// Exposed for tests + downstream consumers that want to enumerate
// the authored jobIds without probing internal shape.
export const MLOOP_JOB_COPY_IDS = Object.freeze(Object.keys(MLOOP_JOB_COPY_BY_ID));
