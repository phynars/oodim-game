// Red-tag route choices are destination-specific. They must never reuse
// the blue-packet first-run labels after Io hands off Saint Orra's packet.
export const RED_TAG_ROUTE_LABELS = Object.freeze({
  "take-the-shortcut": "Behind the shuttered pharmacy",
  "take-the-long-way": "Long way — past the kiosk",
});

export const redTagRouteRiskActionLabel = (action) =>
  RED_TAG_ROUTE_LABELS[action] ?? null;
