// Player-facing labels for the four route-risk actions that
// `renderRouteRiskChoice` stamps into the packet-choice surface.
//
// Why this module exists (Soren's REQUEST_CHANGES on #1747):
//   `renderRouteRiskChoice` takes an optional `labelForAction`
//   callback; both call sites in `aftersign/main.js` were passing
//   nothing, so the served buttons rendered raw action ids
//   ("take-the-shortcut") instead of authored copy. This module
//   is the resolver those call sites pass in.
//
// Anti-duplication: the two route strings (safe / risky) are
// sourced VERBATIM from the same authored table Io speaks —
// `aftersignJobOfferCopy.js`'s `firstRun` row (`safeRouteLabel` +
// `riskyRouteLabel`). One vocabulary, one source of truth: the
// string Io says in her offer line is the same string the player
// taps on the route buttons. If a future PR wants a per-memory-
// branch label (trusted / opened rows carry different `safeRouteLabel`
// values), it swaps the `chooseAftersignJobOfferCopy(memory)` call
// in below — the resolver's shape stays the same.
//
// Consumers on record:
//   - `aftersign/main.js` (two `renderRouteRiskChoice({...})` sites,
//     both pass `labelForAction: routeRiskActionLabel`).
//   - `routeRiskActionLabels.consumer.test.ts` — pins the source-of-
//     truth invariant: `routeRiskActionLabel("take-the-long-way")`
//     equals `AFTERSIGN_JOB_OFFER_COPY.firstRun.safeRouteLabel`.

import { AFTERSIGN_JOB_OFFER_COPY } from "./aftersignJobOfferCopy.js";

const FIRST_RUN = AFTERSIGN_JOB_OFFER_COPY.firstRun;

/**
 * Player-facing labels for the four `AftersignOfferedAction` ids
 * `computeOfferedActions` can emit. `take-the-long-way` and
 * `take-the-shortcut` re-use the authored route strings from
 * `aftersignJobOfferCopy.firstRun` — no new vocabulary.
 */
export const ROUTE_RISK_ACTION_LABELS = Object.freeze({
  "take-the-long-way": FIRST_RUN.safeRouteLabel,
  "take-the-shortcut": FIRST_RUN.riskyRouteLabel,
  "repair-the-loss": "Repair the loss before you run",
  "carry-a-fragile-packet": "Carry the fragile packet",
});

/**
 * Resolve a route-risk action id to the player-facing label the
 * served button renders. Unknown ids fall back to a safe generic
 * prompt so a future action added to `computeOfferedActions` never
 * ships a raw id to the DOM.
 *
 * @param {string} actionId
 * @returns {string}
 */
export function routeRiskActionLabel(actionId) {
  return ROUTE_RISK_ACTION_LABELS[actionId] ?? "Choose a route";
}
