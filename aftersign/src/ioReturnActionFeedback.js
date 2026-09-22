// Tactile feedback for the three visible Io return-action buttons.
// This module deliberately owns presentation only: callers invoke it before
// their story commit, and unavailable haptics/audio never block that commit.
export const IO_RETURN_ACTION_FEEL = Object.freeze({
  pressScale: 0.96,
  releaseDurationMs: 180,
  releaseSpringStiffness: 18,
  couplingDelayMs: 28,
});

const releaseEasing = "linear(0, 0.42 16%, 0.9 48%, 1.035 72%, 1 100%)";

/**
 * Arms tactile acknowledgement on a rendered return-action button.
 *
 * The returned detach removes listeners so a caller can idempotently
 * re-arm; it deliberately does NOT cancel an in-flight coupling timer.
 * PR #1885 (Soren, REQUEST_CHANGES): the aftersign render loop is
 * frame-driven — every frame the return-action branch called the prior
 * detach and clearCouplingTimer'd the 28ms cue armed on pointerup
 * before it could fire, so `audio.lastCue` never stamped. The player
 * already released; the cue is a promise to them, let it land.
 *
 * @param {HTMLElement | null | undefined} button
 * @param {{ haptic?: () => void, audio?: () => void }} [cues]
 * @returns {() => void} removes the listeners (leaves any pending cue armed).
 */
export const attachIoReturnActionFeedback = (button, cues = {}) => {
  if (!button || typeof button.addEventListener !== "function") return () => {};

  const onPointerDown = () => {
    button.style.setProperty("--io-return-action-press-scale", String(IO_RETURN_ACTION_FEEL.pressScale));
    button.style.transform = `scale(${IO_RETURN_ACTION_FEEL.pressScale})`;
    button.style.transition = "transform 48ms ease-out";
    button.dataset.ioReturnActionFeedback = "pressed";
  };

  const onRelease = () => {
    button.style.transition = `transform ${IO_RETURN_ACTION_FEEL.releaseDurationMs}ms ${releaseEasing}`;
    button.style.transform = "scale(1)";
    button.dataset.ioReturnActionFeedback = "released";
    // Fire-and-forget: not cancellable on detach. The tap already
    // happened; the cue must survive an intervening re-render.
    //
    // PR #1885 (Soren, second REQUEST_CHANGES): NO try/catch here.
    // The prior draft swallowed errors from `cues.audio?.()`, which
    // hid the real failure (`state._runtime.audio` undefined, or an
    // out-of-scope helper) and left the e2e hanging on the cue poll
    // with no diagnostic. If a cue callback throws, the console
    // shows the true stack — that's the debugging surface we need.
    // Callers own their own safety inside the callback.
    setTimeout(() => {
      cues.haptic?.();
      cues.audio?.();
    }, IO_RETURN_ACTION_FEEL.couplingDelayMs);
  };

  button.addEventListener("pointerdown", onPointerDown);
  button.addEventListener("pointerup", onRelease);
  button.addEventListener("pointercancel", onRelease);

  return () => {
    button.removeEventListener("pointerdown", onPointerDown);
    button.removeEventListener("pointerup", onRelease);
    button.removeEventListener("pointercancel", onRelease);
  };
};
