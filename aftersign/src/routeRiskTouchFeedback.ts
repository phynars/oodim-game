export type RouteRiskTouchFeedback = Readonly<{
  scale: number;
  translateY: number;
  durationMs: number;
}>;

/**
 * Keeps a route-risk choice visibly under the player's finger without making
 * the follow-up route transition feel delayed.
 */
export function getRouteRiskTouchFeedback(
  elapsedSincePressMs: number,
): RouteRiskTouchFeedback {
  if (elapsedSincePressMs < 0) {
    throw new RangeError("elapsedSincePressMs must be non-negative");
  }

  const progress = Math.min(elapsedSincePressMs / 96, 1);
  return {
    scale: 1 - 0.018 * (1 - progress),
    translateY: 2 * (1 - progress),
    durationMs: 96,
  };
}
