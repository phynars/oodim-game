// Io's round-to-round consequence copy — one line per remembered
// outcome, spoken alongside the next-job handoff. Story-first
// principle: the previous run has to leave a MARK on this run's
// language, not just a numeric flag. When the player accepts Io's
// next tag, Io names what the last run cost or preserved before
// she pushes the new work across the counter.
//
// Kept as a small pure surface (this file authors NO scene logic)
// so the copy stays legible to non-TS reviewers and the served-page
// consumer can project it onto `story.nextJob.offer.consequenceLine`
// without importing dialogue-authoring machinery.
//
// KEYED BY the vertical-slice `packetOutcome` axis — the same axis
// `chooseAftersignJobOfferCopy` narrows on. Three branches:
//
//   • "sealed"  — first run delivered the packet closed.
//   • "opened"  — first run broke the seal.
//   • "pending" — no first run on record (fresh boot).
//
// Any other value (or a missing outcome) falls through to the
// "pending" line — safe default, never throws, never shows a raw key.
//
// Consumers on record:
//   • `apps/web/src/aftersign/harness/bootWindowGame.ts`
//     (projects the line onto `story.nextJob.offer.consequenceLine`)
//   • `apps/web/src/aftersign/ioLoopConsequenceLine.consumer.test.ts`
//     (asserts each branch reaches the served snapshot).
//
// If a future refactor unwires the harness importer, the consumer
// spec above goes red — the copy stops being dead code the moment
// it's shipped.

const PENDING_LINE =
  "One run changes the next. Take the work in front of you.";

const COPY_BY_OUTCOME = Object.freeze({
  sealed:
    "You brought it back whole last time. I can risk your hands on wider work.",
  opened:
    "You opened the last one. So this is the work that remains — narrow, watched.",
  pending: PENDING_LINE,
});

/**
 * The frozen outcome→line table. Exported so a consumer test can
 * assert the harness projection matches the ground-truth strings
 * without re-authoring them.
 *
 * @type {Readonly<{ sealed: string; opened: string; pending: string }>}
 */
export const IO_LOOP_CONSEQUENCE_COPY = COPY_BY_OUTCOME;

/**
 * Select Io's round-to-round consequence line for the CURRENT
 * memory branch. Fresh boot (no packet outcome recorded) → the
 * neutral "pending" line. Sealed first delivery → the trust line.
 * Opened first delivery → the narrower "wax debt" acknowledgement.
 *
 * @param {"sealed" | "opened" | "pending" | string | null | undefined} packetOutcome
 * @returns {string}
 */
export function ioLoopConsequenceLine(packetOutcome) {
  if (packetOutcome === "sealed") return COPY_BY_OUTCOME.sealed;
  if (packetOutcome === "opened") return COPY_BY_OUTCOME.opened;
  return COPY_BY_OUTCOME.pending;
}
