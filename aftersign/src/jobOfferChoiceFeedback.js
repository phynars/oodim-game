import { aftersignRouteRiskToJobTone } from "../../apps/web/src/aftersign/aftersignRouteRiskToJobTone.ts";

/**
 * Maps a served-offer's `routeRisk` (`"low" | "medium" | "high"` — the
 * vocabulary that actually flows from `packages/aftersign/src/computeOfferedJobs.ts`
 * into `main.js`'s `armJobOfferFeel` handler) to a short confirmation
 * envelope on the pressed button.
 *
 * The `routeRisk` values come straight off `IoJobOffer.routeRisk`; we
 * translate them through the single source-of-truth mapper
 * (`aftersignRouteRiskToJobTone`) so this module's switch stays keyed on
 * the same three-tone vocabulary (`safe`/`risky`/`consequence`) as the
 * rest of the served-surface feel. If someone renames a tone, both this
 * switch and the translator red in lockstep.
 *
 * The consumer should call `applyJobOfferChoiceFeedback` from the
 * rendered offer button's pointer/touch handler so selection is
 * acknowledged before narrative/state work completes.
 */
export function getJobOfferChoiceFeedback(routeRisk) {
  const tone = aftersignRouteRiskToJobTone(routeRisk);
  switch (tone) {
    case "safe":
      return { durationMs: 140, liftPx: 2, scale: 1.012, glow: "amber" };
    case "risky":
      return { durationMs: 180, liftPx: 4, scale: 1.024, glow: "red" };
    case "consequence":
      return { durationMs: 220, liftPx: 6, scale: 1.032, glow: "crimson" };
    default:
      // `aftersignRouteRiskToJobTone` already collapses unknown risks to
      // `"safe"`, so this branch is unreachable through the served path.
      // Kept as a defensive fallback so a future tone added without a
      // matching case here still lands on a bounded envelope instead of
      // `undefined`.
      return { durationMs: 160, liftPx: 3, scale: 1.018, glow: "white" };
  }
}

export function applyJobOfferChoiceFeedback(button, routeRisk) {
  if (!button) return;

  const feedback = getJobOfferChoiceFeedback(routeRisk);
  button.style.setProperty("--aftersign-job-choice-duration", `${feedback.durationMs}ms`);
  button.style.setProperty("--aftersign-job-choice-lift", `${feedback.liftPx}px`);
  button.style.setProperty("--aftersign-job-choice-scale", String(feedback.scale));
  button.dataset.aftersignJobChoiceGlow = feedback.glow;
  button.dataset.aftersignJobChoiceActive = "true";
  // This runs on the pressed element rather than a tray-wide overlay: the
  // player sees their exact choice answer in the same input frame.
  const brightnessPeak =
    feedback.glow === "crimson" ? 1.34 : feedback.glow === "red" ? 1.28 : 1.16;
  button.animate?.(
    [
      { filter: "brightness(1)", offset: 0 },
      { filter: `brightness(${brightnessPeak})`, offset: 0.28 },
      { filter: "brightness(1)", offset: 1 },
    ],
    { duration: feedback.durationMs, easing: "cubic-bezier(.16,.9,.26,1)" },
  );

  const clear = () => {
    button.dataset.aftersignJobChoiceActive = "false";
  };
  window.setTimeout(clear, feedback.durationMs);
}
