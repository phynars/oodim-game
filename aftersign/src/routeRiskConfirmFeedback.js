// Player-visible confirmation envelope for the route-risk fork.
// Kept DOM-local: a route choice is a commitment, but must never block
// persistence or story progression if an older browser lacks Web Animations.
//
// Contract (pinned by `apps/web/src/aftersign/routeRiskMemory.ts:50-62`
// and Soren's REQUEST_CHANGES on #1840):
//   - The `ROUTE_RISK_CONFIRM_FEEL` table is a NAMED export — the served
//     `aftersign/main.js` imports it alongside `playRouteRiskConfirmFeedback`.
//     Deleting the named export breaks the served bundle.
//   - `playRouteRiskConfirmFeedback(surface)` returns a `boolean`:
//     `true` when a visual acknowledgement was scheduled, `false` when
//     the surface can't animate (missing element, no Web Animations,
//     partial implementation throws). Callers rely on `=== true`.
//   - Reduced-motion players get a brightness-only flicker, never a
//     translate lift — the vestibular contract.
//   - The whole `.animate(...)` path is wrapped in try/catch so a partial
//     Web Animations implementation cannot throw through to the tap-
//     commit path in `main.js`. Feedback is decorative; the route
//     commit is durable and must not depend on it.
export const ROUTE_RISK_CONFIRM_FEEL = Object.freeze({
  durationMs: 180,
  liftPx: 4,
  scalePeak: 1.025,
  easing: "cubic-bezier(.2,.8,.2,1)",
  hapticPulseMs: 8,
});

const prefersReducedMotion = () =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Haptics are a tiny confirmation click, not a substitute for the visual
// envelope. Unsupported/blocked vibration is intentionally silent: a route
// choice must always commit even if the device declines the pulse.
const playRouteRiskConfirmHaptic = (durationMs) => {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Decorative feedback must never interrupt the durable route commit.
  }
};

/**
 * Play the route-choice acknowledgement on the tray the player just used.
 * @param {HTMLElement | null} surface
 * @returns {boolean} whether a visual animation was scheduled
 */
export const playRouteRiskConfirmFeedback = (surface) => {
  if (!surface || typeof surface.animate !== "function") return false;
  const { durationMs, liftPx, scalePeak, easing, hapticPulseMs } = ROUTE_RISK_CONFIRM_FEEL;
  const reducedMotion = prefersReducedMotion();

  // Feedback is decorative. A partial Web Animations implementation must
  // never stop the tap's durable route commit in the served callback.
  try {
    surface.getAnimations?.().forEach((animation) => animation.cancel());
    // The pressed tray must own this brief transform outright. Without an
    // explicit replace composite, an ancestor or prior animation can add its
    // own translate/scale and turn the 4px confirmation into a wandering,
    // inconsistent bump on successive route picks.
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
      { duration: durationMs, easing, fill: "none", composite: "replace" },
    );
  } catch {
    return false;
  }
  if (!reducedMotion) playRouteRiskConfirmHaptic(hapticPulseMs);
  return true;
};
