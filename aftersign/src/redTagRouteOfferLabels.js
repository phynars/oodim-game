// Route-risk button label resolver for the packet-choice surface, chosen
// by DELIVERY IDENTITY rather than memory state.
//
// Why this module exists (Soren's REQUEST_CHANGES on PR #2253):
//   The first draft of #2245's wire-up derived the offer-copy row from
//   `npcs.io.memory`'s `delivery-outcome` fact and passed it through
//   `chooseAftersignJobOfferCopy`. That selector returns the FIRST_RUN
//   row (`"Lit stair — under Io's window"` / `"Cut past the bell rope"`)
//   whenever the outcome is missing — exactly the state a round-2
//   red-tag second-packet handoff hits before the player has made ANY
//   delivery, so the regression printed the blue-packet labels on a
//   red-tag surface. This module hard-pins the trusted row for every
//   red-tag delivery by delivery identity, while routing through the
//   frozen offer-copy table so the two route strings stay sourced from
//   one place (the same row Io speaks in her offer line).
//
//   Historical note: an earlier draft header described a sibling
//   `redTagRouteLabels.js` as "deleted". That file is NOT deleted in
//   this diff — Soren's AI007 on PR #2253 iter-1 flagged the stale
//   claim. Nothing imports it anymore; its removal is a separate
//   sweep outside the scope of #2245's wire-up fix.
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
