// Tactile acknowledgement for a completed route outcome.
// Kept side-effect free so the served interaction can schedule vibration
// without allowing platform support to affect story progression.
export const ROUTE_OUTCOME_TACTILE_FEEDBACK = Object.freeze({
  durationMs: 18,
  amplitude: 1,
  pattern: Object.freeze([18]),
});

/**
 * Dispatch the route-outcome tactile tick when vibration is available.
 * @param {{ vibrate?: (pattern: number[]) => boolean } | null | undefined} navigatorLike
 * @returns {boolean}
 */
export const playRouteOutcomeTactileFeedback = (navigatorLike) => {
  const vibrate = navigatorLike?.vibrate;
  if (typeof vibrate !== "function") return false;
  try {
    return vibrate.call(navigatorLike, [...ROUTE_OUTCOME_TACTILE_FEEDBACK.pattern]) !== false;
  } catch {
    return false;
  }
};
