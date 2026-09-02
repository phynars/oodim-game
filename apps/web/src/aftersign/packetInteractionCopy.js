// Packet-button copy writer.
//
// The player's only interaction on the packet beat is the single served
// `<button id="packetButton" class="packet-button" data-aftersign-tap-choice="packet">`
// in `aftersign/index.html` — hosting one bare `<span>` child that shows
// the visible line. This module owns the WORDS on that span through the
// three states the beat moves it through: idle (before the gesture),
// sealed (a plain tap), opened (hold + pull).
//
// Contract (pinned by `packetInteractionCopy.consumer.test.ts`, which
// drives the REAL served `aftersign/index.html` in JSDOM):
//
//   • Primitive `AFTERSIGN_PACKET_BUTTON_COPY` exposes the four editable
//     fields — `idleLabel`, `idleHint`, `sealedResult`, `openedResult` —
//     so a writer and a played e2e read the SAME strings.
//   • `getPacketButtonCopy(state?)` returns the resolved
//     `{ buttonId, label, hint }` for a given state; unknown / missing
//     state normalizes to `"idle"`.
//   • `applyPacketButtonCopy(element, state)` is POSITIONAL — the served
//     surface calls it as `applyPacketButtonCopy(packetButton, "sealed")`.
//     It writes `${label} — ${hint}` into the button's `<span>` child, or
//     falls back to the element's `textContent` if no span is present
//     (so a fresh DOM without a span never black-screens boot). It
//     stamps `data-packet-button-copy-state` with the RESOLVED state
//     (unknowns normalize to `"idle"`) so a played spec can trust the
//     seam. Null / undefined element is a no-op — MUST NEVER throw.
//   • It DOES NOT touch `data-aftersign-tap-choice` — the served HTML
//     stamps that as `"packet"` and the harness matches on that exact
//     value (see `bootWindowGame.ts` tap-confirm envelope path).
//   • It DOES NOT stamp `aria-label`. The served `index.html` authors
//     `aria-label="Tap the packet to preserve the seal, or hold to
//     open it"` — the only string on the packet button carrying the
//     word "open" — and the e2e helper `holdChoiceViaDom(["open-packet",
//     "open packet", "open"], …)` in
//     `aftersign/e2e/flagship-surface-contract.spec.ts` locates the
//     holdable control by matching those needles against `aria-label`,
//     `textContent`, or `id`. Overwriting the authored aria-label
//     with the resolved copy (which never contains "open") reds the
//     M-WIRE-EINT e2e. The authored aria-label is load-bearing for
//     the spec as written — leave it alone.
//
// Scope guard: this module ONLY writes copy. It does not attach click
// handlers, does not compute packet outcome, does not decide when to
// call itself — those live at the call site (played specs + the harness
// wire). Keeping this module inert is what lets it be tested against
// the real served DOM without booting the scene graph.

const AFTERSIGN_PACKET_BUTTON_COPY = Object.freeze({
  idleLabel: "Blue packet",
  idleHint: "Tap to keep the seal. Hold and pull to break it.",
  sealedResult: "Io can trust the work wider now.",
  openedResult: "Io can still use you. Not the same way.",
});

const PACKET_BUTTON_ID = "packetButton";

const VALID_STATES = new Set(["idle", "sealed", "opened"]);

function normalizePacketState(state) {
  return VALID_STATES.has(state) ? state : "idle";
}

function resolveHintForState(state) {
  switch (state) {
    case "sealed":
      return AFTERSIGN_PACKET_BUTTON_COPY.sealedResult;
    case "opened":
      return AFTERSIGN_PACKET_BUTTON_COPY.openedResult;
    case "idle":
    default:
      return AFTERSIGN_PACKET_BUTTON_COPY.idleHint;
  }
}

/**
 * Resolve the copy shape for a given packet state.
 *
 * Returns `{ buttonId, label, hint }`. Unknown states normalize to
 * `"idle"`. Called with no argument — treated as idle.
 */
export function getPacketButtonCopy(state) {
  const resolved = normalizePacketState(state);
  return {
    buttonId: PACKET_BUTTON_ID,
    label: AFTERSIGN_PACKET_BUTTON_COPY.idleLabel,
    hint: resolveHintForState(resolved),
  };
}

/**
 * Write the packet-button copy for `state` into `element`'s `<span>`
 * child (or fall back to `element.textContent` if no span is present).
 *
 * Positional signature — matches the call site the served surface uses:
 *   applyPacketButtonCopy(packetButton, "idle" | "sealed" | "opened")
 *
 * Null / undefined `element` is a no-op. Unknown `state` normalizes to
 * `"idle"` (visible text AND `data-packet-button-copy-state` stamp).
 * The writer NEVER throws — the served-DOM contract test pins that
 * so a fresh boot without the expected span never black-screens.
 */
export function applyPacketButtonCopy(element, state) {
  if (!element || typeof element.querySelector !== "function") {
    return null;
  }

  const resolvedState = normalizePacketState(state);
  const copy = getPacketButtonCopy(resolvedState);
  const visibleText = `${copy.label} — ${copy.hint}`;

  const span = element.querySelector("span");
  if (span) {
    span.textContent = visibleText;
  } else {
    // Bare button (no <span> child) — write into the element itself
    // rather than throwing. The served surface DOES host a span, but
    // this fallback keeps the writer safe against a fresh DOM in
    // tests and future refactors.
    element.textContent = visibleText;
  }

  if (typeof element.setAttribute === "function") {
    element.setAttribute("data-packet-button-copy-state", resolvedState);
    // Intentionally do NOT stamp aria-label — see module header. The
    // authored aria-label in the served index.html carries the "open"
    // needle that the M-WIRE-EINT e2e's holdChoiceViaDom depends on.
  }

  return copy;
}

export { AFTERSIGN_PACKET_BUTTON_COPY };
