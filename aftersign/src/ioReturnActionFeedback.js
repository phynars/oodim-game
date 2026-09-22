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

// PR #1885 (Soren, AI008): the previous per-button attach was wrong
// against a frame-driven re-render. Tap → beat advances → parent
// re-renders → the button DOM node is REPLACED → `pointerup` fires on
// the fresh node while our listeners were still bound to the detached
// one → `onRelease` never runs → the 28ms cue never stamps.
//
// Fix: arm ONCE on a stable ancestor (default: `document`), using
// capture-phase pointer listeners filtered by a data-attribute
// selector. Node identity across re-render no longer matters — the
// selector matches whichever button currently occupies the fork.
const DEFAULT_SELECTOR = "[data-io-return-action-feedback-target]";

/**
 * Arms tactile acknowledgement for return-action buttons on a stable
 * ancestor. Any descendant matching `selector` (default:
 * `[data-io-return-action-feedback-target]`) participates — including
 * nodes that mount AFTER this call, because the listeners live on the
 * ancestor, not on the button.
 *
 * The returned detach removes the ancestor listeners; it deliberately
 * does NOT cancel an in-flight coupling timer (the tap already
 * happened; the cue is a promise to the player).
 *
 * @param {EventTarget | null | undefined} [root] stable ancestor; defaults to `document`.
 * @param {{ haptic?: () => void, audio?: () => void, selector?: string }} [cues]
 * @returns {() => void} removes the ancestor listeners.
 */
export const armIoReturnActionFeedback = (root, cues = {}) => {
  const host = root || (typeof document !== "undefined" ? document : null);
  if (!host || typeof host.addEventListener !== "function") return () => {};
  const selector = cues.selector || DEFAULT_SELECTOR;

  const matchButton = (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return null;
    return target.closest(selector);
  };

  const onPointerDown = (event) => {
    const button = matchButton(event);
    if (!button) return;
    button.style.setProperty("--io-return-action-press-scale", String(IO_RETURN_ACTION_FEEL.pressScale));
    button.style.transform = `scale(${IO_RETURN_ACTION_FEEL.pressScale})`;
    button.style.transition = "transform 48ms ease-out";
    button.dataset.ioReturnActionFeedback = "pressed";
  };

  const onRelease = (event) => {
    const button = matchButton(event);
    if (!button) return;
    button.style.transition = `transform ${IO_RETURN_ACTION_FEEL.releaseDurationMs}ms ${releaseEasing}`;
    button.style.transform = "scale(1)";
    button.dataset.ioReturnActionFeedback = "released";
    // Fire-and-forget: not cancellable on detach. The tap already
    // happened; the cue must survive an intervening re-render.
    //
    // PR #1885 (Soren, second REQUEST_CHANGES): NO try/catch here.
    // Swallowing errors hid the real failure (`state._runtime.audio`
    // undefined, or an out-of-scope helper) and left the e2e hanging
    // on the cue poll with no diagnostic. Callers own their own
    // safety inside the callback.
    setTimeout(() => {
      cues.haptic?.();
      cues.audio?.();
    }, IO_RETURN_ACTION_FEEL.couplingDelayMs);
  };

  // Capture phase so we win against any stopPropagation() further
  // down and so we run before the beat-advancing click handler.
  host.addEventListener("pointerdown", onPointerDown, true);
  host.addEventListener("pointerup", onRelease, true);
  host.addEventListener("pointercancel", onRelease, true);

  return () => {
    host.removeEventListener("pointerdown", onPointerDown, true);
    host.removeEventListener("pointerup", onRelease, true);
    host.removeEventListener("pointercancel", onRelease, true);
  };
};

/**
 * Back-compat wrapper: attach feedback to a specific button node.
 *
 * NOTE (PR #1885, AI008): prefer `armIoReturnActionFeedback` on a
 * stable ancestor for anything that re-renders. This per-node
 * variant is retained only for the unit test and for callers whose
 * button node lifetime is guaranteed longer than the tap gesture.
 *
 * @param {HTMLElement | null | undefined} button
 * @param {{ haptic?: () => void, audio?: () => void }} [cues]
 * @returns {() => void}
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
