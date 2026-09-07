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
// `transform: scale(var(--aftersign-job-take-scale-from))` owns the
// transform channel for the 96ms compression window. A Web Animation
// from `applyJobOfferFeel` sits in the Animation origin and beats
// author-origin CSS on `transform`, so we DEFER the visual layer
// entirely to the press-juice CSS when that data attribute is
// present, and only forward `onChoose` on click.
//
// PR #1652 re-review (Soren): the inline capture-phase pointerdown
// listener in `aftersign/index.html` (`armPressing`) is the SINGLE
// owner of the `pressing` marker + MutationObserver-protected 96ms
// compression window (see #1649). This module used to also stamp
// `pressing` on its own `touchstart`/`pointerdown` listeners; for a
// Playwright `touchscreen.tap()` the JS-fired `touchstart` runs
// BEFORE the inline `pointerdown`, so when the inline listener then
// fired it saw `prior === "pressing"` and hit its early-return —
// meaning the MutationObserver that protects the compression window
// was NEVER installed, and the `scaleDrop >= 0.015` trip-wire
// measured 0. Fix: this module no longer touches the
// `data-aftersign-job-take` attribute. The inline listener owns it
// end-to-end; the CSS `transition: transform 96ms` runs to
// completion; `onChoose` fires synchronously on click, matching the
// tuned 96ms hold + release envelope the CSS + `resolveHoldMs` both
// agree on.
const hasJobTakePressLayer = (button) =>
  Boolean(
    button &&
      button.hasAttribute &&
      button.hasAttribute("data-aftersign-job-take"),
  );

export const armJobOfferFeel = (button, onChoose, feel = JOB_OFFER_FEEL) => {
  if (!button) return null;
  setFeelVars(button, feel);
  button.dataset.aftersignJobOfferFeel = "ready";
  // Visual layer: only for the legacy path (no press-juice marker).
  // When `[data-aftersign-job-take]` is present, the inline capture-
  // phase pointerdown listener owns the transform channel; adding a
  // Web Animation here would clobber it (Animation-origin > author-
  // origin on `transform`).
  button.addEventListener("pointerdown", () => {
    if (hasJobTakePressLayer(button)) return;
    applyJobOfferFeel(button, feel);
  });
  button.addEventListener("click", () => {
    if (hasJobTakePressLayer(button)) {
      // The inline listener already flipped the marker to "pressing"
      // on the preceding pointerdown, installed the MutationObserver,
      // and scheduled the return to "armed" after the 96ms hold. Our
      // only job here is to forward the choice — the state commit +
      // beat advance run against the CSS envelope that's already
      // painting.
      if (typeof onChoose === "function") onChoose({ ...feel });
      return;
    }
    const applied = applyJobOfferFeel(button, feel);
    if (typeof onChoose === "function") onChoose(applied);
  });
  return { ...feel };
};
