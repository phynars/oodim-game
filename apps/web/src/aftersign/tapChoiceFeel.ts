// AFTERSIGN — tap-choice target feel (mobile touch reachability).
//
// A tap choice is any element the player physically presses to commit
// a fork: the sealed/opened packet buttons, the return-tone posture
// buttons, an "ask for next job" prompt. For touch input, the target
// must be at least 44x44 CSS pixels on both axes — anything smaller
// and reliable taps degrade (finger occludes the target, adjacent
// targets pull mis-hits). This is a hard input-latency correlate: a
// missed tap costs the player 200-600ms of re-aim + re-press, orders
// of magnitude worse than any frame-time budget the rest of the feel
// harness protects.
//
// SPLIT (mirrors `returnToneChoiceFeel.ts`):
//   1. `AFTERSIGN_TOUCH_FEEL` + `measure/assertAftersignTapChoiceFeel`
//      — pure primitives, no DOM. Given a {width, height} rect, report
//      whether it meets the minimum and by how much it falls short.
//      Callers who already have measured dimensions (a layout module,
//      a snapshot serializer) use these directly.
//   2. `AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR` +
//      `assertAftersignTapChoiceSurfaces(root)` — DOM reader that
//      walks the mounted tap-choice elements and asserts each. This
//      is the seam the harness wires — see
//      `harness/bootWindowGame.ts::getTapChoiceFeelReport`.
//
// WHY THE ASSERTION LIVES IN THE HARNESS, NOT THE RENDER PATH:
// the shipped surface (`windowGameSurface.ts`) is a pure snapshot
// module — it emits story state, not DOM. The scene renderer that
// eventually mounts tap-choice buttons will honor
// `AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR` on each button, and the
// harness's `getTapChoiceFeelReport()` will catch any regression on
// the served page before it reaches the player. That's the same
// projection pattern `applyAftersignReturnToneChoiceFeel` uses.

export const AFTERSIGN_TOUCH_FEEL = {
  minimumTargetPx: 44,
  preferredTargetPx: 48,
  activationMaxMs: 100,
  pressedFeedbackMinMs: 80,
  pressedFeedbackMaxMs: 160,
} as const;

/**
 * Selector the harness uses to find tap-choice surfaces in the live
 * DOM. Every mounted button that commits a fork (packet sealed/opened,
 * return-tone posture, ask-for-next-job) should carry this attribute
 * — value is the choice id, so the report can label failures without
 * having to reverse-engineer them from the rect.
 */
export const AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR =
  "[data-aftersign-tap-choice]";

export type AftersignTapChoiceRect = {
  readonly width: number;
  readonly height: number;
};

export type AftersignTapChoiceFeelResult = {
  readonly ok: boolean;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly minimumTargetPx: number;
  readonly shortfallPx: number;
};

export function measureAftersignTapChoiceFeel(
  rect: AftersignTapChoiceRect,
): AftersignTapChoiceFeelResult {
  const widthPx = Math.max(0, rect.width);
  const heightPx = Math.max(0, rect.height);
  const minimumTargetPx = AFTERSIGN_TOUCH_FEEL.minimumTargetPx;
  const shortfallPx = Math.max(
    0,
    minimumTargetPx - Math.min(widthPx, heightPx),
  );

  return {
    ok: shortfallPx === 0,
    widthPx,
    heightPx,
    minimumTargetPx,
    shortfallPx,
  };
}

export function assertAftersignTapChoiceFeel(
  rect: AftersignTapChoiceRect,
): AftersignTapChoiceFeelResult {
  const result = measureAftersignTapChoiceFeel(rect);

  if (!result.ok) {
    throw new Error(
      `AFTERSIGN tap choice target is ${result.widthPx}x${result.heightPx}px; minimum is ${result.minimumTargetPx}px on both axes`,
    );
  }

  return result;
}

/**
 * Per-element measurement produced by
 * `assertAftersignTapChoiceSurfaces`. `label` is the
 * `data-aftersign-tap-choice` attribute value (typically a choice id
 * like `sealed`, `opened`, `kind`, `blunt`, `ask-for-next-job`); when
 * the attribute is empty, `label` falls back to the element's tag +
 * document position so the report is still legible.
 */
export type AftersignTapChoiceSurfaceResult =
  AftersignTapChoiceFeelResult & {
    readonly label: string;
  };

export type AftersignTapChoiceSurfaceReport = {
  /**
   * True when every mounted tap-choice surface meets the minimum
   * (and vacuously true when there are no surfaces to measure —
   * the harness runs before the scene mounts choices too).
   */
  readonly ok: boolean;
  /**
   * How many surfaces were measured. Kept explicit so a consumer
   * that expects "at least N choices mounted" can assert on it.
   */
  readonly surfaceCount: number;
  /**
   * One entry per mounted surface, in document order.
   */
  readonly results: readonly AftersignTapChoiceSurfaceResult[];
  /**
   * Convenience view of only the failing surfaces. Empty when
   * `ok === true`.
   */
  readonly failures: readonly AftersignTapChoiceSurfaceResult[];
};

type TapChoiceQueryRoot = Pick<Document, "querySelectorAll">;

/**
 * Walk every mounted tap-choice surface under `root` and measure its
 * bounding rect against the minimum tap target. This is the shipped
 * consumer of `measureAftersignTapChoiceFeel` — it's what makes the
 * 44px minimum a runtime contract on the live DOM, not just a
 * synthetic-object test.
 *
 * Never throws — a failing surface lands in the report's `failures`
 * so the harness can decide whether to log, warn, or hard-fail. That
 * decision belongs at the harness boundary (dev vs prod), not here.
 *
 * The `root` argument defaults to `document`. Callers running outside
 * a DOM (SSR, worker) should pass `null` — the report will simply
 * describe zero surfaces.
 */
export function assertAftersignTapChoiceSurfaces(
  root: TapChoiceQueryRoot | null | undefined = typeof document !== "undefined"
    ? document
    : null,
): AftersignTapChoiceSurfaceReport {
  if (!root) {
    return { ok: true, surfaceCount: 0, results: [], failures: [] };
  }

  const nodes = Array.from(
    root.querySelectorAll(AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR),
  ) as HTMLElement[];

  const results: AftersignTapChoiceSurfaceResult[] = nodes.map(
    (element, index) => {
      const rect = element.getBoundingClientRect();
      const measurement = measureAftersignTapChoiceFeel({
        width: rect.width,
        height: rect.height,
      });
      const attr = element.getAttribute("data-aftersign-tap-choice") ?? "";
      const label =
        attr.length > 0
          ? attr
          : `${element.tagName.toLowerCase()}#${index}`;
      return { ...measurement, label };
    },
  );

  const failures = results.filter((result) => !result.ok);

  return {
    ok: failures.length === 0,
    surfaceCount: results.length,
    results,
    failures,
  };
}
