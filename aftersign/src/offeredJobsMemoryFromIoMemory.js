// AFTERSIGN — derive `OfferedJobsPlayerMemory` from Io's durable
// memory-fact stream for the SERVED page.
//
// Why this module exists (PR #1624, Soren's third REQUEST_CHANGES):
//   The served renderer in `aftersign/main.js` was collapsing Io's
//   entire memory stream into one signal:
//
//     const offeredJobsMemory = state.npcs.io.memory.length > 0
//       ? { priorOutcome: "completed" }
//       : undefined;
//
//   That mints ONLY the `priorOutcome:"completed"` axis of the
//   `PlayerMemory` shape from `packages/aftersign/src/computeOfferedJobs.ts`,
//   so the served surface could NEVER reach the debt-held branch —
//   any player who had ever delivered a packet, sealed OR opened,
//   was routed to the completed set. That defeated the whole point
//   of the third mechanical axis Ivy added to the primitive.
//
// The rule this module enforces on the served page (matches the
// primitive's override order in `selectedJobIds`):
//
//   - Any DELIVERY_OUTCOME fact with `object === "sealed"` in Io's
//     memory → `{ priorOutcome: "completed" }`. A player who has
//     ever cleanly closed a loop is a completed courier; a stale
//     wax debt from an even-earlier opened packet does not demote
//     them (the primitive's override order says so — trusted /
//     completed rank above debt-held).
//
//   - Otherwise, any DELIVERY_OUTCOME fact with `object === "opened"`
//     → `{ debtHeld: <count of opened facts> }`. The player opened
//     a sealed packet on a prior loop and never redeemed it — the
//     debt-repair route is the mechanical answer. `debtHeld` is a
//     count (not a boolean) so a future extension can scale the
//     repair-run difficulty by the size of the debt without another
//     schema flip.
//
//   - Otherwise (empty memory, or memory that carries only non-
//     delivery-outcome facts like route-attention) → `undefined`.
//     The primitive's safe default lands.
//
// The count-of-opened path is what closes Soren's blocking gap:
// `resolveOfferedJobsMemory` in `windowGameSurface.ts` sees a
// `{ debtHeld: 1 }` bag, its guard (updated in the same PR) now
// includes `"debtHeld" in input`, so the bag rides through to
// `selectIoJobOffers` unchanged and the surface publishes the
// debt-repair offer. The served renderer stamps
// `#job-offer-job-wax-debt-repair` into the shipped `#offeredJobs`
// container, and a real tap on that button routes through the
// `offer-job-wax-debt-repair` tap-choice.
//
// Kept as a pure, testable module (no state, no DOM) so:
//   - `aftersign/main.js` imports and calls it once at
//     `packet-offered` render time.
//   - `apps/web/src/aftersign/offeredJobsDebtHeldServedSurface.consumer.test.ts`
//     imports and calls the EXACT same function to prove the served
//     path — no mirrored logic, no drift between test and runtime.
//   - The new e2e `aftersign/e2e/job-offer-debt-held-played.spec.ts`
//     plays through an opened-packet loop and taps the button that
//     lands because of THIS derivation.

import {
  NPC_MEMORY_FACT_KIND,
  NPC_MEMORY_OBJECT,
} from "./npcMemoryFlagSchema.js";

/**
 * @typedef {import("../../packages/aftersign/src/computeOfferedJobs").PlayerMemory} OfferedJobsPlayerMemory
 */

/**
 * Count delivery-outcome facts of a given `object` value in Io's
 * memory stream. Non-array / null / undefined memory folds to zero
 * (defensive — the served state is trusted, but a fresh boot with
 * an empty save can reach this before `state.npcs.io.memory` is
 * populated).
 *
 * @param {Array<{ kind?: string, object?: string }> | null | undefined} memory
 * @param {string} object
 * @returns {number}
 */
function countDeliveryOutcomes(memory, object) {
  if (!Array.isArray(memory)) return 0;
  let count = 0;
  for (const fact of memory) {
    if (
      fact
      && fact.kind === NPC_MEMORY_FACT_KIND.DELIVERY_OUTCOME
      && fact.object === object
    ) {
      count += 1;
    }
  }
  return count;
}

/**
 * Map Io's durable memory-fact stream to the `PlayerMemory` bag the
 * primitive `selectIoJobOffers` consumes. See the module header for
 * the rule the branches encode.
 *
 * Returns `undefined` for "no signal — safe default"; the served
 * renderer passes the value straight to `selectIoJobOffers` and the
 * primitive handles the undefined branch.
 *
 * @param {Array<{ kind?: string, object?: string }> | null | undefined} memory
 * @returns {OfferedJobsPlayerMemory | undefined}
 */
export function offeredJobsMemoryFromIoMemory(memory) {
  const sealedCount = countDeliveryOutcomes(memory, NPC_MEMORY_OBJECT.PACKET_SEALED);
  if (sealedCount > 0) {
    // Completed override — a proven courier isn't demoted by a
    // stale wax debt they've since worked off (matches the primitive
    // override order in `selectedJobIds`).
    return { priorOutcome: "completed" };
  }
  const openedCount = countDeliveryOutcomes(memory, NPC_MEMORY_OBJECT.PACKET_OPENED);
  if (openedCount > 0) {
    return { debtHeld: openedCount };
  }
  return undefined;
}
