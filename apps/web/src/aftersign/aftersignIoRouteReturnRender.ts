// Served-page DOM writer for Io's route-return recognition line (#2511).
//
// At `io-return-recognition`, a player whose durable Io memory holds an
// explicit skipped route-attention fact hears the shipped `skippedReturn`
// copy from `ioFirstSceneDialogue.ts`. The line lands in a sibling
// paragraph `<p id="ioRouteReturnLine">` directly after `#line` — `#line`
// textContent stays owned by the recognition dialogue table (pinned by
// the reload/recognition playtests). Same sibling discipline as
// `stampJobAcceptedLine` in `aftersignJobAcceptedRender.ts`.
//
// `null` removes the paragraph, so it never leaks into another beat.

import type { AftersignIoFirstSceneLine } from "./ioFirstSceneDialogue";

const ROUTE_RETURN_ID = "ioRouteReturnLine";
const ROUTE_RETURN_DATA_ATTR = "data-aftersign-io-route-return";
const LINE_ID = "line";

export function stampIoRouteReturnLine(
  doc: Document,
  line: Pick<AftersignIoFirstSceneLine, "id" | "text"> | null,
): HTMLElement | null {
  if (line === null) {
    doc.getElementById(ROUTE_RETURN_ID)?.remove();
    return null;
  }
  const lineEl = doc.getElementById(LINE_ID);
  if (!lineEl || !lineEl.parentNode) return null;

  let el = doc.getElementById(ROUTE_RETURN_ID);
  if (!el) {
    el = doc.createElement("p");
    el.id = ROUTE_RETURN_ID;
    lineEl.parentNode.insertBefore(el, lineEl.nextSibling);
  }
  if (el.textContent !== line.text) el.textContent = line.text;
  if (el.getAttribute(ROUTE_RETURN_DATA_ATTR) !== line.id) {
    el.setAttribute(ROUTE_RETURN_DATA_ATTR, line.id);
  }
  return el;
}

export const IO_ROUTE_RETURN_LINE_ID = ROUTE_RETURN_ID;
export const IO_ROUTE_RETURN_LINE_DATA_ATTR = ROUTE_RETURN_DATA_ATTR;
