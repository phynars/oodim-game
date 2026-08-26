export const JOB_OFFER_FEEL = Object.freeze({
  armDelayMs: 0,
  durationMs: 180,
  liftPx: 3,
  scalePeak: 1.025,
  glowPx: 18,
  glowAlpha: 0.32,
  easing: "cubic-bezier(0.2, 0.9, 0.2, 1)",
});

const setFeelVars = (node, feel = JOB_OFFER_FEEL) => {
  node.style.setProperty("--job-offer-feel-duration-ms", `${feel.durationMs}ms`);
  node.style.setProperty("--job-offer-feel-lift-px", `${feel.liftPx}px`);
  node.style.setProperty("--job-offer-feel-scale-peak", `${feel.scalePeak}`);
  node.style.setProperty("--job-offer-feel-glow-px", `${feel.glowPx}px`);
  node.style.setProperty("--job-offer-feel-glow-alpha", `${feel.glowAlpha}`);
  node.style.setProperty("--job-offer-feel-easing", feel.easing);
};

export const applyJobOfferFeel = (node, feel = JOB_OFFER_FEEL) => {
  if (!node) return null;
  setFeelVars(node, feel);
  node.dataset.aftersignJobOfferFeel = "armed";
  node.animate(
    [
      {
        transform: "translateY(0) scale(1)",
        filter: "drop-shadow(0 0 0 rgba(143, 233, 255, 0))",
      },
      {
        transform: `translateY(-${feel.liftPx}px) scale(${feel.scalePeak})`,
        filter: `drop-shadow(0 0 ${feel.glowPx}px rgba(143, 233, 255, ${feel.glowAlpha}))`,
        offset: 0.42,
      },
      {
        transform: "translateY(0) scale(1)",
        filter: "drop-shadow(0 0 0 rgba(143, 233, 255, 0))",
      },
    ],
    {
      duration: feel.durationMs,
      easing: feel.easing,
      fill: "none",
    },
  );
  return { ...feel };
};

export const armJobOfferFeel = (button, onChoose, feel = JOB_OFFER_FEEL) => {
  if (!button) return null;
  setFeelVars(button, feel);
  button.dataset.aftersignJobOfferFeel = "ready";
  button.addEventListener("pointerdown", () => {
    applyJobOfferFeel(button, feel);
  });
  button.addEventListener("click", () => {
    const applied = applyJobOfferFeel(button, feel);
    if (typeof onChoose === "function") onChoose(applied);
  });
  return { ...feel };
};
