// Served-page DOM writer for Io's packet-recall line — the beat that
// speaks the frame `packet-offered` re-enters on a save record with a
// prior route on `state.player.routeRisk`.
//
// SCOPE — what this module owns:
//   • It stamps the recall copy authored in
//     `aftersignPacketRecallCopy.js` into a NEW sibling paragraph
//     `<p id="packetRecallLine">` that lives RIGHT AFTER the served
//     page's `#line` paragraph. Sibling, not overwrite — `#line`'s
//     textContent stays owned by the beat dialogue table in
//     `ioRecognitionDialogue.ts` (contract-pinned by
//     `io-phone-ready-look-sound-contract.spec.ts` on `lineText`).
//     Same discipline as PR #1874's `#ioSecondPacketPointer` and
//     PR #1884's `#jobTakeAckLine`.
//   • It stamps `data-aftersign-packet-recall="<token>"` on the
//     paragraph so a tap-driven e2e can select on the exact route
//     axis (`safe` / `fast` / `failed`) the player actually ran.
//
// main.js derives the token from `state.player.routeRisk` at
// `packet-offered` and passes `null` (with an empty string line)
// elsewhere to clear the transient paragraph — same shape as
// `stampIoSecondPacketPointer` and `stampJobAcceptedLine`.

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
 * paragraph on first call; updates its text + token data attribute
 * on subsequent calls; tears down cleanly on `null`.
 *
 * A non-null `token` paired with an empty `line` (e.g. an
 * unrecognised token that resolved to `""` via
 * `aftersignPacketRecallLine`) is treated as a teardown — the beat
 * has no recallable copy to render, and a blank paragraph would be
 * a template-token-shaped smell to a QA reader.
 *
 * Returns the paragraph element (or null when the token is null /
 * the line is empty / `#line` is not present).
 */
export function stampPacketRecallLine(
  doc: Document | DocumentLike,
  token: string | null,
  line: string,
): HTMLElement | null {
  const d = doc as unknown as Document;
  if (token === null || line === "") {
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
  if (recall.getAttribute(RECALL_DATA_ATTR) !== token) {
    recall.setAttribute(RECALL_DATA_ATTR, token);
  }
  return recall;
}

export const PACKET_RECALL_LINE_ID = RECALL_ID;
export const PACKET_RECALL_LINE_DATA_ATTR = RECALL_DATA_ATTR;
