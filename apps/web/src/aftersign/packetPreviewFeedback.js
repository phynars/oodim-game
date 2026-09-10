// Served-page DOM writer for the PREVIEWED outcome (#1701, Refs #1698).
//
// Owns ONE surface: stamping `data-packet-feedback` on the shipped
// `#packetButton` element (aftersign/index.html:861) when the pure
// `PacketIntentController.previewRelease(...)` lands
// `PACKET_OUTCOME.PREVIEWED` — the "very quick glance" outcome that
// does NOT commit sealed/opened. Called from `packetRelease` in
// `aftersign/main.js` on every release: if the outcome is PREVIEWED
// we stamp `previewed`; on any other outcome (unknown, sealed, opened,
// cancelled) we clear the stamp so a subsequent commit doesn't
// inherit the previous glance.
//
// Same idiom as `applyPacketButtonCopy` in `packetInteractionCopy.js`:
//   - Null-safe. Callers wrap in try/catch as an extra guard, but
//     the writer itself defends so a fresh DOM never black-screens.
//   - Writes ONLY `data-packet-feedback`. Never touches
//     `data-aftersign-tap-choice` (harness key), `aria-label`
//     (served contract), or `data-packet-button-copy-state` (the
//     sibling copy writer's stamp).
//   - Returns the writer's decision so the caller can log / assert.
//
// The consumer test `packetPreviewFeedback.consumer.test.ts` loads
// the REAL `aftersign/index.html`, finds `#packetButton`, drives a
// real click through a handler that models `packetRelease`'s
// dispatch, and pins that the stamp lands on the very element the
// finger touched — closing Soren's "no player taps a rendered
// element" gap on PR #1701.

export const PACKET_PREVIEW_FEEDBACK_ATTR = "data-packet-feedback";
export const PACKET_PREVIEW_FEEDBACK_VALUE = "previewed";

const KNOWN_PHASES = new Set(["previewed", "cleared"]);

function normalizePhase(phase) {
  return KNOWN_PHASES.has(phase) ? phase : "cleared";
}

/**
 * Stamp / clear the preview-feedback marker on the served
 * `#packetButton`. Phase `"previewed"` sets
 * `data-packet-feedback="previewed"`; phase `"cleared"` removes the
 * attribute entirely so a subsequent SEALED/OPENED commit doesn't
 * leave a stale glance marker on the DOM.
 *
 * @param {HTMLElement | null | undefined} button
 * @param {"previewed" | "cleared"} phase
 * @returns {{ buttonId: string; phase: "previewed" | "cleared" } | null}
 */
export function applyPacketPreviewFeedback(button, phase) {
  if (!button || typeof button.setAttribute !== "function") return null;
  const normalized = normalizePhase(phase);
  if (normalized === "previewed") {
    button.setAttribute(PACKET_PREVIEW_FEEDBACK_ATTR, PACKET_PREVIEW_FEEDBACK_VALUE);
  } else if (typeof button.removeAttribute === "function") {
    button.removeAttribute(PACKET_PREVIEW_FEEDBACK_ATTR);
  }
  return { buttonId: "packetButton", phase: normalized };
}
