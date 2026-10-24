// Served packet-press presentation. The composition root supplies all browser
// and feedback dependencies so this module owns rendering, not input commits.
export function createPacketPressFeedbackRenderer({
  button,
  beginFeedback,
  advanceFeedback,
  tactileCue,
  prefersReducedMotion,
  now,
  requestFrame,
  vibrate,
}) {
  let feedback = { isPressed: false, releaseAtMs: null };
  let frame = null;

  const render = () => {
    if (button) button.dataset.packetPressFeedback = feedback.isPressed ? "pressed" : "idle";
  };

  const tick = (nowMs) => {
    feedback = advanceFeedback(feedback, nowMs);
    render();
    frame = feedback.isPressed ? requestFrame(tick) : null;
  };

  const play = () => {
    feedback = beginFeedback(now());
    render();
    const reducedMotion = prefersReducedMotion();
    if (button && typeof button.animate === "function") {
      try {
        button.animate(
          reducedMotion
            ? [{ filter: "brightness(1)" }, { filter: "brightness(1.12)", offset: 0.35 }, { filter: "brightness(1)" }]
            : [
                { transform: "translateY(0) scale(1)" },
                { transform: `translateY(${tactileCue.travelPx}px) scale(${tactileCue.scale})`, offset: 0.35 },
                { transform: "translateY(0) scale(1)" },
              ],
          { duration: tactileCue.durationMs, easing: tactileCue.easing },
        );
      } catch {
        // Decorative feedback must never interrupt the durable packet commit.
      }
    }
    if (!reducedMotion) vibrate(tactileCue.vibrationMs);
    if (frame === null) frame = requestFrame(tick);
  };

  return { play, render };
}
