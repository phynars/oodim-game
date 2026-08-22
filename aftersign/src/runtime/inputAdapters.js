export const attachRuntimeInputAdapters = ({
  packetButton,
  acknowledgeRouteButton,
  skipRouteButton,
  deliverButton,
  canvas,
  document,
  window,
  state,
  IO_RETURN_TONE_OPTIONS,
  AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR,
  packetPress,
  packetMove,
  packetRelease,
  handleScenePointer,
  choose,
  markStateDirty,
  markPointerIntent,
}) => {
  const packetPointFromEvent = (event) => ({
    timeMs: performance.now(),
    x: event.clientX,
    y: event.clientY,
  });

  packetButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    packetButton.setPointerCapture(event.pointerId);
    packetPress(packetPointFromEvent(event));
  });

  packetButton.addEventListener("pointermove", (event) => {
    if (state.interaction.packetIntent.active) {
      event.preventDefault();
      packetMove(packetPointFromEvent(event));
    }
  });

  packetButton.addEventListener("pointerup", (event) => {
    event.preventDefault();
    if (window.__game && typeof window.__game.applyTapConfirmFeel === "function") {
      window.__game.applyTapConfirmFeel("packet");
    }
    packetRelease(packetPointFromEvent(event));
  });

  packetButton.addEventListener("pointercancel", (event) => {
    event.preventDefault();
    packetMove({
      ...packetPointFromEvent(event),
      x: state.interaction.packetIntent.config.DRIFT_CANCEL_PX + event.clientX + 1,
    });
  });

  acknowledgeRouteButton.addEventListener("click", () => {
    const reasonFromAck = acknowledgeRouteButton.dataset.returnReason;
    if (reasonFromAck && IO_RETURN_TONE_OPTIONS.some((o) => o.id === reasonFromAck)) {
      state.player.returnReason = reasonFromAck;
      markStateDirty();
    }
    const choiceId = acknowledgeRouteButton.dataset.choiceId || "acknowledge-kiosk";
    if (window.__game && typeof window.__game.applyTapConfirmFeel === "function") {
      window.__game.applyTapConfirmFeel(choiceId);
    }
    choose(choiceId);
  });

  skipRouteButton.addEventListener("click", () => {
    const reasonFromSkip = skipRouteButton.dataset.returnReason;
    if (reasonFromSkip && IO_RETURN_TONE_OPTIONS.some((o) => o.id === reasonFromSkip)) {
      state.player.returnReason = reasonFromSkip;
      markStateDirty();
    }
    const choiceId = skipRouteButton.dataset.choiceId || "skip-kiosk-acknowledge";
    if (window.__game && typeof window.__game.applyTapConfirmFeel === "function") {
      window.__game.applyTapConfirmFeel(choiceId);
    }
    choose(choiceId);
  });

  deliverButton.addEventListener("click", () => {
    const reasonFromDeliver = deliverButton.dataset.returnReason;
    if (reasonFromDeliver && IO_RETURN_TONE_OPTIONS.some((o) => o.id === reasonFromDeliver)) {
      state.player.returnReason = reasonFromDeliver;
      markStateDirty();
    }
    const choiceId = deliverButton.dataset.choiceId || "deliver-packet";
    if (window.__game && typeof window.__game.applyTapConfirmFeel === "function") {
      window.__game.applyTapConfirmFeel(choiceId);
    }
    choose(choiceId);
  });

  canvas.addEventListener("pointerdown", handleScenePointer, { passive: false });

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!event || typeof event.pointerId !== "number") {
        return;
      }
      const pointerTarget = event.target;
      const pointerChoiceSurface =
        pointerTarget && typeof pointerTarget.closest === "function"
          ? pointerTarget.closest(AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR)
          : null;
      if (
        !pointerChoiceSurface
        || pointerChoiceSurface.hidden
        || pointerChoiceSurface.getAttribute("aria-hidden") === "true"
      ) {
        return;
      }
      markPointerIntent({
        pointerAtMs: performance.now(),
        pointerId: event.pointerId,
      });
    },
    { capture: true, passive: true },
  );
};
