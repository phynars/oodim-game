import { expect, test } from "@playwright/test";

// Live-verify follow-up to #2216 (step 3 of the verifier walk): after
// tapping the kiosk's "Acknowledge route" button, the control must
// visibly commit the player's choice (an `aria-pressed="true"` state
// counts as the player-visible proof). Sibling specs on this flow
// (see `aftersign/e2e/aftersign-mloop-two-round.playtest.spec.ts`)
// reach the route-memory fork via `#job-offer-job-safe-delivery`
// then `#packetButton`; use the same path here so the walk is
// known to land on `#acknowledgeRouteButton` under the same beat.

test("route acknowledgement visibly remains selected after a player tap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/aftersign/");

  // Follow the sibling flow verbatim: offer the safe-delivery job,
  // then commit the packet via `#packetButton` so the beat crosses
  // into packet-choice and the Acknowledge / Skip controls render.
  const safeDeliveryOffer = page.locator("#job-offer-job-safe-delivery");
  await expect(safeDeliveryOffer).toBeVisible();
  await safeDeliveryOffer.tap();

  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toBeVisible();
  await packetButton.tap();

  const acknowledgeRoute = page.locator("#acknowledgeRouteButton");
  await expect(acknowledgeRoute).toBeVisible();
  await acknowledgeRoute.tap();

  await expect(acknowledgeRoute).toHaveAttribute("aria-pressed", "true");
});
