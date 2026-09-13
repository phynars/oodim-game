// Player-facing labels for the route-risk actions stamped into the kiosk
// packet-choice surface. Keeping this vocabulary in a small runtime module
// prevents a renderer from exposing raw action ids when a new route branch
// is added.
export const ROUTE_RISK_ACTION_LABELS = Object.freeze({
  "take-the-long-way": "Take the long lit stair",
  "repair-the-loss": "Repair the loss before you run",
  "take-the-shortcut": "Take the dark shortcut",
  "carry-a-fragile-packet": "Carry the fragile packet",
});

export function routeRiskActionLabel(actionId) {
  return ROUTE_RISK_ACTION_LABELS[actionId] ?? "Choose a route";
}
