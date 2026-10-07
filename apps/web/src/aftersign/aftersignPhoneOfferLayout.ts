// #2193 — phone offer-tray layout helper, extracted from
// `aftersign/main.js::applyPhoneOfferLayout` so the stamp logic can
// be exercised against a real DOM element in jsdom instead of
// grepped as a string. Soren's REQUEST_CHANGES on #2212 (AI003 +
// AI007): the prior test file read `main.js` as text and matched
// regexes; collapsing the triplicated set/clear and routing both
// consumers through this helper lets the test actually render and
// measure the layout at a 375px viewport.
//
// Shape intentionally minimal: the served `main.js` passes a
// reference to the live `#offeredJobs` node plus the current
// `window.innerWidth` + `visible` axis, this function stamps or
// clears the phone-stack properties. No framework imports, no
// DOM queries — the helper owns the stamp, the caller owns the
// lookup. Same discipline as the `applyFlagshipTapConfirmFeel`
// seam the comment-forest above `applyPhoneOfferLayout` cites.

export interface PhoneOfferLayoutContext {
  /** The `window.innerWidth` the caller just sampled. */
  readonly innerWidth: number;
  /** Whether the offer tray should be visible this frame. */
  readonly visible: boolean;
}

/**
 * The pixel threshold at or below which we treat the viewport as a
 * phone and own the offer tray's flex axis explicitly. Shared with
 * every other phone-width branch in `main.js`.
 */
export const AFTERSIGN_PHONE_OFFER_LAYOUT_MAX_WIDTH = 480;

const STAMPED_PROPERTIES = [
  "display",
  "flexDirection",
  "alignItems",
  "flexWrap",
  "minWidth",
  "maxWidth",
  "overflowX",
  "overflowY",
  "webkitOverflowScrolling",
  "overscrollBehavior",
] as const satisfies ReadonlyArray<
  Exclude<
    keyof CSSStyleDeclaration,
    "length" | "parentRule" | "cssText" | "cssFloat"
  >
>;

/**
 * Stamp or clear the phone-width offer-tray layout on `offeredJobs`.
 *
 * - When `innerWidth <= 480` AND `visible`, the tray becomes a full-
 *   width vertical stack (`flex` / `column` / `stretch` / `nowrap`)
 *   with horizontal overflow hidden and vertical overflow scrollable,
 *   so Io's offer buttons stack instead of inheriting the parent
 *   `route-choice` row.
 * - Otherwise every property this helper may have stamped is
 *   cleared, returning the tray to its stylesheet-driven defaults.
 *
 * Returns `true` if the phone-stack branch was taken, `false`
 * otherwise — handy for callers that want to log or test the
 * decision axis without re-reading styles.
 */
export function applyAftersignPhoneOfferLayout(
  offeredJobs: HTMLElement | null | undefined,
  { innerWidth, visible }: PhoneOfferLayoutContext,
): boolean {
  if (!offeredJobs) return false;
  const phoneOfferStack =
    innerWidth <= AFTERSIGN_PHONE_OFFER_LAYOUT_MAX_WIDTH && visible;
  if (!phoneOfferStack) {
    for (const property of STAMPED_PROPERTIES) {
      (offeredJobs.style as unknown as Record<string, string>)[property] = "";
    }
    return false;
  }
  offeredJobs.style.display = "flex";
  offeredJobs.style.flexDirection = "column";
  offeredJobs.style.alignItems = "stretch";
  offeredJobs.style.flexWrap = "nowrap";
  offeredJobs.style.minWidth = "0";
  offeredJobs.style.maxWidth = "100%";
  offeredJobs.style.overflowX = "hidden";
  offeredJobs.style.overflowY = "auto";
  (offeredJobs.style as unknown as Record<string, string>)[
    "webkitOverflowScrolling"
  ] = "touch";
  offeredJobs.style.overscrollBehavior = "contain";
  return true;
}
