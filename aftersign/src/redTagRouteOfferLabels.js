// Route-risk button label resolver for the packet-choice surface, chosen
// by DELIVERY IDENTITY rather than memory state.
//
// The red-tag case hard-pins the TRUSTED offer row so an empty / missing
// `npcs.io.memory` can never fall back to the blue-packet first-run
// labels on a red surface. The two trusted route strings are sourced
// from `AFTERSIGN_JOB_OFFER_COPY.trusted` so they stay colocated with
// the row Io speaks in her offer line.
//
// Rule:
//   - `red-tag` delivery  → labels bound to `AFTERSIGN_JOB_OFFER_COPY.trusted`
//                           ("Long way — past the kiosk" /
//                           "Behind the shuttered pharmacy"). Memory
//                           state is IRRELEVANT: the red-tag identity
//                           IS the signal that trusted labels apply.
//   - any other delivery  → the backwards-compatible firstRun resolver
//                           (`routeRiskActionLabel`), unchanged.

import {
  routeRiskActionLabel,
  routeRiskActionLabelForOffer,
} from "../../apps/web/src/aftersign/routeRiskActionLabels.js";
import { AFTERSIGN_JOB_OFFER_COPY } from "../../apps/web/src/aftersign/aftersignJobOfferCopy.js";

/**
 * Resolve route-risk button copy for the packet currently in hand,
 * keyed on `state.delivery.id` alone. The red-tag case is pinned to
 * the TRUSTED offer row so an empty / missing `npcs.io.memory` can
 * never fall back to the blue-packet first-run labels.
 *
 * @param {"blue-packet" | "red-tag" | string} deliveryId
 * @returns {(actionId: string) => string}
 */
export function routeRiskLabelsForDelivery(deliveryId) {
  if (deliveryId === "red-tag") {
    return routeRiskActionLabelForOffer(AFTERSIGN_JOB_OFFER_COPY.trusted);
  }
  return routeRiskActionLabel;
}
