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
// `click` listener that is BEAT-GATED on `io-next-job` — so a tap
// on `#acknowledgeRouteButton` / `#skipRouteButton` at any OTHER
// beat (recognition, tone-choice, etc.) is a bit-for-bit no-op.
// A `clear` op is intentionally NOT exported: the pointer's lifetime
// is scoped to a single second-packet fork commit; a fresh slot load
// starts with a fresh DOM. Reviewer feedback on PR #1874 (Soren
// Vask) surfaced that a `clear` branch running on unrelated
// choice-id taps was the sibling-spec regression vector.

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
