// Player-facing confirmation copy is keyed by the persisted completed
// delivery id; this module owns the player-facing route language.
const DELIVERY_COMPLETE_LINE_BY_ID = Object.freeze({
  "red-tag": "Done. Red tag delivered to Saint Orra. She files it under your name. Come back, and she will know the courier who carried it.",
  "blue-packet": "Done. Blue packet delivered. I set its mark beside your name. When you return, I will remember the road that kept you away.",
});

const DEFAULT_DELIVERY_COMPLETE_LINE = DELIVERY_COMPLETE_LINE_BY_ID["blue-packet"];

export const AFTERSIGN_DELIVERY_COMPLETE_COPY = DELIVERY_COMPLETE_LINE_BY_ID;

/**
 * Returns a safe player-facing completion line for a persisted delivery id.
 */
export function aftersignDeliveryCompleteLine(deliveryId) {
  if (typeof deliveryId !== "string") return DEFAULT_DELIVERY_COMPLETE_LINE;
  return DELIVERY_COMPLETE_LINE_BY_ID[deliveryId] ?? DEFAULT_DELIVERY_COMPLETE_LINE;
}
