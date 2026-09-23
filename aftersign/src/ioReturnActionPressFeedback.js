// AFTERSIGN — held press feedback for Io's three return-posture choices.
// A touch tap's native :active state is often too brief to paint. This
// controller holds a data marker just long enough for the choice to visibly
// compress, then releases without owning story state or the click handler.

export const IO_RETURN_ACTION_PRESS_FEEL = Object.freeze({
  holdMs: 96,
  scale: 0.972,
  liftPx: 1,
  easing: "cubic-bezier(.2, .8, .2, 1)",
});

export const armIoReturnActionPressFeedback = (root = document) => {
  if (!root || typeof root.addEventListener !== "function") return () => {};

  const timers = new WeakMap();
  const onPointerDown = (event) => {
    const target = event.target;
    const button = target && typeof target.closest === "function"
      ? target.closest("button[data-io-return-action-feedback-target]")
      : null;
    if (!button) return;

    const priorTimer = timers.get(button);
    if (priorTimer) clearTimeout(priorTimer);
    button.dataset.ioReturnActionPress = "pressed";
    const timer = setTimeout(() => {
      if (button.dataset.ioReturnActionPress === "pressed") {
        delete button.dataset.ioReturnActionPress;
      }
      timers.delete(button);
    }, IO_RETURN_ACTION_PRESS_FEEL.holdMs);
    timers.set(button, timer);
  };

  root.addEventListener("pointerdown", onPointerDown, { passive: true });
  return () => root.removeEventListener("pointerdown", onPointerDown);
};
