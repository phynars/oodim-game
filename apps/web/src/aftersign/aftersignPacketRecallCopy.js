/**
 * Io's second-session acknowledgement of the route a courier last chose.
 * These lines are dialogue data only; persistence and rendering remain owned
 * by the existing route and packet systems.
 *
 * Contract: the token vocabulary is the SAME axis Io already speaks on at
 * `packet-delivered` — `aftersignRouteOutcomeCopy.js` and the durable
 * `state.player.routeRisk` (see `apps/web/src/aftersign/routeRiskMemory.ts`)
 * both persist one of `"safe" | "fast" | "failed"`. This recall table
 * shares that axis so a caller can hand off the previous run's outcome
 * without a translation layer — one source, no drift. `aftersignPacketRecallLine`
 * returns `null` for any unknown token (same safe default as
 * `aftersignRouteOutcomeLine`), so an unrestored fresh boot falls through
 * to the base packet-offered line rather than silently mis-crediting.
 */
export const AFTERSIGN_PACKET_RECALL_COPY = Object.freeze({
  safe: "You kept to the lamps last time. I left this one where a careful hand would find it.",
  fast: "You took the dark last time. I left the next packet where only a fast hand would look.",
  failed: "The dark took its due last time. You came back. I did not put that faith anywhere else.",
});

export const AFTERSIGN_PACKET_RECALL_ROUTE_TOKENS = Object.freeze([
  "safe",
  "fast",
  "failed",
]);

export function aftersignPacketRecallLine(previousRouteOutcome) {
  if (typeof previousRouteOutcome !== "string") return null;
  return AFTERSIGN_PACKET_RECALL_COPY[previousRouteOutcome] ?? null;
}
