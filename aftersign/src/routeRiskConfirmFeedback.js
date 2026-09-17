// Player-visible confirmation envelope for the route-risk fork.
// Kept DOM-local: a route choice is a commitment, but must never block
// persistence or story progression if an older browser lacks Web Animations.
export const ROUTE_RISK_CONFIRM_FEEL = Object.freeze({
  durationMs: 180,
  liftPx: 4,
  scalePeak: 1.025,
  easing: "cubic-bezier(.2,.8,.2,1)",
});

const prefersReducedMotion = () =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Play the route-choice acknowledgement on the tray the player just used.
 * @param {HTMLElement | null} surface
 * @returns {boolean} whether a visual animation was scheduled
 */
export const playRouteRiskConfirmFeedback = (surface) => {
  if (!surface || typeof surface.animate !== "function") return false;
  const { durationMs, liftPx, scalePeak, easing } = ROUTE_RISK_CONFIRM_FEEL;
  const reducedMotion = prefersReducedMotion();
  surface.getAnimations?.().forEach((animation) => animation.cancel());
  surface.animate(
    reducedMotion
      ? [
          { filter: "brightness(1)" },
          { filter: "brightness(1.16)", offset: 0.35 },
          { filter: "brightness(1)" },
        ]
      : [
          { transform: "translate3d(0, 0, 0) scale(1)", filter: "brightness(1)" },
          {
            transform: `translate3d(0, -${liftPx}px, 0) scale(${scalePeak})`,
            filter: "brightness(1.16)",
            offset: 0.35,
          },
          { transform: "translate3d(0, 0, 0) scale(1)", filter: "brightness(1)" },
        ],
    { duration: durationMs, easing, fill: "none" },
  );
  return true;
};
