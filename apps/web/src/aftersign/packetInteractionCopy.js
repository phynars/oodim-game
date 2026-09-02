// Aftersign packet-button copy — the words the player reads on the
// `#packetButton` surface across its three visible states (idle before
// they gesture, sealed after a plain tap, opened after a hold+pull).
// The button itself is authored in `aftersign/index.html`
// (id="packetButton", class="packet-button"). The served-page consumer
// is `aftersign/main.js`:
//   - on boot, calls `applyPacketButtonCopy(packetButton, "idle")` so
//     the initial `<span>` reads label + hint;
//   - inside `commitPacketOutcome(outcome)` — the ONE funnel where
//     PACKET_OUTCOME.SEALED / PACKET_OUTCOME.OPENED lands from the
//     PacketIntentController — calls `applyPacketButtonCopy(...,
//     "sealed" | "opened")` so the visible span flips to the outcome
//     line the same frame the state commits.
// The sibling `packetInteractionCopy.consumer.test.ts` mounts the
// exact `<button id="packetButton"><span>…</span></button>` markup
// from `index.html`, simulates a tap-driven commit, and asserts the
// visible text + `data-packet-button-copy-state` update. So this
// module is now a shipped consumer of a rendered surface — not a
// pure module reviewed in isolation.

export const AFTERSIGN_PACKET_BUTTON_COPY = Object.freeze({
  id: "packetButton",
  idleLabel: "Blue packet",
  idleHint: "Tap to keep the seal. Hold and pull to break it.",
  sealedResult: "Io can trust the work wider now.",
  openedResult: "Io can still use you. Not the same way.",
});

/**
 * Resolve the label + hint pair for a packet-button state.
 *
 * @param {"idle" | "sealed" | "opened"} [packetState="idle"]
 * @returns {{ buttonId: string, label: string, hint: string }}
 */
export function getPacketButtonCopy(packetState = "idle") {
  if (packetState === "sealed") {
    return {
      buttonId: AFTERSIGN_PACKET_BUTTON_COPY.id,
      label: AFTERSIGN_PACKET_BUTTON_COPY.idleLabel,
      hint: AFTERSIGN_PACKET_BUTTON_COPY.sealedResult,
    };
  }

  if (packetState === "opened") {
    return {
      buttonId: AFTERSIGN_PACKET_BUTTON_COPY.id,
      label: AFTERSIGN_PACKET_BUTTON_COPY.idleLabel,
      hint: AFTERSIGN_PACKET_BUTTON_COPY.openedResult,
    };
  }

  return {
    buttonId: AFTERSIGN_PACKET_BUTTON_COPY.id,
    label: AFTERSIGN_PACKET_BUTTON_COPY.idleLabel,
    hint: AFTERSIGN_PACKET_BUTTON_COPY.idleHint,
  };
}

/**
 * Write the resolved copy onto the rendered `#packetButton` element.
 * The button's authored markup is `<button id="packetButton" …>
 * <span>…</span></button>` (see aftersign/index.html); the span is
 * the ONLY child the player reads, so this writer targets it
 * specifically. If the span is missing (test scaffold, degraded
 * markup) we fall back to `element.textContent`, so a caller that
 * hands us a bare button still gets a visible update.
 *
 * Stamps `data-packet-button-copy-state` so a played-through spec
 * or dev overlay can pin the visible state without parsing text.
 *
 * MUST NOT THROW — copy writes are decorative and run in a hot input
 * path. A null element or a hostile shape early-returns.
 *
 * @param {Element | null | undefined} element
 * @param {"idle" | "sealed" | "opened"} [packetState="idle"]
 * @returns {void}
 */
export function applyPacketButtonCopy(element, packetState = "idle") {
  if (!element || typeof element.setAttribute !== "function") return;
  const copy = getPacketButtonCopy(packetState);
  const nextState =
    packetState === "sealed" || packetState === "opened" ? packetState : "idle";
  element.setAttribute("data-packet-button-copy-state", nextState);
  const visibleText = `${copy.label} — ${copy.hint}`;
  const span =
    typeof element.querySelector === "function"
      ? element.querySelector("span")
      : null;
  if (span) {
    if (span.textContent !== visibleText) {
      span.textContent = visibleText;
    }
    return;
  }
  if (element.textContent !== visibleText) {
    element.textContent = visibleText;
  }
}
