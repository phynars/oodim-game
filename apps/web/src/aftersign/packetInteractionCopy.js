// Copy contract for the served-page `#packetButton` surface.
//
// Consumers of this module (grep before touching):
//   - `aftersign/main.js`               — boot + `commitPacketOutcome`
//     both call `applyPacketButtonCopy(packetButton, state)` (POSITIONAL:
//     element FIRST, state SECOND). Any signature flip here is a
//     regression Soren blocks — main.js is the shipped served page.
//   - `aftersign/index.html`            — the button element itself,
//     already carries `data-aftersign-tap-choice="packet"` and an
//     `aria-label` containing the word "open" that the flagship
//     surface contract spec matches on (holdChoiceViaDom, line 644).
//     This writer MUST NOT overwrite either attribute.
//   - `apps/web/src/aftersign/packetInteractionCopy.consumer.test.ts`
//     — jsdom-mounts the real index.html, imports the three named
//     exports below, and drives the three states through a real
//     `<span>` child.
//
// Copy shape (frozen — the consumer test pins every field):
//   idleLabel     — "Blue packet" (constant across states; the label
//                   half of the visible line stays STABLE so the
//                   returning player recognizes the same object even
//                   after the seal changes).
//   idleHint      — pre-tap instruction.
//   sealedResult  — post-tap line for SEALED.
//   openedResult  — post-tap line for OPENED.
//
// Visible line format (rendered into the `<span>` child):
//   `${idleLabel} — ${hint-or-result}`
//
// The em-dash separator is intentional: the returning player scans
// the whole line in one saccade; a hyphen would read as two clauses.

export const AFTERSIGN_PACKET_BUTTON_COPY = Object.freeze({
  idleLabel: "Blue packet",
  idleHint: "Tap to keep the seal. Hold and pull to break it.",
  sealedResult: "Io can trust the work wider now.",
  openedResult: "Io can still use you. Not the same way.",
});

const PACKET_BUTTON_ID = "packetButton";

const HINT_FOR_STATE = Object.freeze({
  idle: AFTERSIGN_PACKET_BUTTON_COPY.idleHint,
  sealed: AFTERSIGN_PACKET_BUTTON_COPY.sealedResult,
  opened: AFTERSIGN_PACKET_BUTTON_COPY.openedResult,
});

/**
 * Normalize an incoming state to the three the writer knows how to
 * render. An unknown / stale enum value falls back to "idle" — the
 * consumer test pins this so a future caller passing a hostile
 * string still renders a legible line rather than an empty `<span>`.
 */
function normalizePacketState(state) {
  if (state === "sealed" || state === "opened" || state === "idle") {
    return state;
  }
  return "idle";
}

/**
 * Pure copy shape for a packet-button state. Same buttonId + label
 * across all three states — only the hint half changes.
 *
 * Called with no argument → returns the idle copy.
 */
export function getPacketButtonCopy(state) {
  const normalized = normalizePacketState(state ?? "idle");
  return {
    buttonId: PACKET_BUTTON_ID,
    label: AFTERSIGN_PACKET_BUTTON_COPY.idleLabel,
    hint: HINT_FOR_STATE[normalized],
  };
}

/**
 * Write the packet-button copy for `state` onto `element`.
 *
 * Positional signature: (element, state). main.js calls
 * `applyPacketButtonCopy(packetButton, "idle" | "sealed" | "opened")`
 * — element FIRST. Do not flip this without updating every consumer.
 *
 * Behavior:
 *   - Null/undefined element → no-op (main.js wraps in try/catch, but
 *     the writer defends anyway so a bootless jsdom mount can't
 *     black-screen).
 *   - Element with a `<span>` child → the `<span>`'s textContent
 *     receives the composed line.
 *   - Element without a `<span>` child → the element's own textContent
 *     receives the composed line (bare-button fallback pinned by the
 *     consumer test).
 *   - Stamps `data-packet-button-copy-state` with the normalized
 *     state so a played spec can pin the transition.
 *   - Does NOT overwrite `data-aftersign-tap-choice` (already set to
 *     `"packet"` on the served element — the harness at
 *     bootWindowGame.ts:1011 matches on that value).
 *   - Does NOT overwrite `aria-label` (the served element already
 *     ships an aria-label containing "open", which
 *     flagship-surface-contract.spec.ts:644 matches on via
 *     holdChoiceViaDom).
 */
export function applyPacketButtonCopy(element, state) {
  if (!element) return;

  const normalized = normalizePacketState(state);
  const copy = getPacketButtonCopy(normalized);
  const line = `${copy.label} — ${copy.hint}`;

  const span =
    typeof element.querySelector === "function"
      ? element.querySelector("span")
      : null;
  const target = span ?? element;

  try {
    target.textContent = line;
  } catch {
    /* decorative — must never throw */
  }

  if (element.setAttribute) {
    try {
      element.setAttribute("data-packet-button-copy-state", normalized);
    } catch {
      /* decorative */
    }
  }
}
