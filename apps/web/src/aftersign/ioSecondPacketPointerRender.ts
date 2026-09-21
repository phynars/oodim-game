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
// main.js renders from the choice accepted by choose(), never from a
// capture-phase click or a test-specific discriminator. Null clears the
// transient paragraph when the beat ends or state is reset/restored.

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
  choiceId: string | null,
  line: string,
): HTMLElement | null {
  const d = doc as unknown as Document;
  if (choiceId === null) {
    d.getElementById(POINTER_ID)?.remove();
    return null;
  }
  const lineEl = d.getElementById(LINE_ID);
  if (!lineEl || !lineEl.parentNode) return null;

  let pointer = d.getElementById(POINTER_ID) as HTMLElement | null;
  if (!pointer) {
    pointer = d.createElement("p") as unknown as HTMLElement;
    pointer.id = POINTER_ID;
    lineEl.parentNode.insertBefore(pointer, lineEl.nextSibling);
  }
  if (pointer.textContent !== line) pointer.textContent = line;
  if (pointer.getAttribute(POINTER_DATA_ATTR) !== choiceId) {
    pointer.setAttribute(POINTER_DATA_ATTR, choiceId);
  }
  return pointer;
}

export const IO_SECOND_PACKET_POINTER_ID = POINTER_ID;
export const IO_SECOND_PACKET_POINTER_DATA_ATTR = POINTER_DATA_ATTR;
