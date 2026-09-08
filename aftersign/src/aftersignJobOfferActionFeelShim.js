// AFTERSIGN — job-offer action feel shim (JS mirror of the TS module).
//
// This file duplicates the pinned feel table + pressed-class vocabulary
// from `apps/web/src/aftersign/ioJobOfferActionFeel.ts` verbatim. The
// duplication is INTENTIONAL: the aftersign vite build reddened on a
// cross-package `.ts` import from this `.js` (see PR #1676), so we
// keep the shim as a hand-mirrored copy.
//
// The drift guard test lives at
// `apps/web/src/aftersign/ioJobOfferActionFeel.shim-drift.test.ts` and
// deep-equals the constants below against the TS module — if either
// surface drifts, the test reds. Do NOT collapse the duplication into
// a shared module (that's what caused the vite red); when you edit the
// TS table, edit this shim in the same commit and let the guard confirm.

/**
 * @typedef {"safe" | "risky" | "consequence"} AftersignJobRiskTone
 */

/**
 * Pinned feel table, byte-for-byte mirror of
 * `AFTERSIGN_JOB_OFFER_ACTION_FEEL` in ioJobOfferActionFeel.ts.
 */
export const AFTERSIGN_JOB_OFFER_ACTION_FEEL = {
  safe: {
    durationMs: 220,
    liftPx: 4,
    pressScale: 0.985,
    glowAlpha: 0.18,
    borderPulsePx: 1,
    easing: "cubic-bezier(.2,.8,.2,1)",
    audioCue: "soft-confirm",
  },
  risky: {
    durationMs: 280,
    liftPx: 6,
    pressScale: 0.975,
    glowAlpha: 0.26,
    borderPulsePx: 2,
    easing: "cubic-bezier(.16,1,.3,1)",
    audioCue: "risk-chime",
  },
  consequence: {
    durationMs: 340,
    liftPx: 5,
    pressScale: 0.98,
    glowAlpha: 0.32,
    borderPulsePx: 3,
    easing: "cubic-bezier(.34,1.56,.64,1)",
    audioCue: "debt-thrum",
  },
};

/**
 * Class the DOM applier toggles for pointer-down state. Must match the
 * string exported from ioJobOfferActionFeel.ts.
 */
export const AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS =
  "is-aftersign-job-offer-pressing";
