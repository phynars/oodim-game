export const JOB_OFFER_TAP_HAPTIC_MS = 12;

/**
 * Fires the tiny confirmation tick for a job-offer press without making the
 * offer flow depend on optional vibration support.
 */
export function playJobOfferTapHaptic(navigatorLike: Pick<Navigator, "vibrate"> = navigator): void {
  try {
    navigatorLike.vibrate?.(JOB_OFFER_TAP_HAPTIC_MS);
  } catch {
    // Haptics are an optional flourish; a blocked API must never block a job.
  }
}
