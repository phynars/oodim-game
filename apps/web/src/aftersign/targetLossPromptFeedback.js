export const TARGET_LOSS_FEEDBACK = Object.freeze({
  flashDurationMs: 180,
  shakeDistancePx: 6,
  shakeDurationMs: 180,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
});

export function playTargetLossFeedback(element, { reducedMotion = false } = {}) {
  if (!element) return;

  element.animate(
    [
      { opacity: 0.55, transform: "translateX(0) scale(0.985)" },
      { opacity: 1, transform: "translateX(0) scale(1.02)" },
      { opacity: 1, transform: "translateX(0) scale(1)" },
    ],
    {
      duration: TARGET_LOSS_FEEDBACK.flashDurationMs,
      easing: TARGET_LOSS_FEEDBACK.easing,
      fill: "both",
    },
  );

  if (!reducedMotion) {
    element.animate(
      [
        { transform: "translateX(0)" },
        { transform: `translateX(-${TARGET_LOSS_FEEDBACK.shakeDistancePx}px)` },
        { transform: `translateX(${TARGET_LOSS_FEEDBACK.shakeDistancePx}px)` },
        { transform: "translateX(0)" },
      ],
      {
        duration: TARGET_LOSS_FEEDBACK.shakeDurationMs,
        easing: TARGET_LOSS_FEEDBACK.easing,
      },
    );
  }
}
