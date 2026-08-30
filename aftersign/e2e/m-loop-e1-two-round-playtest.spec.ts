import { expect, test } from "@playwright/test";

const phone = { width: 390, height: 844 };

test.describe("M-LOOP E1 — two-round phone playtest", () => {
  test.use({ viewport: phone, isMobile: true, hasTouch: true });

  test("a delivered job changes the visible offer set after returning to Io", async ({ page }) => {
    await page.goto("/aftersign/");

    // Boot resolves into Io's first visible job offer.
    const firstOffer = page.locator("[id^='job-offer-']");
    await expect(firstOffer.first()).toBeVisible();
    const firstOfferIds = await firstOffer.evaluateAll((offers) =>
      offers.map((offer) => offer.id),
    );
    expect(firstOfferIds).toContain("job-offer-job-safe-delivery");
    await expect(page.getByText(/Io/i).first()).toBeVisible();

    // Round 1: take the offered job, then visibly confirm its delivery.
    await page.locator("#job-offer-job-safe-delivery").click();
    const confirm = page.getByRole("button", { name: /confirm|deliver/i });
    await expect(confirm).toBeVisible();
    await confirm.click();

    const returnToIo = page.getByRole("button", { name: /return/i });
    await expect(returnToIo).toBeVisible();
    await expect(page.getByText(/delivered|confirmed/i).first()).toBeVisible();

    // The only game-object access is a read-side beat assertion.
    await expect
      .poll(() => page.evaluate(() => window.__game?.scene?.key))
      .toBeTruthy();

    // Round 2 is entered through the rendered return control, not a harness input.
    await returnToIo.click();
    const loopedOffers = page.locator("[id^='job-offer-']");
    await expect(loopedOffers.first()).toBeVisible();
    const loopedOfferIds = await loopedOffers.evaluateAll((offers) =>
      offers.map((offer) => offer.id),
    );

    expect(loopedOfferIds).not.toEqual(firstOfferIds);
    await expect(page.getByText(/Io/i).first()).toBeVisible();
  });
});
