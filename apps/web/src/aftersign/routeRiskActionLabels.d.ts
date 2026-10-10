/**
 * TypeScript companion for `routeRiskActionLabels.js` — the JS module
 * stays authoritative for the frozen label strings so non-TS reviewers
 * can eyeball the copy without a compile step, and this `.d.ts` lets
 * strict-mode TS consumers (`aftersign/src/*.test.ts`,
 * `aftersign/src/redTagRouteOfferLabels.js`'s TS companion, and the
 * harness) import the exports without hitting TS7016 under
 * `typecheck:aftersign` (tsconfig has no `allowJs`).
 *
 * Why this file was added (Soren's AI001 on PR #2253 iter-1):
 *   `aftersign/src/redTagRouteOfferLabels.test.ts` is included by
 *   `aftersign/tsconfig.json` (`include: ["src"]`) and imports
 *   `routeRiskActionLabel` from this module. Without a `.d.ts` the
 *   blocking `typecheck:aftersign` gate reds with TS7016 (implicit
 *   `any` at the import site). The sibling `aftersignJobOfferCopy.d.ts`
 *   is the shape this file follows.
 *
 * If a new export is added to the JS module, mirror it here so TS
 * consumers keep type-checking.
 */

/**
 * Shape the memory-aware resolver reads: an object carrying the two
 * authored route strings. Every row of `AFTERSIGN_JOB_OFFER_COPY`
 * (firstRun / trusted / opened) satisfies this.
 */
export type AftersignOfferRouteLabels = {
  readonly safeRouteLabel: string;
  readonly riskyRouteLabel: string;
};

/**
 * Frozen label table pinned to the FIRST-RUN offer copy row — the
 * backwards-compatible default both historical `renderRouteRiskChoice`
 * call sites in `aftersign/main.js` passed before the round-2 red-tag
 * wire-up landed. Keys are the four `AftersignOfferedAction` ids
 * `computeOfferedActions` can emit.
 */
export const ROUTE_RISK_ACTION_LABELS: Readonly<Record<string, string>>;

/**
 * Resolve a route-risk action id to its player-facing label, pinned
 * to the firstRun offer copy. Unknown ids fall back to a generic
 * "Choose a route" prompt so a future action never ships a raw id
 * to the DOM.
 *
 * For a memory-aware resolver that reflects the current offer-copy
 * row (red-tag second packet speaks the trusted row's labels), use
 * `routeRiskActionLabelForOffer(offerCopy)`.
 */
export function routeRiskActionLabel(actionId: string): string;

/**
 * Build a route-risk action-label resolver bound to a specific
 * offer-copy row. Falsy or malformed `offerCopy` falls back to the
 * first-run row so a misconfigured caller still ships authored copy,
 * not raw action ids.
 */
export function routeRiskActionLabelForOffer(
  offerCopy: AftersignOfferRouteLabels | null | undefined,
): (actionId: string) => string;
