import { expect, test, type Locator, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };

const OFFER_SELECTOR = "[id^='job-offer-'], [data-job-offer-id], [data-testid^='job-offer-']";
const CHOICE_SELECTOR = "button, [role='button']";

async function visibleText(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/\s+/g, " ").trim();
}

async function visibleOfferKeys(page: Page): Promise<string[]> {
  const offers = page.locator(OFFER_SELECTOR).filter({ hasText: /\S/ });
  await expect(offers.first()).toBeVisible();

  const count = await offers.count();
  const keys: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const offer = offers.nth(index);
    if (!(await offer.isVisible())) continue;

    const id = await offer.getAttribute("id");
    const dataId = await offer.getAttribute("data-job-offer-id");
    const testId = await offer.getAttribute("data-testid");
    const text = await visibleText(offer);
    keys.push(dataId ?? id ?? testId ?? text);
  }

  return [...new Set(keys)].sort();
}

async function tapVisible(page: Page, name: RegExp): Promise<void> {
  const target = page.locator(CHOICE_SELECTOR).filter({ hasText: name }).first();
  await expect(target).toBeVisible();
  await target.tap();
}

async function tapFirstVisibleOffer(page: Page): Promise<void> {
  const offer = page.locator(OFFER_SELECTOR).filter({ hasText: /\S/ }).first();
  await expect(offer).toBeVisible();
  await offer.tap();
}

async function assertNoHarnessInputDriver(page: Page): Promise<void> {
  const hasHarnessInput = await page.evaluate(() => {
    const game = (window as typeof window & {
      __game?: { input?: Record<string, unknown> };
    }).__game;
    return Boolean(game?.input && Object.keys(game.input).length > 0);
  });

  expect(hasHarnessInput).toBe(true);
}

test.describe("M-LOOP-E1 two-round phone playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("plays from boot through a looped return and sees divergent tappable job offers", async ({ page }) => {
    await page.goto("/aftersign/");

    await expect(page.locator("body")).toContainText(/Io/i);
    await assertNoHarnessInputDriver(page);

    const firstRoundOffers = await visibleOfferKeys(page);
    expect(firstRoundOffers.length).toBeGreaterThan(0);

    await tapFirstVisibleOffer(page);
    await expect(page.locator("body")).toContainText(/packet|delivery|route|stair|bell/i);

    await tapVisible(page, /deliver|confirm|hand|seal|packet/i);
    await expect(page.locator("body")).toContainText(/return|back|Io/i);

    await tapVisible(page, /return|back|Io|kiosk/i);
    await expect(page.locator("body")).toContainText(/job|route|packet|offer/i);

    const secondRoundOffers = await visibleOfferKeys(page);
    expect(secondRoundOffers.length).toBeGreaterThan(0);
    expect(secondRoundOffers).not.toEqual(firstRoundOffers);

    await tapFirstVisibleOffer(page);
    await expect(page.locator("body")).toContainText(/packet|delivery|route|stair|bell|pharmacy|amber/i);
  });
});
