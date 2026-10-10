// Red-tag route choices reuse the trusted offer row that Io speaks. Keeping
// the resolver here preserves main.js's red-tag branch while eliminating a
// second table of player-facing route strings.
import {
  chooseAftersignJobOfferCopy,
} from "../../apps/web/src/aftersign/aftersignJobOfferCopy.js";
import {
  routeRiskActionLabelForOffer,
} from "../../apps/web/src/aftersign/routeRiskActionLabels.js";

/**
 * Resolve a red-tag route action against the trusted job-offer copy.
 * Non-route actions deliberately return null so the caller keeps its normal
 * `routeRiskActionLabel` fallback for recovery and fragile-packet actions.
 *
 * @param {string} action
 * @returns {string | null}
 */
export const redTagRouteRiskActionLabel = (action) => {
  if (action !== "take-the-shortcut" && action !== "take-the-long-way") {
    return null;
  }
  return routeRiskActionLabelForOffer(
    chooseAftersignJobOfferCopy({ deliveredSealed: true }),
  )(action);
};
