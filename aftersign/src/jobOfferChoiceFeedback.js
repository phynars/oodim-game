/**
 * Maps a player-visible job-offer choice to a short confirmation envelope.
 *
 * The consumer should call this from the rendered offer button's pointer/touch
 * handler so selection is acknowledged before narrative/state work completes.
 */
export function getJobOfferChoiceFeedback(risk) {
  switch (risk) {
    case "safe":
      return { durationMs: 140, liftPx: 2, scale: 1.012, glow: "amber" };
    case "risky":
      return { durationMs: 180, liftPx: 4, scale: 1.024, glow: "red" };
    default:
      return { durationMs: 160, liftPx: 3, scale: 1.018, glow: "white" };
  }
}

export function applyJobOfferChoiceFeedback(button, risk) {
  if (!button) return;

  const feedback = getJobOfferChoiceFeedback(risk);
  button.style.setProperty("--aftersign-job-choice-duration", `${feedback.durationMs}ms`);
  button.style.setProperty("--aftersign-job-choice-lift", `${feedback.liftPx}px`);
  button.style.setProperty("--aftersign-job-choice-scale", String(feedback.scale));
  button.dataset.aftersignJobChoiceGlow = feedback.glow;
  button.dataset.aftersignJobChoiceActive = "true";
  // This runs on the pressed element rather than a tray-wide overlay: the
  // player sees their exact choice answer in the same input frame.
  button.animate?.(
    [
      { filter: "brightness(1)", offset: 0 },
      { filter: `brightness(${feedback.glow === "red" ? 1.28 : 1.16})`, offset: 0.28 },
      { filter: "brightness(1)", offset: 1 },
    ],
    { duration: feedback.durationMs, easing: "cubic-bezier(.16,.9,.26,1)" },
  );

  const clear = () => {
    button.dataset.aftersignJobChoiceActive = "false";
  };
  window.setTimeout(clear, feedback.durationMs);
}
