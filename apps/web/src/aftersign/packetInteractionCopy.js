const PACKET_BUTTON_COPY = {
  idle: {
    label: "Blue packet",
    hint: "Tap to keep the seal. Hold and pull to break it.",
  },
  sealed: {
    label: "Seal intact.",
    hint: "Io can trust the work wider now.",
  },
  opened: {
    label: "Seal broken.",
    hint: "Io can still use you. Not the same way.",
  },
};

function resolvePacketButtonCopy(state) {
  return PACKET_BUTTON_COPY[state] ?? PACKET_BUTTON_COPY.idle;
}

export function applyPacketButtonCopy({ documentRef = document, state = "idle" } = {}) {
  const packetButton = documentRef.querySelector("#packetButton");
  if (!packetButton) return null;

  const copy = resolvePacketButtonCopy(state);
  const label = packetButton.querySelector(".packet-button__label");
  const hint = packetButton.querySelector(".packet-button__hint");

  if (label) label.textContent = copy.label;
  if (hint) hint.textContent = copy.hint;

  packetButton.dataset.packetButtonCopyState = state;
  packetButton.dataset.aftersignTapChoice = "packet-button";
  packetButton.setAttribute("aria-label", `${copy.label} ${copy.hint}`);

  return copy;
}

export { PACKET_BUTTON_COPY };
