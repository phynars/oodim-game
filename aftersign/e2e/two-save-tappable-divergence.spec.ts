import { expect, test } from "@playwright/test";

const slot = (name: string) => `two-save-divergence-${name}-${Date.now()}`;

async function openSlice(page: import("@playwright/test").Page, saveSlot: string) {
  await page.goto(`/aftersign/?slot=${saveSlot}`);
  await expect(page.locator("#offeredJobs")).toHaveAttribute("data-visible", "true");
}

async function completeRound(page: import("@playwright/test").Page) {
  // Every transition here is a rendered control a phone player can tap.
  await page.locator("#packetButton").click();
  await expect(page.locator("#routeChoice")).toHaveAttribute("data-visible", "true");
  await page.locator("#acknowledgeRouteButton").click();
  await page.locator("#deliverButton").click();

  await expect(page.locator("#line")).toHaveAttribute(
    "data-beat-id",
    "io-return-recognition",
    { timeout: 5_000 },
  );
  await page.locator("#acknowledgeRouteButton").click();
  await expect(page.locator("#line")).toHaveAttribute("data-beat-id", "return-tone-choice");
  await page.locator("#deliverButton").click();
  await expect(page.locator("#line")).toHaveAttribute("data-beat-id", "io-next-job");
  await page.locator("#deliverButton").click();
  await expect(page.locator("#offeredJobs")).toHaveAttribute("data-visible", "true");
}

test.describe("M-LOOP two-save tappable divergence", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a completed durable slot exposes a different tappable offer from a fresh slot", async ({ page }) => {
    const freshSlot = slot("fresh");
    await openSlice(page, freshSlot);
    const freshOffers = await page.locator("#offeredJobs button[data-offer-fingerprint]").evaluateAll(
      (buttons) => buttons.map((button) => button.getAttribute("data-offer-fingerprint")),
    );
    await expect(page.locator("#job-offer-job-safe-delivery")).toBeVisible();

    const completedSlot = slot("completed");
    await openSlice(page, completedSlot);
    await completeRound(page);

    // Reload through the served page: the next offer set must come back from
    // the durable save, rather than remaining only in this page's live state.
    await page.reload();
    await expect(page.locator("#offeredJobs")).toHaveAttribute("data-visible", "true");
    const completedOffers = await page.locator("#offeredJobs button[data-offer-fingerprint]").evaluateAll(
      (buttons) => buttons.map((button) => button.getAttribute("data-offer-fingerprint")),
    );

    expect(completedOffers).not.toEqual(freshOffers);
    await expect(page.locator("#job-offer-job-night-transfer")).toBeVisible();
    await page.locator("#job-offer-job-night-transfer").click();
    await expect(page.locator("#job-offer-job-night-transfer")).toHaveAttribute(
      "data-aftersign-job-take",
      "armed",
    );
  });
});
