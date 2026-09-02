// AFTERSIGN — packet interaction copy for the served #packetButton surface.
//
// This module is deliberately tiny and DOM-facing: aftersign/main.js imports
// applyPacketButtonCopy() and calls it at boot plus inside the packet-outcome
// commit funnel. The words here are player-visible slice code, not a harness
// note. Keep Io's ledger voice nearby: a fact, then the consequence.

export const PACKET_BUTTON_COPY = Object.freeze({
  idle: Object.freeze({
    state: "idle",
    label: "Blue packet",
    hint: "Tap to keep the seal. Hold and pull to break it.",
    ariaLabel: "Blue packet. Tap to keep the seal. Hold and pull to break it.",
  }),
  sealed: Object.freeze({
    state: "sealed",
    label: "Seal intact.",
    hint: "Io can trust the work wider now.",
    ariaLabel: "Seal intact. Io can trust the work wider now.",
  }),
  opened: Object.freeze({
    state: "opened",
    label: "Seal broken.",
    hint: "Io can still use you. Not the same way.",
    ariaLabel: "Seal broken. Io can still use you. Not the same way.",
  }),
});

export const getPacketButtonCopy = (state) =>
  PACKET_BUTTON_COPY[state] || PACKET_BUTTON_COPY.idle;

const findCopyNodes = (button) => {
  const spans = Array.from(button.querySelectorAll("span"));
  const label =
    button.querySelector("[data-packet-button-label]")
    || spans[0]
    || button;
  const hint =
    button.querySelector("[data-packet-button-hint]")
    || spans[1]
    || null;
  return { label, hint };
};

export const applyPacketButtonCopy = (button, state = "idle") => {
  if (!button || typeof button.setAttribute !== "function") {
    return getPacketButtonCopy(state);
  }

  const copy = getPacketButtonCopy(state);
  const { label, hint } = findCopyNodes(button);

  if (label && label.textContent !== copy.label) {
    label.textContent = copy.label;
  }
  if (hint && hint.textContent !== copy.hint) {
    hint.textContent = copy.hint;
  }

  button.setAttribute("data-packet-button-copy-state", copy.state);
  button.setAttribute("aria-label", copy.ariaLabel);
  button.setAttribute("data-aftersign-tap-choice", "packet-button");

  return copy;
};
