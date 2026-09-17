// Route-choice press-feedback contract (PR #1806).
//
// The played surface at the packet-choice beat is `#routeChoice`
// (`aftersign/index.html:1002`), which hosts two committing buttons —
// `#acknowledgeRouteButton` ("I listened") and `#skipRouteButton`
// ("I ran early"). This module pins the FEEL envelope those two
// buttons paint during the press window.
//
// Both halves of PR #1806's re-review are addressed here + in the
// sibling served-HTML pin:
//
//   (a) Zero importers → this file is the SOURCE OF TRUTH the served-
//       HTML contract (`aftersign/routeChoicePressServedContract.ts`,
//       which lives OUTSIDE `include: ["src"]` so it can use `node:fs`
//       without widening the tsconfig's `types`) pins against.
//       `routeChoicePressing.js` (browser JS, cannot import TS) and
//       `#routeChoice`'s CSS rule (cannot import TS) both mirror the
//       constants below; the served-contract check reds the pure lane
//       if any of the three drift.
//
//   (b) Self-test never runs → `runRouteChoicePressFeedbackChecks` is
//       registered in `aftersign/pure-runner.ts`'s `runners[]` array,
//       AND the served-HTML pin is registered as its own runner
//       alongside it.
//
// Extension-resolution contract: this file has ZERO relative imports,
// and the `.test.ts` shim's sole relative import
// (`./routeChoicePressFeedback.ts`) is `.ts`-extensioned. The
// pure-runner (`node --experimental-strip-types`) resolves the whole
// subgraph deterministically.

export const ROUTE_CHOICE_PRESS_IN_MS = 0;
export const ROUTE_CHOICE_PRESS_OUT_MS = 96;
export const ROUTE_CHOICE_PRESS_SCALE = 0.972;
export const ROUTE_CHOICE_PRESS_LIFT_PX = 1;

export type RouteChoicePressFeedback = Readonly<{
  scale: number;
  translateYPx: number;
  brightness: number;
}>;

export function routeChoicePressFeedbackAt(
  isPressed: boolean,
  elapsedSinceReleaseMs = 0,
): RouteChoicePressFeedback {
  if (isPressed) {
    return {
      scale: ROUTE_CHOICE_PRESS_SCALE,
      translateYPx: ROUTE_CHOICE_PRESS_LIFT_PX,
      brightness: 1.08,
    };
  }

  const releaseProgress = Math.max(
    0,
    Math.min(1, elapsedSinceReleaseMs / ROUTE_CHOICE_PRESS_OUT_MS),
  );
  const eased = 1 - (1 - releaseProgress) ** 3;

  return {
    scale: ROUTE_CHOICE_PRESS_SCALE + (1 - ROUTE_CHOICE_PRESS_SCALE) * eased,
    translateYPx: ROUTE_CHOICE_PRESS_LIFT_PX * (1 - eased),
    brightness: 1.08 - 0.08 * eased,
  };
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

export function checkRouteChoicePressFeedback(): void {
  const pressed = routeChoicePressFeedbackAt(true);
  assertEqual(
    pressed.scale,
    ROUTE_CHOICE_PRESS_SCALE,
    "A press must land immediately at its tactile scale",
  );
  assertEqual(
    pressed.translateYPx,
    ROUTE_CHOICE_PRESS_LIFT_PX,
    "A press must visibly sink the choice",
  );

  const settled = routeChoicePressFeedbackAt(false, ROUTE_CHOICE_PRESS_OUT_MS);
  assertEqual(
    settled.scale,
    1,
    "Released choice must settle at its neutral scale",
  );
  assertEqual(
    settled.translateYPx,
    0,
    "Released choice must settle at its neutral position",
  );
  assertEqual(
    settled.brightness,
    1,
    "Released choice must settle at neutral brightness",
  );
}

export function runRouteChoicePressFeedbackChecks(): void {
  checkRouteChoicePressFeedback();
}
