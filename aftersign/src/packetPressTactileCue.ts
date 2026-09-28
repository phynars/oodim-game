// Frozen shape approved on #1992 draft 1 — do not reshape without a
// paired review; the served main.js reads these five fields by name.
export const PACKET_PRESS_TACTILE_CUE = Object.freeze({
  durationMs: 72,
  vibrationMs: 10,
  scale: 0.982,
  travelPx: 1,
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
});

// Mirror of the vestibular contract in
// `aftersign/src/routeRiskConfirmFeedback.js`: WAAPI `.animate()` bypasses
// the CSS `@media (prefers-reduced-motion: reduce)` collapse in index.html,
// so every sibling WAAPI cue re-checks the query at call time. Packet-press
// is on the served-surface pin path (#1879) — the check must live here too.
export const packetPressPrefersReducedMotion = (): boolean =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
