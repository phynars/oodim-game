// AFTERSIGN — packet interaction copy for the served `#packetButton` surface.
//
// This module is deliberately tiny and DOM-facing: `aftersign/main.js`
// imports `applyPacketButtonCopy()` and calls it at boot (`"idle"`) plus
// inside the packet-outcome commit funnel (`"sealed"` / `"opened"`).
// The words here are player-visible slice code, not a harness note. Keep
// Io's ledger voice nearby: a fact, then the consequence.
//
// Contract (pinned by `packetInteractionCopy.consumer.test.ts` against
// the served `aftersign/index.html` markup):
//
//   • The served `#packetButton` hosts a SINGLE `<span>` child. The
//     writer joins `label` and `hint` with " — " and writes the whole
//     line into that one span so no beat of Io's voice is dropped on
//     the played surface.
//   • The button already carries the authored
//     `data-aftersign-tap-choice="packet"` — that's the choice-id the
//     `bootWindowGame.ts` tap-confirm envelope stamps against. This
//     writer MUST NOT overwrite it, or the choose-by-choiceId lookup
//     silently misses.
//   • Unknown states normalize to `idle` — a stale enum from a future
//     caller renders the idle line, never a raw hostile string.
//   • Null-safe: a null element, an undefined element, or a bare
//     `<button>` without a `<span>` child all resolve without throwing.
//     Bare buttons receive the copy on `element.textContent` so the
//     writer degrades gracefully in unit-test harnesses.

// Single source of truth for the three-line vocabulary. The consumer
// test reads these fields DIRECTLY to build its expected strings, so
// any rename here needs a matching update in the test — that coupling
// is intentional: it stops copy drift from ever landing silently.
export const AFTERSIGN_PACKET_BUTTON_COPY = Object.freeze({
  idleLabel: "Blue packet",
  idleHint: "Tap to keep the seal. Hold and pull to break it.",
  sealedResult: "Io can trust the work wider now.",
  openedResult: "Io can still use you. Not the same way.",
});

const PACKET_BUTTON_ID = "packetButton";

const STATE_TO_HINT = Object.freeze({
  idle: AFTERSIGN_PACKET_BUTTON_COPY.idleHint,
  sealed: AFTERSIGN_PACKET_BUTTON_COPY.sealedResult,
  opened: AFTERSIGN_PACKET_BUTTON_COPY.openedResult,
});

const normalizeState = (state) =>
  Object.prototype.hasOwnProperty.call(STATE_TO_HINT, state) ? state : "idle";

/**
 * Resolve the copy shape for a packet-button state. The label stays
 * constant across all three states (the object on the tray never
 * renames itself) — what changes is the second clause, the consequence
 * of the player's gesture. Unknown states fall back to `idle`.
 *
 * @param {"idle"|"sealed"|"opened"} [state="idle"]
 * @returns {{ buttonId: string, label: string, hint: string }}
 */
export const getPacketButtonCopy = (state = "idle") => {
  const resolved = normalizeState(state);
  return {
    buttonId: PACKET_BUTTON_ID,
    label: AFTERSIGN_PACKET_BUTTON_COPY.idleLabel,
    hint: STATE_TO_HINT[resolved],
  };
};

const composeLine = (copy) => `${copy.label} — ${copy.hint}`;

/**
 * Write the resolved copy for `state` into `button`.
 *
 * The served `#packetButton` has ONE `<span>` — we write the joined
 * "label — hint" line into it so both beats of Io's voice land on the
 * visible surface. When no `<span>` exists (unit-test harness with a
 * bare `<button>`), we fall back to `element.textContent`.
 *
 * The `data-aftersign-tap-choice` attribute is left untouched: the
 * served markup authors it as `"packet"` and `bootWindowGame.ts`
 * looks up the tap-confirm envelope by that choice-id. Rewriting it
 * here would silently break the lookup on the very button the finger
 * touches.
 *
 * @param {HTMLElement|null|undefined} button
 * @param {"idle"|"sealed"|"opened"} [state="idle"]
 * @returns {{ buttonId: string, label: string, hint: string }} the resolved copy
 */
export const applyPacketButtonCopy = (button, state = "idle") => {
  const copy = getPacketButtonCopy(state);
  const line = composeLine(copy);
  const resolvedState = normalizeState(state);

  if (!button || typeof button.setAttribute !== "function") {
    return copy;
  }

  // Single-span served surface: write the joined line so the hint
  // never gets dropped. Falls back to the button's own textContent
  // when no span exists (bare-button harness).
  const span =
    (typeof button.querySelector === "function"
      ? button.querySelector("span")
      : null);
  if (span) {
    if (span.textContent !== line) {
      span.textContent = line;
    }
  } else if ("textContent" in button) {
    if (button.textContent !== line) {
      button.textContent = line;
    }
  }

  button.setAttribute("data-packet-button-copy-state", resolvedState);

  return copy;
};
