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

// When the `aftersign-job-take` press-juice layer claims the same
// button (by stamping `[data-aftersign-job-take]` at render), its CSS
// `transform: scale(var(--aftersign-job-take-scale-from))` needs to own
// the transform channel for the 64ms compression sample. A Web Animation
// from `applyJobOfferFeel` sits in the Animation origin and beats author-
// origin CSS on `transform`, so this path defers the visual layer to the
// press-juice marker and delays the state commit until the authored hold
// has painted. That keeps the button under the finger for one tactile
// frame instead of replacing it on click before the player can feel it.
const hasJobTakePressLayer = (button) =>
  Boolean(
    button &&
      button.hasAttribute &&
      button.hasAttribute("data-aftersign-job-take"),
  );

const pressLayerTimers = new WeakMap();

const readJobTakeHoldMs = (button) => {
  const style = button.style;
  if (!style || typeof style.getPropertyValue !== "function") return 180;
  const raw = style.getPropertyValue("--aftersign-job-take-hold-ms").trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(parsed, 180) : 180;
};

const holdJobTakePressLayer = (button, afterHold) => {
  if (!hasJobTakePressLayer(button)) return false;
  const previousTimer = pressLayerTimers.get(button);
  if (previousTimer) window.clearTimeout(previousTimer);

  button.setAttribute("data-aftersign-job-take", "pressing");
  const timer = window.setTimeout(() => {
    pressLayerTimers.delete(button);
    if (button.getAttribute("data-aftersign-job-take") === "pressing") {
      button.setAttribute("data-aftersign-job-take", "armed");
    }
    if (typeof afterHold === "function") afterHold();
  }, readJobTakeHoldMs(button));
  pressLayerTimers.set(button, timer);
  return true;
};

export const armJobOfferFeel = (button, onChoose, feel = JOB_OFFER_FEEL) => {
  if (!button) return null;
  setFeelVars(button, feel);
  button.dataset.aftersignJobOfferFeel = "ready";
  button.addEventListener("pointerdown", () => {
    if (holdJobTakePressLayer(button)) return;
    applyJobOfferFeel(button, feel);
  });
  button.addEventListener("touchstart", () => {
    if (holdJobTakePressLayer(button)) return;
    applyJobOfferFeel(button, feel);
  }, { passive: true });
  button.addEventListener("click", () => {
    if (hasJobTakePressLayer(button)) {
      holdJobTakePressLayer(button, () => {
        if (typeof onChoose === "function") onChoose({ ...feel });
      });
      return;
    }
    const applied = applyJobOfferFeel(button, feel);
    if (typeof onChoose === "function") onChoose(applied);
  });
  return { ...feel };
};
