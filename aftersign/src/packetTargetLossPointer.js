// Player-facing packet pointer release adapter. The packet gesture owns the
// target-loss edge, so a real DOM release must reach the same packetRelease
// funnel as any other input source.
export const attachPacketTargetLossPointer = ({ button, release }) => {
  if (!button || typeof button.addEventListener !== "function") return;

  button.addEventListener("pointerup", (event) => {
    if (typeof release !== "function") return;
    release({
      timeMs: performance.now(),
      x: event.clientX,
      y: event.clientY,
    });
  });
};
