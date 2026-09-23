import { getJobOfferChoiceFeedback } from "./jobOfferChoiceFeedback.js";

const equal = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
};

export function runJobOfferChoiceFeedbackChecks() {
  // These three inputs are the ONLY `routeRisk` values that ever reach
  // the served offer button. They come off `IoJobOffer.routeRisk` in
  // `packages/aftersign/src/computeOfferedJobs.ts` (see the `OFFER_BY_ID`
  // table — every entry's `routeRisk` is one of `"low" | "medium" |
  // "high"`), and `main.js` passes `offer.routeRisk` straight into
  // `applyJobOfferChoiceFeedback`. Testing the pure function with the
  // call site's actual vocabulary is what pins the contract; feeding it
  // `"safe"`/`"risky"` here would be tautological against the internal
  // switch and would let the dead-branches bug ship (PR #1890 review).

  // low → safe tone → amber, restrained envelope.
  const low = getJobOfferChoiceFeedback("low");
  equal(low.durationMs, 140, "low-risk (safe) settles inside a tenth-second-scale response");
  equal(low.liftPx, 2, "low-risk (safe) stays restrained");
  equal(low.glow, "amber", "low-risk (safe) uses the warm confirmation channel");

  // medium → risky tone → red, readable-longer envelope.
  const medium = getJobOfferChoiceFeedback("medium");
  equal(medium.durationMs, 180, "medium-risk (risky) has a readable longer hit");
  equal(medium.liftPx, 4, "medium-risk (risky) carries more physical lift");
  equal(medium.glow, "red", "medium-risk (risky) uses the warning confirmation channel");

  // high → consequence tone → crimson, most physical envelope. Missing
  // this case is what let PR #1890 ship with a dead default branch on
  // the served path — pinning it here reds the CI lane if the switch or
  // translator drift.
  const high = getJobOfferChoiceFeedback("high");
  equal(high.durationMs, 220, "high-risk (consequence) has the longest readable hit");
  equal(high.liftPx, 6, "high-risk (consequence) carries the most physical lift");
  equal(high.glow, "crimson", "high-risk (consequence) uses the strongest confirmation channel");

  // Unknown / malformed risks collapse through `aftersignRouteRiskToJobTone`
  // to `"safe"`, so an unmapped input receives the safe envelope — NOT
  // the internal `default` fallback. This pins that the module doesn't
  // impersonate a stronger tone when it sees a value it doesn't
  // recognise.
  const fallback = getJobOfferChoiceFeedback("unknown");
  equal(fallback.durationMs, 140, "unknown risk collapses to the safe envelope, not a stronger tone");
  equal(fallback.glow, "amber", "unknown risk never impersonates a risky/consequence route");
}

runJobOfferChoiceFeedbackChecks();
