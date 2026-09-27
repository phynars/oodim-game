/**
 * A small, browser-safe tactile cue for feedback moments that must never
 * block the player action that triggered them.
 *
 * `navigator.vibrate` is optional on mobile browsers and unavailable in most
 * desktop/headless contexts, so callers receive a boolean instead of relying
 * on an exception path.
 */
export const playTactileFeedbackCue = (durationMs) => {
  const duration = Number(durationMs);
  if (!Number.isFinite(duration) || duration <= 0) return false;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return false;
  }
  try {
    return navigator.vibrate(Math.round(duration));
  } catch {
    return false;
  }
};
