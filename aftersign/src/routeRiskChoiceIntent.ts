export type RouteRiskChoiceIntent = "low" | "medium" | "high";

/**
 * A tap must remain on its original route-risk choice long enough to survive
 * the pressed-state animation; otherwise a lifted finger can visually confirm
 * the wrong route when the tray reflows.
 */
export interface RouteRiskChoiceLock {
  readonly choice: RouteRiskChoiceIntent;
  readonly lockedAtMs: number;
  readonly releaseAtMs: number;
}

export const ROUTE_RISK_CHOICE_LOCK_MS = 180;

export function lockRouteRiskChoice(
  choice: RouteRiskChoiceIntent,
  nowMs: number,
): RouteRiskChoiceLock {
  return {
    choice,
    lockedAtMs: nowMs,
    releaseAtMs: nowMs + ROUTE_RISK_CHOICE_LOCK_MS,
  };
}

export function isRouteRiskChoiceLocked(
  lock: RouteRiskChoiceLock | undefined,
  nowMs: number,
): boolean {
  return lock !== undefined && nowMs < lock.releaseAtMs;
}
