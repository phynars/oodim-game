export const AFTERSIGN_PACKET_BUTTON_COPY = Object.freeze({
  id: "packetButton",
  idleLabel: "Blue packet",
  idleHint: "Tap to keep the seal. Hold and pull to break it.",
  sealedResult: "Seal intact.",
  openedResult: "Seal broken.",
});

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
