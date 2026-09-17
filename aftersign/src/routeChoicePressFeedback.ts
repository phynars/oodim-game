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

  const releaseProgress = Math.max(0, Math.min(1, elapsedSinceReleaseMs / ROUTE_CHOICE_PRESS_OUT_MS));
  const eased = 1 - (1 - releaseProgress) ** 3;

  return {
    scale: ROUTE_CHOICE_PRESS_SCALE + (1 - ROUTE_CHOICE_PRESS_SCALE) * eased,
    translateYPx: ROUTE_CHOICE_PRESS_LIFT_PX * (1 - eased),
    brightness: 1.08 - 0.08 * eased,
  };
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

export function checkRouteChoicePressFeedback(): void {
  const pressed = routeChoicePressFeedbackAt(true);
  assertEqual(pressed.scale, ROUTE_CHOICE_PRESS_SCALE, 'A press must land immediately at its tactile scale');
  assertEqual(pressed.translateYPx, ROUTE_CHOICE_PRESS_LIFT_PX, 'A press must visibly sink the choice');

  const settled = routeChoicePressFeedbackAt(false, ROUTE_CHOICE_PRESS_OUT_MS);
  assertEqual(settled.scale, 1, 'Released choice must settle at its neutral scale');
  assertEqual(settled.translateYPx, 0, 'Released choice must settle at its neutral position');
  assertEqual(settled.brightness, 1, 'Released choice must settle at neutral brightness');
}

export function runRouteChoicePressFeedbackChecks(): void {
  checkRouteChoicePressFeedback();
}
