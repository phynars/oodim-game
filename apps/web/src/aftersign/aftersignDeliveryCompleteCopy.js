// Frozen delivery-complete copy. The served renderer supplies the durable
// delivery id; this module owns the player-facing route language.
const DELIVERY_COMPLETE_LINE_BY_ID = Object.freeze({
  "red-tag": "Done. Red tag delivered to Saint Orra. She keeps it under your name. When you come back, she will know what you carried.",
  "blue-packet": "Done. Blue packet delivered. I set its mark beside your name. When you return, you will not have to explain which road held you.",
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
