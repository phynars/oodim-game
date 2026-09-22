// Served-page DOM writer for Io's job-acceptance line — the beat that
// fires the instant the player taps `#job-offer-<jobId>` at the
// `packet-offered` beat.
//
// SCOPE — what this module owns:
//   • It stamps the acceptance copy authored in
//     `aftersignJobAcceptedCopy.js` into a NEW sibling paragraph
//     `<p id="jobTakeAckLine">` that lives RIGHT AFTER the served
//     page's `#line` paragraph. This preserves the invariant that
//     `#line` textContent is owned by the beat dialogue table in
//     `ioRecognitionDialogue.ts` (pinned by
//     `io-phone-ready-look-sound-contract.spec.ts` on `lineText`) —
//     the ack is an ADDITIONAL beat, not a replacement.
//   • It stamps `data-aftersign-job-take-ack="<jobId>"` on the
//     paragraph so a tap-driven e2e can select on the exact
//     jobId axis (same discipline as
//     `data-aftersign-io-second-packet-pointer` from PR #1874).
//
// main.js renders from the jobId committed by `choose()`, never from
// a capture-phase click or a test-specific discriminator. `null`
// clears the transient paragraph when the beat ends or state is
// reset/restored — same shape as `stampIoSecondPacketPointer`.

const ACK_ID = "jobTakeAckLine";
const ACK_DATA_ATTR = "data-aftersign-job-take-ack";
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
 * Stamp the job-acceptance line into the `#jobTakeAckLine` sibling
 * paragraph, immediately after the `#line` paragraph. Creates the
 * paragraph on first call; updates its text + jobId data attribute
 * on subsequent calls.
 *
 * Returns the paragraph element (or null if `#line` is not present,
 * which is only possible in a stripped test fixture — the served
 * `aftersign/index.html` ships `#line`).
 */
export function stampJobAcceptedLine(
  doc: Document | DocumentLike,
  jobId: string | null,
  line: string,
): HTMLElement | null {
  const d = doc as unknown as Document;
  if (jobId === null) {
    d.getElementById(ACK_ID)?.remove();
    return null;
  }
  const lineEl = d.getElementById(LINE_ID);
  if (!lineEl || !lineEl.parentNode) return null;

  let ack = d.getElementById(ACK_ID) as HTMLElement | null;
  if (!ack) {
    ack = d.createElement("p") as unknown as HTMLElement;
    ack.id = ACK_ID;
    lineEl.parentNode.insertBefore(ack, lineEl.nextSibling);
  }
  if (ack.textContent !== line) ack.textContent = line;
  if (ack.getAttribute(ACK_DATA_ATTR) !== jobId) {
    ack.setAttribute(ACK_DATA_ATTR, jobId);
  }
  return ack;
}

export const JOB_TAKE_ACK_LINE_ID = ACK_ID;
export const JOB_TAKE_ACK_LINE_DATA_ATTR = ACK_DATA_ATTR;
