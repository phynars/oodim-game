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
  safe: "You kept to the light. It saw you home. I noted that.",
  fast: "You took the dark cut. It did not take you. I noted that too.",
});

export function aftersignRouteOutcomeLine(routeRisk) {
  if (typeof routeRisk !== "string") return null;
  return ROUTE_OUTCOME_LINES[routeRisk] ?? null;
}
