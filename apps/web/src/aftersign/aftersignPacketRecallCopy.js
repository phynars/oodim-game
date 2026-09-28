/**
 * Io's second-session acknowledgement of the route a courier last chose.
 * These lines are dialogue data only; persistence and rendering remain owned
 * by the existing route and packet systems.
 */
export const AFTERSIGN_PACKET_RECALL_COPY = Object.freeze({
  fast: "You took the dark last time. I left the next packet where only a fast hand would look.",
  careful: "You kept to the lamps last time. This one has waited for someone who knows how to bring a thing home.",
  failed: "The dark took its due last time. You came back. I did not put that faith anywhere else.",
});

export function aftersignPacketRecallLine(previousRouteOutcome) {
  return AFTERSIGN_PACKET_RECALL_COPY[previousRouteOutcome] ?? null;
}
