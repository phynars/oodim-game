import { expect, test } from "@playwright/test";

// PR #1398 — served-page render pipeline for `computeOfferedJobs`.
//
// The loop-back from `io-next-job → deliver-packet` resets the beat
// to `packet-offered` (not `packet-choice`, as an earlier draft did) —
// that beat is the one the `#offeredJobs` render is gated on, so the
// second lap only proves the fix if the player can DRIVE the loop back
// open through the visible `#packetButton` control at that beat and
// SEE the divergent job set land.
//
// PLAYED-NOT-DRIVEN: every advance below is a real click on a shipped
// selector, and lap 2 explicitly re-taps `#packetButton` at the
// `packet-offered` beat to prove the loop re-opens the way a player
// would drive it — no synthetic state pokes.
test("served job offers follow completed delivery memory through real taps", async ({ page }) => {
  await page.goto("/");

  // Lap 1 lands at `packet-offered` with the safe-default job button.
  await expect(page.locator("#stateReadout")).toContainText("packet-offered");
  await expect(page.locator("#job-offer-safe-default")).toHaveCount(1);
  await expect(page.locator("#offeredJobs button")).toHaveCount(1);

  await page.locator("#packetButton").click();
  await page.locator("#acknowledgeRouteButton").click();
  await page.locator("#deliverButton").click();
  await expect(page.locator("#stateReadout")).toContainText("io-return-recognition");
  await page.locator("#acknowledgeRouteButton").click();
  await expect(page.locator("#stateReadout")).toContainText("return-tone-choice");
  await page.locator("#deliverButton").click();
  await expect(page.locator("#stateReadout")).toContainText("io-next-job");

  // Loop-back: `deliver-packet` at `io-next-job` resets the beat to
  // `packet-offered`. Prove the beat lands AND the divergent job set
  // renders before we drive the packet tap again.
  await page.locator("#deliverButton").click();
  await expect(page.locator("#stateReadout")).toContainText("packet-offered");
  await expect(page.locator("#job-offer-job-night-transfer")).toHaveCount(1);
  await expect(page.locator("#job-offer-job-signed-receipt")).toHaveCount(1);
  await expect(page.locator("#job-offer-safe-default")).toHaveCount(0);

  // PLAYED-NOT-DRIVEN for the loop outcome: the player must be able to
  // advance past `packet-offered` on lap 2 through the visible
  // `#packetButton` control, not just SEE the beat land. Tap it, then
  // assert the next beat (`packet-choice`) is what actually lands —
  // that's the real proof the loop re-opened, not just re-stamped.
  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toBeVisible();
  await expect(packetButton).toBeEnabled();
  await packetButton.click();
  await expect(page.locator("#stateReadout")).toContainText("packet-choice");
  // Once past `packet-offered`, the `#offeredJobs` surface clears —
  // the render is gated on that beat and this is the proof.
  await expect(page.locator("#offeredJobs button")).toHaveCount(0);
});
