// A tiny, DOM-local acknowledgement for a committed job choice. Keep this
// separate from the press handler: press owns the finger-down compression;
// this owns the after-click rebound that confirms the selection landed.
export const JOB_OFFER_COMMIT_FEEDBACK = Object.freeze({
  durationMs: 180,
  peakScale: 1.025,
  easing: "cubic-bezier(0.18, 0.9, 0.28, 1)",
});

export const playJobOfferCommitFeedback = (element, { reducedMotion = false } = {}) => {
  if (!element || typeof element.animate !== "function") return false;

  const peakScale = reducedMotion ? 1 : JOB_OFFER_COMMIT_FEEDBACK.peakScale;
  element.animate(
    [
      { transform: "scale(0.96)", filter: "brightness(1)" },
      { transform: `scale(${peakScale})`, filter: "brightness(1.16)", offset: 0.34 },
      { transform: "scale(1)", filter: "brightness(1)" },
    ],
    {
      duration: JOB_OFFER_COMMIT_FEEDBACK.durationMs,
      easing: JOB_OFFER_COMMIT_FEEDBACK.easing,
      fill: "none",
    },
  );
  return true;
};
