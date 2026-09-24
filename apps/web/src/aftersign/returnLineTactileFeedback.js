/**
 * A small, reduced-motion-safe tactile acknowledgement for Io's return line.
 *
 * This writer deliberately owns only the element-local pulse: scene movement
 * stays with the visual feedback lane so a text stamp never yanks the whole
 * page. It is safe to call on every render; a fresh pulse replaces the last.
 */
export function playReturnLineTactileFeedback(element) {
  if (!element || typeof element.animate !== "function") return false;

  element.animate(
    [
      { transform: "translateY(0) scale(1)", filter: "brightness(1)" },
      { transform: "translateY(-1px) scale(1.012)", filter: "brightness(1.16)", offset: 0.22 },
      { transform: "translateY(0) scale(1)", filter: "brightness(1)" },
    ],
    {
      duration: 180,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "none",
    },
  );

  return true;
}
