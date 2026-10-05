// Io names the route the player actually ran, not merely the job selected.
//
// Contract: returns the authored line for a KNOWN route token, or `null`
// when the token isn't one the copy has a line for. The `null` return
// lets the caller fall back to the base packet-delivered line rather
// than silently mis-crediting the player with a route they didn't run
// (Soren's PR #1963 review flagged the prior `?? safe` default as a
// silent-mis-credit smell — an unknown token would speak "You kept to
// the light" over a route Io never watched).

const ROUTE_OUTCOME_LINES = Object.freeze({
  safe: "You kept to the light. It saw you home. The ledger marks you careful.",
  // #2179: the `fast` class covers BOTH "Cut past the bell rope" and
  // "Carry the fragile packet" (see aftersignPacketRecallCopy.js #2164),
  // and this line is keyed on the class alone. It must name no specific
  // action, or a fragile-packet run gets credited with the dark cut.
  fast: "You took the quick side. It did not take you. The ledger marks you willing.",
  failed: "The dark kept its due. You came back. The ledger marks the cost.",
});

export function aftersignRouteOutcomeLine(routeRisk) {
  if (typeof routeRisk !== "string") return null;
  return ROUTE_OUTCOME_LINES[routeRisk] ?? null;
}
