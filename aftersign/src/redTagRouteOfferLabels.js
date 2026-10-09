import {
  routeRiskActionLabel,
  routeRiskActionLabelForOffer,
} from "../../apps/web/src/aftersign/routeRiskActionLabels.js";

/**
 * Resolve route-risk button copy for the packet currently in hand.
 * Red-tag runs use the same authored offer row Io just spoke; blue-packet
 * runs retain the first-run resolver.
 *
 * @param {"blue-packet" | "red-tag" | string} deliveryId
 * @param {object | null | undefined} offerCopy
 * @returns {(actionId: string) => string}
 */
export function routeRiskLabelsForDelivery(deliveryId, offerCopy) {
  return deliveryId === "red-tag"
    ? routeRiskActionLabelForOffer(offerCopy)
    : routeRiskActionLabel;
}
