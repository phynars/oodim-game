import { expect, test } from '@playwright/test';

const PHONE_VIEWPORT = { width: 390, height: 844 };
const AFTERSIGN_PATH = '/aftersign';

type OfferSnapshot = {
  ids: string[];
  labels: string[];
};

async function tapFirstVisible(page: import('@playwright/test').Page, selectors: string[], label: string) {
  for (const selector of selectors) {
    const locator = page.locator(selector).filter({ hasNot: page.locator('[aria-hidden="true"]') }).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.tap();
      return;
    }
  }

  throw new Error(`Could not find a visible ${label} control to tap. Tried: ${selectors.join(', ')}`);
}

async function visibleOfferSnapshot(page: import('@playwright/test').Page): Promise<OfferSnapshot> {
  const offers = page.locator('[id^="job-offer-"], [data-testid^="job-offer-"]');
  await expect(offers.first()).toBeVisible();

  return {
    ids: await offers.evaluateAll((nodes) =>
      nodes.map((node) => node.id || node.getAttribute('data-testid') || '').filter(Boolean),
    ),
    labels: await offers.allTextContents(),
  };
}

async function completeVisibleRound(page: import('@playwright/test').Page, roundName: string): Promise<OfferSnapshot> {
  const offers = await visibleOfferSnapshot(page);

  await tapFirstVisible(
    page,
    [
      '[id^="job-offer-"]',
      '[data-testid^="job-offer-"]',
      'button:has-text("Take")',
      'button:has-text("Job")',
      '[role="button"]:has-text("deliver")',
    ],
    `${roundName} job offer`,
  );

  await expect(
    page.getByText(/deliver|packet|route|stair|cut|bell|confirm/i).first(),
    `${roundName} should render the route/delivery beat after a job is tapped`,
  ).toBeVisible();

  await tapFirstVisible(
    page,
    [
      'button:has-text("Deliver")',
      'button:has-text("Confirm")',
      'button:has-text("Continue")',
      '[role="button"]:has-text("deliver")',
      '[role="button"]:has-text("confirm")',
      '[role="button"]:has-text("continue")',
    ],
    `${roundName} deliver/confirm`,
  );

  await expect(
    page.getByText(/return|back|Io|remember|again|next/i).first(),
    `${roundName} should render a return or recognition beat after delivery`,
  ).toBeVisible();

  await tapFirstVisible(
    page,
    [
      'button:has-text("Return")',
      'button:has-text("Back")',
      'button:has-text("Continue")',
      'button:has-text("Again")',
      '[role="button"]:has-text("return")',
      '[role="button"]:has-text("continue")',
    ],
    `${roundName} return`,
  );

  return offers;
}

test.describe('M-LOOP-E1 two-round played phone loop', () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test('boots, completes round one, returns, and offers different visible actions in round two by taps only', async ({ page }) => {
    await page.goto(AFTERSIGN_PATH);

    await expect(
      page.getByText(/Io|job|delivery|packet|offer/i).first(),
      'boot should render the first playable story/job beat',
    ).toBeVisible();

    const roundOneOffers = await completeVisibleRound(page, 'round one');

    const roundTwoOffers = await visibleOfferSnapshot(page);
    expect(roundTwoOffers, 'round two should expose a different tappable action set after memory changes').not.toEqual(
      roundOneOffers,
    );

    // window.__game is an assertion surface only: this spec never calls input helpers to cause play.
    const assertionSurface = await page.evaluate(() => {
      const game = (window as unknown as { __game?: unknown }).__game;
      return Boolean(game);
    });
    expect(assertionSurface).toBe(true);
  });
});
