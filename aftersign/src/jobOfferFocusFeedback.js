/**
 * Keeps the selected delivery offer visibly latched after touch release.
 *
 * The route starts only after the offer callback runs, so this class is
 * intentionally presentation-only: it must never delay or suppress the
 * player's committed choice.
 */
export const JOB_OFFER_FOCUS_FEEDBACK_MS = 180;

export function playJobOfferFocusFeedback(button, now = globalThis.performance?.now?.bind(globalThis.performance)) {
  if (!button || typeof button.setAttribute !== "function") return () => {};

  const startedAt = now?.() ?? Date.now();
  button.dataset.aftersignJobOfferCommitted = "true";
  button.style.setProperty("--aftersign-job-offer-commit-duration", `${JOB_OFFER_FOCUS_FEEDBACK_MS}ms`);
  // Shadow-only: press feedback remains the transform authority.
  const animation = typeof button.animate === "function"
    ? button.animate(
        [
          { boxShadow: "0 0 0 rgba(255, 193, 105, 0)" },
          { boxShadow: "0 0 18px rgba(255, 193, 105, 0.72)" },
          { boxShadow: "0 0 6px rgba(255, 193, 105, 0.22)" },
        ],
        { duration: JOB_OFFER_FOCUS_FEEDBACK_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      )
    : null;

  const clear = () => {
    button.removeAttribute("data-aftersign-job-offer-committed");
    button.style.removeProperty("--aftersign-job-offer-commit-duration");
  };

  const remaining = Math.max(0, JOB_OFFER_FOCUS_FEEDBACK_MS - ((now?.() ?? Date.now()) - startedAt));
  const timeout = globalThis.setTimeout(clear, remaining);
  return () => {
    globalThis.clearTimeout(timeout);
    animation?.cancel();
    clear();
  };
}
