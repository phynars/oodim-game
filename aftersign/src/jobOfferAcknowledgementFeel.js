// Job-offer acknowledgement: a non-layout-shifting confirmation beat.
// Kept separate from the job-selection state transition so an unavailable
// Web Animations API can never delay or block the committed choice.
export const JOB_OFFER_ACKNOWLEDGEMENT_FEEL = Object.freeze({
  durationMs: 220,
  risePx: 6,
  peakOpacity: 1,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
});

/**
 * Plays a short rise-and-settle on the acknowledgement copy that is layered
 * above the offer tray. The element stays pointer-inert and absolutely
 * positioned, so the original job button does not drift beneath a finger.
 *
 * @param {HTMLElement | null | undefined} element
 * @returns {boolean} true when a browser animation was scheduled
 */
export const playJobOfferAcknowledgementFeel = (element) => {
  if (!element || typeof element.animate !== "function") return false;
  const feel = JOB_OFFER_ACKNOWLEDGEMENT_FEEL;
  element.getAnimations?.().forEach((animation) => animation.cancel());
  element.animate(
    [
      { opacity: 0, transform: `translate3d(0, ${feel.risePx}px, 0) scale(0.985)` },
      { opacity: feel.peakOpacity, transform: "translate3d(0, 0, 0) scale(1)" },
      { opacity: 0.82, transform: "translate3d(0, -1px, 0) scale(1)" },
    ],
    { duration: feel.durationMs, easing: feel.easing, fill: "both" },
  );
  return true;
};
