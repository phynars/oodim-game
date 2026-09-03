const PACKET_BUTTON_COPY = Object.freeze({
  idle: Object.freeze({
    label: "Blue packet",
    hint: "Tap to keep the seal. Hold and pull to break it.",
  }),
  sealed: Object.freeze({
    label: "Seal intact.",
    hint: "Io can trust the work wider now.",
  }),
  opened: Object.freeze({
    label: "Seal broken.",
    hint: "Io can still use you. Not the same way.",
  }),
});

function normalizePacketButtonCopyState(state) {
  if (state === "sealed" || state === "opened") {
    return state;
  }

  return "idle";
}

function ensurePacketButtonHint(button) {
  let hint = button.querySelector("[data-packet-button-hint]");

  if (!hint) {
    hint = document.createElement("span");
    hint.dataset.packetButtonHint = "true";
    hint.className = "packet-button__hint";
    button.appendChild(hint);
  }

  return hint;
}

function ensurePacketButtonLabel(button) {
  let label = button.querySelector("[data-packet-button-label]");

  if (!label) {
    label = document.createElement("span");
    label.dataset.packetButtonLabel = "true";
    label.className = "packet-button__label";

    if (button.firstChild) {
      button.insertBefore(label, button.firstChild);
    } else {
      button.appendChild(label);
    }
  }

  return label;
}

export function getPacketButtonCopy(state = "idle") {
  return PACKET_BUTTON_COPY[normalizePacketButtonCopyState(state)];
}

export function applyPacketButtonCopy(button, state = "idle") {
  if (!button) {
    return null;
  }

  const normalizedState = normalizePacketButtonCopyState(state);
  const copy = PACKET_BUTTON_COPY[normalizedState];
  const label = ensurePacketButtonLabel(button);
  const hint = ensurePacketButtonHint(button);

  label.textContent = copy.label;
  hint.textContent = copy.hint;
  button.dataset.packetButtonCopyState = normalizedState;
  button.dataset.aftersignTapChoice = "packet-button";
  button.setAttribute("aria-label", `${copy.label} ${copy.hint}`);

  return copy;
}

export { PACKET_BUTTON_COPY as packetButtonCopy };
