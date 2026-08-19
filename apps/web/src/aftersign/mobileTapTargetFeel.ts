// AFTERSIGN — mobile tap target ADJACENCY feel.
//
// Sibling of `tapChoiceFeel.ts`. That module owns the per-target
// 44px minimum-size contract (`measureAftersignTapChoiceFeel`,
// `assertAftersignTapChoiceSurfaces`) — this module deliberately
// does NOT re-check size. Its job is the novel contribution the
// size-only check doesn't cover: PAIRWISE adjacency between mounted
// tap-choice targets. Two 44x44 buttons that overlap, or sit 2px
// apart, both PASS the size contract and still cost the player a
// mis-tap. A dropped tap is 200–600ms of re-aim; the pairwise
// contract exists to catch that class of regression on the served
// DOM before it reaches the player.
//
// SPLIT (mirrors `tapChoiceFeel.ts`):
//   1. `measureTapTargetAdjacency` — pure primitive over an array
//      of `{id, x, y, width, height}` rects. No DOM. Reports overlap
//      and too-close pairs.
//   2. The served harness (`aftersign/main.js`) walks
//      `AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR` (imported from
//      `tapChoiceFeel.ts` — SAME selector, one source of truth) and
//      feeds the measured rects in. The runtime seam is
//      `window.__game.getMobileTapTargetFeelReport`.

import { AFTERSIGN_TOUCH_FEEL } from "./tapChoiceFeel";

export type TapTargetRect = Readonly<{
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type TapTargetAdjacencyIssue = Readonly<{
  ids: readonly [string, string];
  kind: "overlap" | "too-close";
  gapPx: number;
  message: string;
}>;

export type TapTargetAdjacencyReport = Readonly<{
  minGapPx: number;
  pairCount: number;
  issues: readonly TapTargetAdjacencyIssue[];
  ok: boolean;
}>;

/**
 * Minimum edge-to-edge gap between adjacent tap targets on a phone
 * screen. Set slightly below the preferred target size so a stray
 * ~8px sliver between two buttons still catches a mis-hit; anything
 * tighter and the finger's contact patch straddles both.
 */
export const PHONE_TAP_TARGET_MIN_GAP_PX = 8;

/**
 * Rectangle-pair overlap test. Two axis-aligned rects overlap when
 * their projections on BOTH axes overlap.
 */
function rectsOverlap(a: TapTargetRect, b: TapTargetRect): boolean {
  const horizontallyDisjoint = a.x + a.width <= b.x || b.x + b.width <= a.x;
  const verticallyDisjoint = a.y + a.height <= b.y || b.y + b.height <= a.y;
  return !horizontallyDisjoint && !verticallyDisjoint;
}

/**
 * Edge-to-edge gap in px. Zero when the rects touch or overlap.
 * For non-overlapping rects we take the max of the two axis gaps
 * (the "reachable" separation — the finger only has to clear one
 * axis to move between buttons).
 */
function edgeGapPx(a: TapTargetRect, b: TapTargetRect): number {
  const horizontalGap = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width));
  const verticalGap = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height));
  return Math.max(0, Math.max(horizontalGap, verticalGap));
}

/**
 * Given an ordered list of mounted tap targets, report every pair
 * that overlaps or sits closer than `minGapPx`. Size-per-target is
 * NOT this module's contract — `assertAftersignTapChoiceSurfaces`
 * in `tapChoiceFeel.ts` owns it.
 */
export function measureTapTargetAdjacency(
  targets: readonly TapTargetRect[],
  minGapPx: number = PHONE_TAP_TARGET_MIN_GAP_PX,
): TapTargetAdjacencyReport {
  const issues: TapTargetAdjacencyIssue[] = [];
  let pairCount = 0;

  for (let i = 0; i < targets.length; i += 1) {
    for (let j = i + 1; j < targets.length; j += 1) {
      pairCount += 1;
      const a = targets[i];
      const b = targets[j];

      if (rectsOverlap(a, b)) {
        issues.push({
          ids: [a.id, b.id],
          kind: "overlap",
          gapPx: 0,
          message: `${a.id} overlaps ${b.id}; visible phone controls need distinct hit areas.`,
        });
        continue;
      }

      const gapPx = edgeGapPx(a, b);
      if (gapPx < minGapPx) {
        issues.push({
          ids: [a.id, b.id],
          kind: "too-close",
          gapPx,
          message: `${a.id} is only ${gapPx}px from ${b.id}; phone controls need at least ${minGapPx}px separation.`,
        });
      }
    }
  }

  return {
    minGapPx,
    pairCount,
    issues,
    ok: issues.length === 0,
  };
}

/**
 * Re-exported for the served harness so the JS side only has one
 * import origin for the phone tap contract. The minimum target size
 * stays owned by `tapChoiceFeel.ts` — this constant is a convenience,
 * not a second source of truth.
 */
export const PHONE_TAP_TARGET_MIN_SIZE_PX =
  AFTERSIGN_TOUCH_FEEL.minimumTargetPx;
