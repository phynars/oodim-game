// Served-page DOM writer for Io's packet-recall line — the second-session
// acknowledgement that fires at `packet-offered` when the durable
// `state.player.routeRisk` from a PREVIOUS run has been restored. The line
// tells the player Io remembers the route they took last time, and that
// this run's packet was placed with that memory in mind.
//
// SCOPE — what this module owns:
//   • It stamps the recall copy authored in `aftersignPacketRecallCopy.js`
//     into a NEW sibling paragraph `<p id="packetRecallLine">` that lives
//     RIGHT AFTER the served page's `#line` paragraph. Same discipline as
//     the sibling `stampJobAcceptedLine` (PR #1884): `#line` textContent
//     is owned by the beat dialogue table (pinned by
//     `io-phone-ready-look-sound-contract.spec.ts` on `lineText`), so the
//     recall is an ADDITIONAL paragraph, never an overwrite.
//   • It stamps `data-aftersign-packet-recall="<routeOutcome>"` on the
//     paragraph so a tap-driven e2e can select on the exact previous-run
//     token axis (`safe` | `fast` | `failed`).
//
// The caller (aftersign/main.js at the packet-offered render path) hands
// in the previous run's route outcome from `state.player.routeRisk`
// (mapping `lastRoute` + `succeeded` → `"safe" | "fast" | "failed"`) and
// the resolved authored line. `null` clears the transient paragraph when
// the beat ends or state is reset/restored — same shape as
// `stampIoSecondPacketPointer` + `stampJobAcceptedLine`.

const RECALL_ID = "packetRecallLine";
const RECALL_DATA_ATTR = "data-aftersign-packet-recall";
const LINE_ID = "line";

interface DocumentLike {
  getElementById(id: string): {
    parentNode: ParentNodeLike | null;
    nextSibling: NodeLike | null;
  } | null;
  createElement(tagName: string): HTMLElementLike;
}

interface ParentNodeLike {
  insertBefore(newNode: NodeLike, referenceNode: NodeLike | null): void;
}

interface NodeLike {
  parentNode: ParentNodeLike | null;
}

interface HTMLElementLike extends NodeLike {
  id: string;
  textContent: string | null;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
}

/**
 * Stamp the packet-recall line into the `#packetRecallLine` sibling
 * paragraph, immediately after the `#line` paragraph. Creates the
 * paragraph on first call; updates its text + route-outcome data
 * attribute on subsequent calls.
 *
 * Returns the paragraph element (or null if `#line` is not present,
 * which is only possible in a stripped test fixture — the served
 * `aftersign/index.html` ships `#line`).
 *
 * Pass `previousRouteOutcome === null` to tear the paragraph down
 * (fresh boot before any run has completed, or the beat has advanced
 * past `packet-offered`).
 */
export function stampPacketRecallLine(
  doc: Document | DocumentLike,
  previousRouteOutcome: string | null,
  line: string,
): HTMLElement | null {
  const d = doc as unknown as Document;
  if (previousRouteOutcome === null) {
    d.getElementById(RECALL_ID)?.remove();
    return null;
  }
  const lineEl = d.getElementById(LINE_ID);
  if (!lineEl || !lineEl.parentNode) return null;

  let recall = d.getElementById(RECALL_ID) as HTMLElement | null;
  if (!recall) {
    recall = d.createElement("p") as unknown as HTMLElement;
    recall.id = RECALL_ID;
    lineEl.parentNode.insertBefore(recall, lineEl.nextSibling);
  }
  if (recall.textContent !== line) recall.textContent = line;
  if (recall.getAttribute(RECALL_DATA_ATTR) !== previousRouteOutcome) {
    recall.setAttribute(RECALL_DATA_ATTR, previousRouteOutcome);
  }
  return recall;
}

export const PACKET_RECALL_LINE_ID = RECALL_ID;
export const PACKET_RECALL_LINE_DATA_ATTR = RECALL_DATA_ATTR;
