const PACKET_BUTTON_COPY = {
  idle: {
    label: "Blue packet",
    hint: "Tap to keep the seal. Hold and pull to break it.",
    ariaLabel: "Blue packet. Tap to keep the seal. Hold and pull to break it.",
  },
  sealed: {
    label: "Seal intact.",
    hint: "Io can trust the work wider now.",
    ariaLabel: "Seal intact. Io can trust the work wider now.",
  },
  opened: {
    label: "Seal broken.",
    hint: "Io can still use you. Not the same way.",
    ariaLabel: "Seal broken. Io can still use you. Not the same way.",
  },
};

function packetButtonCopyFor(state) {
  return PACKET_BUTTON_COPY[state] ?? PACKET_BUTTON_COPY.idle;
}

function writeText(node, value) {
  if (!node) return;
  node.textContent = value;
}

export function applyPacketButtonCopy(state = "idle", root = document) {
  const button = root.querySelector("#packetButton");
  if (!button) return null;

  const copy = packetButtonCopyFor(state);
  const label = button.querySelector("[data-packet-button-label]");
  const hint = button.querySelector("[data-packet-button-hint]");

  writeText(label, copy.label);
  writeText(hint, copy.hint);

  button.setAttribute("aria-label", copy.ariaLabel);
  button.dataset.packetButtonCopyState = PACKET_BUTTON_COPY[state] ? state : "idle";
  button.dataset.aftersignTapChoice = "packet-button";

  return copy;
}

export { PACKET_BUTTON_COPY };
