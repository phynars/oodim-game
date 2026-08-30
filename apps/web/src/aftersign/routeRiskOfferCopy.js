// Visible served-offer copy for the M-LOOP route/risk readout (#1551).
// Values are preserved verbatim from HANDOFF-1535.md.

export function formatAftersignRouteRiskOffer(copy) {
  return `Route: ${copy.route}\nRisk: ${copy.risk}`;
}
