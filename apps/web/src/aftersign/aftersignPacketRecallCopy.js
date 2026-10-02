const PACKET_RECALL_LINES = Object.freeze({
  safe: "Io kept the route lit because you brought the packet back sealed. The next door opens.",
  fast: "Io remembers you beat the bell. Speed buys a harder handoff next time.",
  failed: "Io remembers the packet came back wrong. The repair job is waiting where you left the mark.",
});

/**
 * Returns the recalled consequence of a prior packet run.
 * @param {"safe" | "fast" | "failed"} token
 */
export function aftersignPacketRecallLine(token) {
  return PACKET_RECALL_LINES[token] ?? PACKET_RECALL_LINES.safe;
}
