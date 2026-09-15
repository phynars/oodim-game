export type PacketOfferBeat = "packet-offered" | "packet-choice" | string;

/**
 * Job offers are the visible first action. A real offer tap may enter the
 * packet decision once; it cannot advance or restart any later beat.
 */
export function packetOfferTapNextBeat(beat: PacketOfferBeat): PacketOfferBeat {
  return beat === "packet-offered" ? "packet-choice" : beat;
}

export function runPacketOfferTapTransitionChecks(): void {
  if (packetOfferTapNextBeat("packet-offered") !== "packet-choice") {
    throw new Error("an offer tap must reveal the packet choice");
  }
  if (packetOfferTapNextBeat("packet-choice") !== "packet-choice") {
    throw new Error("an offer tap must not restart the packet choice");
  }
  if (packetOfferTapNextBeat("arrival") !== "arrival") {
    throw new Error("an offer tap must not advance a later beat");
  }
}
