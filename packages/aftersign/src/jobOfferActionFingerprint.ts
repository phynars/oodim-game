// M-LOOP divergence fingerprint.
//
// The founder's 2026-08-22 amendment names divergence — not dialogue,
// not recognition depth — as the milestone metric: two save-states
// with different memory records MUST produce different AVAILABLE
// ACTIONS on the served page. "Element-level, not text-level."
//
// This module gives the served surface + its acceptance tests a
// SINGLE primitive that answers "did the tappable action set
// actually diverge?" without falling for label-copy drift.
//
// Shape choice: we fingerprint `IoJobOffer[]` — the exact array the
// window surface publishes at `snapshot.story.offeredJobs` via
// `selectIoJobOffers()`. Any other shape would be an invented
// contract with no consumer, which is the anti-pattern the
// aftersignJobOfferCopy.consumer.test.ts header already calls out
// (PR #1404). The primitive lives here in `packages/aftersign` so
// both the package's unit suite AND the app's consumer tests can
// call it across the app→package seam — the same seam
// `computeOfferedJobs` already crosses.

import type { IoJobOffer } from "./computeOfferedJobs";

/** Stable, sortable identifier for a tappable action. */
export type IoJobOfferFingerprint = {
  readonly id: string;
  /** Composite semantic key — id + risk tier. Excludes label copy. */
  readonly semanticKey: string;
};

/**
 * Fingerprint a single offer. The semantic key intentionally omits
 * `label` — a copy edit ("Sealed return" → "Sealed hand-off") must
 * NOT count as divergence per the founder bar (dialogue-only diffs
 * score zero). Route risk IS included: reclassifying a job from
 * `low` to `high` is a mechanical change the player can feel.
 */
export function fingerprintJobOfferAction(offer: IoJobOffer): IoJobOfferFingerprint {
  return {
    id: offer.id,
    semanticKey: `${offer.id}#${offer.routeRisk}`,
  };
}

/**
 * Fingerprint an offered-jobs array in a stable, order-independent
 * form. Two arrays with the same offers in different order
 * fingerprint identically — the SET of tappable actions is what
 * "divergence" checks against, not their render order.
 */
export function fingerprintJobOfferActions(
  offers: readonly IoJobOffer[],
): IoJobOfferFingerprint[] {
  return offers
    .map(fingerprintJobOfferAction)
    .slice()
    .sort((a, b) => a.semanticKey.localeCompare(b.semanticKey));
}

/**
 * The load-bearing M-LOOP predicate: do these two offered-job arrays
 * represent DIFFERENT available action sets? Ignores label drift and
 * ordering; catches id and risk-tier changes.
 *
 * Returns `true` when the arrays diverge, `false` when they resolve
 * to the same tappable action set. Consumers assert `expect(...)
 * .toBe(true)` for a divergence proof, `.toBe(false)` for a
 * copy-only-drift regression guard.
 */
export function ioJobOffersDiverge(
  first: readonly IoJobOffer[],
  second: readonly IoJobOffer[],
): boolean {
  const firstKeys = fingerprintJobOfferActions(first).map((f) => f.semanticKey);
  const secondKeys = fingerprintJobOfferActions(second).map((f) => f.semanticKey);
  if (firstKeys.length !== secondKeys.length) return true;
  return firstKeys.some((key, i) => key !== secondKeys[i]);
}

/**
 * The set of tappable action semantic keys — the shape a served-page
 * consumer test can `expect(...).not.toEqual(...)` against to prove
 * divergence at the element level ("not the text level").
 */
export function collectTappableJobOfferKeys(
  offers: readonly IoJobOffer[],
): string[] {
  return fingerprintJobOfferActions(offers).map((f) => f.semanticKey);
}
