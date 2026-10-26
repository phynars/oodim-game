// Served-page DOM writer for Io's route-return recognition line (#2511).
//
// At `io-return-recognition`, a player whose durable Io memory holds an
// explicit skipped route-attention fact hears the shipped `skippedReturn`
// copy from `apps/web/src/aftersign/ioFirstSceneDialogue.ts`. The line
// lands in a sibling paragraph `<p id="ioRouteReturnLine">` directly after
// `#line` — `#line` textContent stays owned by the recognition dialogue
// table (pinned by the reload/recognition playtests). Same sibling
// discipline as `stampJobAcceptedLine`.
//
// `null` removes the paragraph, so it never leaks into another beat.

export const IO_ROUTE_RETURN_LINE_ID = "ioRouteReturnLine";
export const IO_ROUTE_RETURN_LINE_DATA_ATTR = "data-aftersign-io-route-return";
const LINE_ID = "line";

/**
 * @param {Document} doc
 * @param {{ id: string, text: string } | null} line
 * @returns {HTMLElement | null}
 */
export function stampIoRouteReturnLine(doc, line) {
  if (line === null || line === undefined) {
    doc.getElementById(IO_ROUTE_RETURN_LINE_ID)?.remove();
    return null;
  }
  const lineEl = doc.getElementById(LINE_ID);
  if (!lineEl || !lineEl.parentNode) return null;

  let el = doc.getElementById(IO_ROUTE_RETURN_LINE_ID);
  if (!el) {
    el = doc.createElement("p");
    el.id = IO_ROUTE_RETURN_LINE_ID;
    lineEl.parentNode.insertBefore(el, lineEl.nextSibling);
  }
  if (el.textContent !== line.text) el.textContent = line.text;
  if (el.getAttribute(IO_ROUTE_RETURN_LINE_DATA_ATTR) !== line.id) {
    el.setAttribute(IO_ROUTE_RETURN_LINE_DATA_ATTR, line.id);
  }
  return el;
}
