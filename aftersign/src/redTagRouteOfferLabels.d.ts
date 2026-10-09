/**
 * TypeScript companion for `redTagRouteOfferLabels.js` — the JS module
 * stays authoritative for the resolver (so the delivery-identity rule
 * and its header rationale read in one place without a compile step),
 * and this `.d.ts` lets strict-mode TS consumers
 * (`aftersign/src/redTagRouteOfferLabels.test.ts`) import
 * `routeRiskLabelsForDelivery` without tripping TS7016 under the
 * blocking `typecheck:aftersign` gate (tsconfig has no `allowJs`).
 *
 * Why this file was added (Soren's AI001 on PR #2253 iter-1):
 *   The sibling `.test.ts` is included by `aftersign/tsconfig.json`
 *   (`include: ["src"]`) and imports the resolver below. Without a
 *   `.d.ts` the blocking gate reds with TS7016. Shape mirrors
 *   `apps/web/src/aftersign/aftersignJobOfferCopy.d.ts`.
 */

/**
 * Resolve route-risk button copy for the packet currently in hand,
 * keyed on `state.delivery.id` alone. The red-tag case is pinned to
 * the TRUSTED offer row so an empty / missing `npcs.io.memory` can
 * never fall back to the blue-packet first-run labels.
 *
 * Any delivery id other than `"red-tag"` returns the backwards-
 * compatible `routeRiskActionLabel` function identity (same reference,
 * not a wrapper) so the second `renderRouteRiskChoice` call site in
 * `aftersign/main.js` stays byte-identical to its prior behavior on
 * non red-tag deliveries.
 */
export function routeRiskLabelsForDelivery(
  deliveryId: "blue-packet" | "red-tag" | string,
): (actionId: string) => string;
