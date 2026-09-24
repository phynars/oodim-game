// M-LOOP-E1 feel guard: route-risk tap-lock.
//
// Problem this leaf solves:
//   When the tray reflows on tap (a chosen action re-renders the button
//   set to a new offered pair), a finger that lifts off the ORIGINAL
//   button after ~50-150ms can land on whatever button now occupies
//   that screen-space slot. Result: a player taps "take-the-shortcut"
//   and sees "carry-a-fragile-packet" confirm instead — a broken
//   promise at the exact frame the input mattered.
//
// Fix, in feel terms:
//   Once a route-risk choice fires, LOCK route-risk taps for 180ms.
//   A second tap inside the lock window is dropped. 180ms covers the
//   press-envelope confirm animation authored in
//   `routeRiskConfirmFeedback.js` and the reflow of `renderRouteRiskChoice`.
//   180ms is long enough to survive the reflow, short enough that an
//   intentional double-choice (the player DOES want to change their
//   mind) waits one beat — visible, not lost.
//
// Shape:
//   Pure. No DOM, no Date.now — the caller supplies `nowMs`. The
//   consumer (`renderRouteRiskChoice` in `routeRiskMemory.ts`) owns
//   the lock instance and threads a `now()` clock so tests can drive
//   it deterministically.

export type RouteRiskChoiceIntent =
  | "take-the-shortcut"
  | "take-the-long-way"
  | "repair-the-loss"
  | "carry-a-fragile-packet";

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

/**
 * Gate a fresh tap against an existing lock.
 *
 * Contract:
 *   - If no active lock, accept the tap and arm a new lock.
 *   - If an active lock exists and the incoming tap matches its choice,
 *     accept the tap (a re-tap of the same button inside the window is
 *     idempotent — same outcome, don't punish repeated pressure).
 *   - Otherwise reject the tap and keep the existing lock intact.
 *
 * Returns `{ accepted, nextLock }`. The caller commits the choice only
 * when `accepted` is true, and always adopts `nextLock` as its new lock
 * state.
 */
export function pickRouteRiskChoiceOnTap(
  lock: RouteRiskChoiceLock | undefined,
  choice: RouteRiskChoiceIntent,
  nowMs: number,
): { accepted: boolean; nextLock: RouteRiskChoiceLock } {
  if (!isRouteRiskChoiceLocked(lock, nowMs)) {
    return { accepted: true, nextLock: lockRouteRiskChoice(choice, nowMs) };
  }
  // Active lock. Same-choice re-tap is fine; different-choice tap drops.
  if (lock!.choice === choice) {
    return { accepted: true, nextLock: lock! };
  }
  return { accepted: false, nextLock: lock! };
}
