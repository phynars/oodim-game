// Frozen delivery-complete copy. The served renderer supplies the durable
// delivery id; this module owns the player-facing route language.
const DELIVERY_COMPLETE_LINE_BY_ID = Object.freeze({
  "red-tag": "Done. Red tag delivered to Saint Orra. The pharmacy sign kept your name; the debt is yours to answer.",
  "blue-packet": "Done. Blue route, clean handoff. Come back after the rain; I will know the mark was yours.",
});

const DEFAULT_DELIVERY_COMPLETE_LINE = DELIVERY_COMPLETE_LINE_BY_ID["blue-packet"];

export const AFTERSIGN_DELIVERY_COMPLETE_COPY = DELIVERY_COMPLETE_LINE_BY_ID;

/**
 * Resolve completion copy for the delivered packet identity. Unknown ids keep
 * the established blue-packet fallback rather than exposing a missing token.
 *
 * @param {unknown} deliveryId
 * @returns {string}
 */
export function aftersignDeliveryCompleteLine(deliveryId) {
  if (typeof deliveryId !== "string") return DEFAULT_DELIVERY_COMPLETE_LINE;
  return DELIVERY_COMPLETE_LINE_BY_ID[deliveryId] ?? DEFAULT_DELIVERY_COMPLETE_LINE;
}
