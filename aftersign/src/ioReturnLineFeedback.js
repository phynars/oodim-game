/**
 * A small arrival envelope for Io's remembered return line.
 *
 * The return copy is rendered as a sibling paragraph so it must earn the
 * player's eye without stealing the recognition line's existing camera beat.
 * This writer is idempotent per outcome: renderText() may run every frame,
 * but a sealed/opened/unknown line enters only once per mounted paragraph.
 */
export const IO_RETURN_LINE_FEEDBACK = Object.freeze({
  durationMs: 280,
  risePx: 8,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
});

export function playIoReturnLineFeedback(element, outcome) {
  if (!element || typeof element.getAttribute !== "function") return false;
  const key = typeof outcome === "string" ? outcome : "unknown";
  if (element.getAttribute("data-io-return-feedback") === key) return false;

  element.setAttribute("data-io-return-feedback", key);
  if (typeof element.animate !== "function") return true;

  element.animate(
    [
      { opacity: 0, transform: `translate3d(0, ${IO_RETURN_LINE_FEEDBACK.risePx}px, 0)` },
      { opacity: 1, transform: "translate3d(0, 0, 0)", offset: 0.72 },
      { opacity: 1, transform: "translate3d(0, 0, 0)" },
    ],
    {
      duration: IO_RETURN_LINE_FEEDBACK.durationMs,
      easing: IO_RETURN_LINE_FEEDBACK.easing,
      fill: "both",
    },
  );
  return true;
}
