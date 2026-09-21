// Served-page failure-sting writer for a CANCELLED packet gesture
// (Refs #1698, follow-up to PR #1701's PREVIEWED wire-in).
//
// Owns ONE feel-side surface: playing a short, reduced-motion-safe
// acknowledgement on the shipped `#packetButton` element
// (aftersign/index.html:1082) when the pure feel judge
// `evaluatePacketChoiceGesture(...)` returns `reason: "cancelled"` —
// blur, pointer-capture loss, or an explicit `kind: "cancel"` gesture
// that never became a preserve/open commit. The player put their
// finger down, the system dropped it; the sting is the tactile
// "we saw you, that didn't take" — not a punishment, an
// acknowledgement.
//
// Same shape as `applyPacketPreviewFeedback` (packetPreviewFeedback.js)
// and `playIoReturnLineFeedback` (aftersign/src/ioReturnLineFeedback.js):
//   - Null-safe. Caller wraps in try/catch as an extra guard, but
//     the writer itself defends so a fresh DOM never black-screens.
//   - Guards on `typeof element.animate !== "function"` — jsdom and
//     older browsers without Web Animations still boot cleanly; the
//     sting just no-ops. Mirrors the guard in `ioReturnLineFeedback`
//     and `routeRiskConfirmFeedback`.
//   - Returns `true` when the animation played, `false` otherwise.
//     Callers can assert / log the decision without reaching into
//     the animation object.
//   - Reduced-motion path removes positional shake but KEEPS a
//     brightness flash so the acknowledgement stays visible when
//     `prefers-reduced-motion: reduce` is set.
//
// The consumer test `packetCancelFailureSting.consumer.test.ts`
// loads the REAL `aftersign/index.html`, finds `#packetButton`,
// drives a real `.click()` through a handler that models the served
// `packetRelease` seam — dispatch a `kind: "cancel"` gesture through
// the pure `evaluatePacketChoiceGesture`, and on `reason: "cancelled"`
// call `playPacketCancelFailureSting(packetButton, ...)`. That closes
// Soren's "no player taps a rendered element" gap on the sting.

export const PACKET_CANCEL_FAILURE_STING = Object.freeze({
  flashMs: 180,
  shakePx: 6,
  shakeMs: 180,
  easing: "cubic-bezier(.22, 1, .36, 1)",
});

/**
 * Play the cancel-failure acknowledgement on the served packet
 * element. Reduced-motion strips the translate keyframes but keeps
 * a brightness flash so the surface still visibly reacts.
 *
 * @param {HTMLElement | null | undefined} element
 * @param {{ reducedMotion?: boolean }} [options]
 * @returns {boolean} `true` when the animation played, `false` on
 *   a missing element or a runtime without `Element.animate`.
 */
export function playPacketCancelFailureSting(element, { reducedMotion = false } = {}) {
  if (!element) return false;
  if (typeof element.animate !== "function") return false;

  const { flashMs, shakePx, shakeMs, easing } = PACKET_CANCEL_FAILURE_STING;
  element.animate(
    reducedMotion
      ? [
          { filter: "brightness(1)", offset: 0 },
          { filter: "brightness(1.32)", offset: 0.35 },
          { filter: "brightness(1)", offset: 1 },
        ]
      : [
          { transform: "translateX(0)", filter: "brightness(1)", offset: 0 },
          { transform: `translateX(${-shakePx}px)`, filter: "brightness(1.32)", offset: 0.24 },
          { transform: `translateX(${shakePx}px)`, filter: "brightness(1.18)", offset: 0.52 },
          { transform: "translateX(0)", filter: "brightness(1)", offset: 1 },
        ],
    {
      duration: reducedMotion ? flashMs : shakeMs,
      easing,
      fill: "none",
    },
  );
  return true;
}
