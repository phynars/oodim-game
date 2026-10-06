// Io names the route the player actually ran, not merely the job selected.
//
// Contract: returns the authored line for a KNOWN route token, or `null`
// when the token isn't one the copy has a line for. The `null` return
// lets the caller fall back to the base packet-delivered line rather
// than silently mis-crediting the player with a route they didn't run
// (Soren's PR #1963 review flagged the prior `?? safe` default as a
// silent-mis-credit smell — an unknown token would speak "You kept to
// the light" over a route Io never watched).
//
// #2179: the `fast` route class covers TWO actions — the shortcut
// ("take-the-shortcut") AND the fragile packet ("carry-a-fragile-packet").
// Keying the line on the route class alone would credit a fragile-packet
// run with the shortcut's phrasing. The `fast` entry stays action-neutral
// (safe for the shortcut and for old saves with no `lastAction`); when the
// caller passes `lastAction === "carry-a-fragile-packet"` the fragile line
// is spoken instead, so a player who never ran the dark cut is never told
// they did (same action keying as `aftersignPacketRecallToken`).

const ROUTE_OUTCOME_LINES = Object.freeze({
  safe: "You kept to the light. It saw you home. The ledger marks you careful.",
  // #2179: the `fast` class covers BOTH "Cut past the bell rope" and
  // "Carry the fragile packet" (see aftersignPacketRecallCopy.js #2164),
  // and this line is keyed on the class alone. It must name no specific
  // action, or a fragile-packet run gets credited with the dark cut.
  fast: "You took the quick side. It did not take you. The ledger marks you willing.",
  // #2179: spoken only when the caller passes
  // `lastAction === "carry-a-fragile-packet"` into the SAME `fast` class;
  // a direct `aftersignRouteOutcomeLine("fragile")` call returns null, so
  // the token isn't accepted as a route class in its own right.
  fragile: "You carried the fragile one and it arrived whole. The ledger marks you steady.",
  failed: "The dark kept its due. You came back. The ledger marks the cost.",
});

/**
 * @param {unknown} routeRisk route class token: "safe" | "fast" | "failed"
 * @param {unknown} [lastAction] the specific action id that recorded the run
 *   (e.g. "take-the-shortcut" | "carry-a-fragile-packet" | "take-the-long-way")
 * @returns {string | null}
 */
export function aftersignRouteOutcomeLine(routeRisk, lastAction) {
  if (typeof routeRisk !== "string") return null;
  // #2179: fragile-packet runs record `routeRisk === "fast"` but a distinct
  // action id — speak the fragile line so Io never credits the player with
  // the shortcut they didn't take.
  if (routeRisk === "fast" && lastAction === "carry-a-fragile-packet") {
    return ROUTE_OUTCOME_LINES.fragile;
  }
  // `fragile` is reachable ONLY via the (fast, carry-a-fragile-packet) axis
  // above. A raw "fragile" route token is not an accepted class — return
  // null so the caller falls through to the base line, same posture as
  // any other unknown token.
  if (routeRisk === "fragile") return null;
  return ROUTE_OUTCOME_LINES[routeRisk] ?? null;
}
