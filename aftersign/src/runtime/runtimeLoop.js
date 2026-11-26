// Owns browser-frame scheduling for the served runtime. Per-frame game work
// remains injected so this module has no hidden scene, DOM, or state coupling.
export function startRuntimeLoop({ onFrame, requestFrame = requestAnimationFrame }) {
  if (typeof onFrame !== "function") {
    throw new TypeError("startRuntimeLoop requires an onFrame callback");
  }

  const tick = (now) => {
    onFrame(now);
    requestFrame(tick);
  };

  requestFrame(tick);
}
