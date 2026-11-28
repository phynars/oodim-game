import { test } from "@playwright/test";
import { playSteps } from "./helpers/route";
import { USED_ROUTES } from "./helpers/routes";

// #3128: one served spec walks every registered route at 390x844 with taps
// only and fails when a tap reveals an enabled control that is not wholly in
// view (the check lives once, in helpers/route.ts `revealedInView`). It calls
// playSteps, never playRoute, so it always PLAYS and never seeds, whatever
// the environment. A route added to USED_ROUTES is covered with no edit here.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

for (const route of USED_ROUTES) {
  test(`route "${route.name}": every control a tap reveals is in view with no swipe`, async ({ page }) => {
    test.setTimeout(180_000);
    const id = `reveal-${route.name}-${Date.now().toString(36)}`;
    await playSteps(page, `/aftersign/?slot=${id}&player=${id}`, route.steps, { revealedInView: true });
  });
}
