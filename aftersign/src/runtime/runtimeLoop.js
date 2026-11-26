// Owns browser-frame scheduling for the served runtime. Per-frame game work
// remains injected so this module has no hidden scene, DOM, or state coupling.
export function startRuntimeLoop({ onFrame, requestFrame = requestAnimationFrame }) {
  const tick = (now) => {
    onFrame(now);
    requestFrame(tick);
  };

  requestFrame(tick);
}
