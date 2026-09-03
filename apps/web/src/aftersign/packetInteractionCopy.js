// Three-state copy writer for the served `#packetButton` on
// `aftersign/index.html`. Owns ONLY the visible text the player
// reads and a `data-packet-button-copy-state` stamp — never touches
// the button's shipped `data-aftersign-tap-choice` (the harness
// matches `=== "packet"` — see bootWindowGame.ts:1011 and
// aftersign/main.js:1624) nor the served `aria-label` (pinned by
// `servedSurface.contract.test.ts`). Consumer contract lives in
// `packetInteractionCopy.consumer.test.ts`; boot + commit call
// sites are `aftersign/main.js` :: init (idle) and
// `commitPacketOutcome` (sealed | opened).

export const AFTERSIGN_PACKET_BUTTON_COPY = Object.freeze({
  idleLabel: "Blue packet",
  idleHint: "Tap to keep the seal. Hold and pull to break it.",
  sealedResult: "Seal intact. Io can risk wider work.",
  openedResult: "Seal broken. Io can still use you. Not the same way.",
});

const PACKET_BUTTON_ID = "packetButton";

function normalizePacketState(state) {
  if (state === "sealed" || state === "opened") {
    return state;
  }
  return "idle";
}

function resolveHint(normalizedState) {
  if (normalizedState === "sealed") return AFTERSIGN_PACKET_BUTTON_COPY.sealedResult;
  if (normalizedState === "opened") return AFTERSIGN_PACKET_BUTTON_COPY.openedResult;
  return AFTERSIGN_PACKET_BUTTON_COPY.idleHint;
}

export function getPacketButtonCopy(state = "idle") {
  const normalized = normalizePacketState(state);
  return {
    buttonId: PACKET_BUTTON_ID,
    label: AFTERSIGN_PACKET_BUTTON_COPY.idleLabel,
    hint: resolveHint(normalized),
  };
}

// Null-safe writer. Writes `"${label} — ${hint}"` into the button's
// `<span>` child; if the caller passes a bare button with no span,
// falls back to `element.textContent` so a fresh DOM never
// black-screens boot. Never touches `data-aftersign-tap-choice`
// (harness key) or `aria-label` (served contract).
export function applyPacketButtonCopy(button, state = "idle") {
  if (!button) return null;

  const normalized = normalizePacketState(state);
  const label = AFTERSIGN_PACKET_BUTTON_COPY.idleLabel;
  const hint = resolveHint(normalized);
  const text = `${label} — ${hint}`;

  const span = typeof button.querySelector === "function"
    ? button.querySelector("span")
    : null;

  if (span) {
    span.textContent = text;
  } else {
    button.textContent = text;
  }

  if (button.dataset) {
    button.dataset.packetButtonCopyState = normalized;
  } else if (typeof button.setAttribute === "function") {
    button.setAttribute("data-packet-button-copy-state", normalized);
  }

  return { buttonId: PACKET_BUTTON_ID, label, hint };
}
