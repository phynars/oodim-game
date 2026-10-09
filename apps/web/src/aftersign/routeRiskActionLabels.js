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
// `aftersignJobOfferCopy.js`'s row per memory branch
// (`firstRun` / `trusted` / `opened`), each carrying
// `safeRouteLabel` + `riskyRouteLabel`. One vocabulary, one
// source of truth: the string Io says in her offer line is the
// same string the player taps on the route buttons.
//
// Round-2 red-tag second-packet (#2241 — split from #2240):
//   On a round-2 second-packet accept, the SHIPPED packet-button
//   label swaps to "Red tag — Saint Orra" via
//   `commitPacketOutcome` in `aftersign/main.js` (overrides
//   `applyButtonCopy` when `state.delivery.id === "red-tag"`;
//   pinned by `aftersign/e2e/red-tag-packet-choice-retention.spec.ts`).
//   The route-choice buttons on the following `packet-choice`
//   beat MUST then speak the TRUSTED row's labels
//   (`"Long way — past the kiosk"` / `"Behind the shuttered
//   pharmacy"`), NOT the `firstRun` row's blue-packet defaults
//   (`"Lit stair — under Io's window"` / `"Cut past the bell rope"`).
//   `routeRiskActionLabelForOffer(offerCopy)` is the factory the
//   caller passes a specific memory branch's offer-copy to; it
//   returns a resolver bound to that row's safe / risky labels.
//
// Consumers on record:
//   - `aftersign/main.js` (two `renderRouteRiskChoice({...})` sites,
//     today both pass `labelForAction: routeRiskActionLabel` — the
//     firstRun-pinned resolver kept as default for backwards
//     compatibility. The round-2 red-tag wire-up swaps the second
//     site to `labelForAction: routeRiskActionLabelForOffer(
//     chooseAftersignJobOfferCopy(memory))` once `state.delivery.id`
//     is known — tracked in follow-up issue #2245 ([#2241 B2] Wire
//     routeRiskActionLabelForOffer into main.js round-2 red-tag
//     renderRouteRiskChoice call site; carries the e2e scaffold for
//     the tap-driven assertion the resolver's consumer test cannot
//     express). This PR ships the pure resolver + unit tests only;
//     the wire-up itself is intentionally deferred so this diff
//     stays reviewable at one logical step. The resolver is
//     SHIPPED-READY: it imports from the frozen offer-copy module,
//     accepts the exact row shape `chooseAftersignJobOfferCopy()`
//     returns, and falls back to the firstRun labels on malformed
//     input — #2245's wire-up is a two-line swap, not a redesign).
//   - `routeRiskActionLabels.consumer.test.ts` — pins the source-of-
//     truth invariant: `routeRiskActionLabel("take-the-long-way")`
//     equals `AFTERSIGN_JOB_OFFER_COPY.firstRun.safeRouteLabel`.
//   - `routeRiskActionLabelForOffer.consumer.test.ts` — pins the
//     memory-branch divergence: a resolver bound to the TRUSTED row
//     produces the red-tag labels, not the firstRun blue-packet
//     defaults.

import { AFTERSIGN_JOB_OFFER_COPY } from "./aftersignJobOfferCopy.js";

const FIRST_RUN = AFTERSIGN_JOB_OFFER_COPY.firstRun;

/**
 * Shape the resolver reads: an object with `safeRouteLabel` and
 * `riskyRouteLabel` string fields. Every row of
 * `AFTERSIGN_JOB_OFFER_COPY` satisfies this — the factory below
 * accepts any of them.
 *
 * @typedef {{ safeRouteLabel: string, riskyRouteLabel: string }} AftersignOfferRouteLabels
 */

/**
 * Build the route-risk action labels for a given offer-copy row.
 * Keeps the two generic action ids (`repair-the-loss`,
 * `carry-a-fragile-packet`) at their stable copy — those are not
 * memory-branched because they describe recovery / fragility, not
 * a specific route Io named.
 *
 * @param {AftersignOfferRouteLabels} offerCopy
 * @returns {Readonly<Record<string, string>>}
 */
function buildLabels(offerCopy) {
  return Object.freeze({
    "take-the-long-way": offerCopy.safeRouteLabel,
    "take-the-shortcut": offerCopy.riskyRouteLabel,
    "repair-the-loss": "Repair the loss before you run",
    "carry-a-fragile-packet": "Carry the fragile packet",
  });
}

/**
 * Player-facing labels for the four `AftersignOfferedAction` ids
 * `computeOfferedActions` can emit. `take-the-long-way` and
 * `take-the-shortcut` re-use the authored route strings from
 * `aftersignJobOfferCopy.firstRun` — the FIRST-RUN row, kept here
 * as the default export for backwards compatibility with the two
 * `main.js` call sites that pass it directly.
 */
export const ROUTE_RISK_ACTION_LABELS = buildLabels(FIRST_RUN);

/**
 * Resolve a route-risk action id to the player-facing label the
 * served button renders, pinned to the FIRST-RUN offer copy
 * (blue-packet first-run labels). Unknown ids fall back to a safe
 * generic prompt so a future action added to `computeOfferedActions`
 * never ships a raw id to the DOM.
 *
 * For a memory-aware resolver that swaps labels based on the
 * current offer-copy row (red-tag second packet speaks the trusted
 * row's labels), use `routeRiskActionLabelForOffer(offerCopy)`.
 *
 * @param {string} actionId
 * @returns {string}
 */
export function routeRiskActionLabel(actionId) {
  return ROUTE_RISK_ACTION_LABELS[actionId] ?? "Choose a route";
}

/**
 * Build a route-risk action-label resolver bound to a specific
 * offer-copy row (one of `AFTERSIGN_JOB_OFFER_COPY.firstRun`,
 * `.trusted`, `.opened`). This is the factory the round-2 red-tag
 * second-packet render path (#2241) uses to swap the two route
 * strings for the trusted row's labels — the same ones Io speaks
 * in her offer line, so the vocabulary never drifts between voice
 * and tap surface.
 *
 * Falsy or malformed `offerCopy` falls back to the first-run row
 * so a misconfigured caller still ships authored copy, not raw
 * action ids.
 *
 * @param {AftersignOfferRouteLabels | null | undefined} offerCopy
 * @returns {(actionId: string) => string}
 */
export function routeRiskActionLabelForOffer(offerCopy) {
  const row =
    offerCopy &&
    typeof offerCopy === "object" &&
    typeof offerCopy.safeRouteLabel === "string" &&
    typeof offerCopy.riskyRouteLabel === "string"
      ? offerCopy
      : FIRST_RUN;
  const labels = buildLabels(row);
  return function routeRiskActionLabelBound(actionId) {
    return labels[actionId] ?? "Choose a route";
  };
}
