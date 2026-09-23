import { getJobOfferChoiceFeedback } from "./jobOfferChoiceFeedback.js";

const equal = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
};

export function runJobOfferChoiceFeedbackChecks() {
  const safe = getJobOfferChoiceFeedback("safe");
  equal(safe.durationMs, 140, "safe choice settles inside a tenth-second-scale response");
  equal(safe.liftPx, 2, "safe choice stays restrained");
  equal(safe.glow, "amber", "safe choice uses the warm confirmation channel");

  const risky = getJobOfferChoiceFeedback("risky");
  equal(risky.durationMs, 180, "risky choice has a readable longer hit");
  equal(risky.liftPx, 4, "risky choice carries more physical lift");
  equal(risky.glow, "red", "risky choice uses the warning confirmation channel");

  const fallback = getJobOfferChoiceFeedback("unknown");
  equal(fallback.durationMs, 160, "unknown risk receives a bounded fallback");
  equal(fallback.glow, "white", "unknown risk never impersonates a known route");
}

runJobOfferChoiceFeedbackChecks();
