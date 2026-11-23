import { expect, test } from "@playwright/test";
import { tapAdvance } from "./m6-playtest.helpers";

test.describe("job-step progress hierarchy", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("offers one primary visible progress action while flavour responses stay distinct", async ({ page }) => {
    const slot = `job-step-primary-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    const tap = (selector: string) => tapAdvance(page, selector);
    await expect(page.locator('[data-beat-id="packet-offered"]')).toBeVisible();
    await tap('#job-offer-job-safe-delivery');
    await tap('#packetButton');
    await tap('button[data-aftersign-tap-choice="take-the-long-way"]');
    await tap('#acknowledgeRouteButton');
    await tap('#deliverButton');
    await tap('#acknowledgeRouteButton');
    await tap('#deliverButton');
    await expect(page.locator('[data-beat-id="io-next-job"]')).toBeVisible();

    const primary = page.locator('[data-aftersign-choice-kind="primary"]');
    const flavour = page.locator('#routeChoice [data-aftersign-choice-kind="flavour"]');
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveText("Deliver next packet");
    await expect(primary).toHaveAttribute("aria-description", "Next job step");
    await expect(flavour).toHaveCount(2);
    await expect(flavour.first()).toHaveAttribute(
      "aria-description",
      "Optional response; this does not advance the job",
    );
    // The vigil is a real choice on this beat (#2261/#2577): its buttons
    // must stay tappable, and none of them may claim the primary slot.
    await expect(page.locator("#vigilChoice")).toBeVisible();
    await expect(page.locator("#vigilChoice button:enabled")).toHaveCount(3);
    await expect(page.locator('#vigilChoice [data-aftersign-choice-kind="primary"]')).toHaveCount(0);

    await primary.tap();
    await expect(page.locator('[data-beat-id="packet-offered"]')).toBeVisible();
  });
});
