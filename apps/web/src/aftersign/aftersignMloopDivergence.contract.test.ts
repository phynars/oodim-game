import { describe, expect, it } from "vitest";
import {
  COMPLETED_JOB_IDS,
  computeOfferedJobs,
  deriveOfferedJobsPlayerMemory,
  SAFE_DEFAULT_JOB_ID,
  selectIoJobOffers,
} from "../../../../packages/aftersign/src/computeOfferedJobs";
import {
  collectTappableJobOfferKeys,
  ioJobOffersDiverge,
} from "../../../../packages/aftersign/src/jobOfferActionFingerprint";

/**
 * Canonical M-LOOP boundary invariant.
 *
 * Keep this contract guard even when package-level unit tests are
 * reorganized. It intentionally repeats a small part of the primitive's
 * behavior because its job is different: prove the harness-shaped memory
 * bag that an app/window surface carries can cross the app→package seam via
 * `deriveOfferedJobsPlayerMemory` and change the offered job set a served
 * surface publishes.
 *
 * If this looks redundant with `packages/aftersign/src/computeOfferedJobs.test.ts`,
 * preserve this file as the boundary smoke test and move detailed branch
 * coverage there. This file should stay narrow: one fresh-session assertion,
 * one returning-player assertion, no new job-selection rules.
 *
 * Import path note: the repo does not yet expose an `@oodim/aftersign`
 * barrel — see `apps/web/src/aftersign/windowGameSurface.ts`, which uses
 * the same deep relative path. If/when a package barrel lands, swap all
 * three call sites together.
 */
describe("M-LOOP offered-job app/package boundary contract", () => {
  it("turns harness-shaped prior interaction memory into a non-default offered job set", () => {
    // Harness-shape input (what the window surface actually carries) must
    // cross the app→package boundary and yield the memory record that
    // `computeOfferedJobs` reads.
    const memory = deriveOfferedJobsPlayerMemory({
      playerName: "Player",
      interactionCount: 1,
    });

    expect(memory).toEqual({ priorOutcome: "completed" });
    expect(computeOfferedJobs(memory)).not.toEqual([SAFE_DEFAULT_JOB_ID]);
    expect(computeOfferedJobs(memory)).toEqual([...COMPLETED_JOB_IDS]);
  });

  it("keeps absent harness memory on the safe-default offered job", () => {
    // Absent harness memory must not fabricate divergence — the primitive
    // falls through to `[SAFE_DEFAULT_JOB_ID]` and the derivation returns
    // `undefined` for a missing bag.
    expect(deriveOfferedJobsPlayerMemory(undefined)).toBeUndefined();
    expect(computeOfferedJobs(undefined)).toEqual([SAFE_DEFAULT_JOB_ID]);
  });

  // Founder amendment 2026-08-22: "element-level, not text-level".
  // The id-list equality checks above are necessary but not sufficient
  // for the M-LOOP metric — they would still pass if a rebalance moved
  // an offer's risk tier without renaming it. The fingerprint primitive
  // (`ioJobOffersDiverge`) is the load-bearing predicate; wiring it
  // here makes the boundary contract a live consumer of it, so a
  // silent unwire goes red at the served-surface seam.
  it("proves memory-driven divergence at the tappable-action fingerprint level", () => {
    const freshOffers = selectIoJobOffers(undefined);
    const returningOffers = selectIoJobOffers(
      deriveOfferedJobsPlayerMemory({
        playerName: "Player",
        interactionCount: 1,
      }),
    );

    // The fingerprint predicate agrees with the id-list evidence above.
    expect(ioJobOffersDiverge(freshOffers, returningOffers)).toBe(true);

    // And the semantic keys — id + risk tier — are what actually
    // differ, so a copy-only relabel of either side would NOT flip
    // this to green.
    const freshKeys = collectTappableJobOfferKeys(freshOffers);
    const returningKeys = collectTappableJobOfferKeys(returningOffers);
    expect(returningKeys).not.toEqual(freshKeys);
    expect(freshKeys).toEqual([`${SAFE_DEFAULT_JOB_ID}#low`]);
  });

  it("diverges at the fingerprint level for a debt-held save vs a fresh save", () => {
    // Third mechanical axis — a durable wax-seal debt carried in
    // from a prior loop must swap the tappable action set at the
    // served surface, not just relabel the safe-default offer.
    // The fingerprint predicate is the load-bearing check ("id +
    // route-risk", label ignored), so if this ever goes green
    // without the debt-held branch actually landing in
    // `computeOfferedJobs`, the boundary is broken.
    const freshOffers = selectIoJobOffers(undefined);
    const debtHeldOffers = selectIoJobOffers({ debtHeld: 1 });

    expect(ioJobOffersDiverge(freshOffers, debtHeldOffers)).toBe(true);

    const freshKeys = collectTappableJobOfferKeys(freshOffers);
    const debtHeldKeys = collectTappableJobOfferKeys(debtHeldOffers);
    expect(debtHeldKeys).not.toEqual(freshKeys);
    expect(debtHeldKeys).toEqual(["job-wax-debt-repair#medium"]);
  });

  it("keeps the fingerprint predicate stable for a copy-only label edit", () => {
    // Guard against the failure mode the founder's bar rules out:
    // "dialogue-only differences score zero". A relabel of every
    // offer must NOT flip `ioJobOffersDiverge` to true.
    const offers = selectIoJobOffers({ priorOutcome: "completed" });
    const relabeled = offers.map((offer) => ({
      ...offer,
      label: `${offer.label} (revised)`,
    }));
    expect(ioJobOffersDiverge(offers, relabeled)).toBe(false);
  });
});
