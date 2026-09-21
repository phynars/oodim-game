// Served-page DOM writer for Io's Saint-Orra pointer line — the beat
// that fires the instant the player commits to one of the two second-
// packet choices (`accept-second-packet` / `ask-what-changed`),
// pointing them at the Saint Orra door rather than restating the
// offer.
//
// SCOPE — what this module owns:
//   • It stamps the pointer copy authored in
//     `aftersign/src/ioSecondPacketResponseVoice.ts` into a NEW
//     sibling paragraph `<p id="ioSecondPacketPointer">` that lives
//     RIGHT AFTER the served page's `#line` paragraph. This preserves
//     the invariant that `#line` textContent is owned by the beat
//     dialogue table in `ioRecognitionDialogue.ts` (pinned by
//     `io-phone-ready-look-sound-contract.spec.ts` on `lineText`) —
//     the pointer is an ADDITIONAL beat, not a replacement.
//   • It stamps `data-aftersign-io-second-packet-pointer="<choiceId>"`
//     on the paragraph so a tap-driven e2e can select on the exact
//     choice-id axis.
//
// Consumer contract: `aftersign/main.js` imports the stamp function
// at top level and wires it through a delegated document-level
// `click` listener with a DUAL gate — the button's `data-choice-id`
// must be one of the two second-packet ids AND the runtime snapshot
// (`window.__game.getSnapshot()`) must report both (a) the terminal
// second-packet beat and (b) a committed return tone on
// `state.player.returnReason`. Both conditions must hold; either
// failing is a bit-for-bit no-op. That dual gate is the correction
// to iteration-7 review feedback (Soren Vask, PR #1874): a
// data-choice-id gate alone is insufficient because the sibling
// second-packet copy module stamps those ids on the two route
// buttons whenever the fork is offered — including on sibling
// specs' playthroughs. Reading the runtime snapshot is what
// distinguishes THIS PR's fork commit from any other tap.
// A `clear` op is intentionally NOT exported: the pointer's lifetime
// is scoped to a single second-packet fork commit; a fresh slot load
// starts with a fresh DOM.

const POINTER_ID = "ioSecondPacketPointer";
const POINTER_DATA_ATTR = "data-aftersign-io-second-packet-pointer";
const LINE_ID = "line";

interface DocumentLike {
  getElementById(id: string): { parentNode: ParentNodeLike | null; nextSibling: NodeLike | null } | null;
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
 * Stamp the Saint-Orra pointer line into the `#ioSecondPacketPointer`
 * sibling paragraph, immediately after the `#line` paragraph. Creates
 * the paragraph on first call; updates its text + choice-id data
 * attribute on subsequent calls.
 *
 * Returns the paragraph element (or null if `#line` is not present,
 * which is only possible in a stripped test fixture — the served
 * `aftersign/index.html` ships `#line`).
 */
export function stampIoSecondPacketPointer(
  doc: Document | DocumentLike,
  choiceId: string,
  line: string,
): HTMLElement | null {
  const d = doc as unknown as Document;
  const lineEl = d.getElementById(LINE_ID);
  if (!lineEl || !lineEl.parentNode) return null;

  let pointer = d.getElementById(POINTER_ID) as HTMLElement | null;
  if (!pointer) {
    pointer = d.createElement("p") as unknown as HTMLElement;
    pointer.id = POINTER_ID;
    lineEl.parentNode.insertBefore(pointer, lineEl.nextSibling);
  }
  pointer.textContent = line;
  pointer.setAttribute(POINTER_DATA_ATTR, choiceId);
  return pointer;
}

export const IO_SECOND_PACKET_POINTER_ID = POINTER_ID;
export const IO_SECOND_PACKET_POINTER_DATA_ATTR = POINTER_DATA_ATTR;
