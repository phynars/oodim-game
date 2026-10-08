import { expect, test } from '@playwright/test';

const PHONE_VIEWPORT = { width: 390, height: 844 };

test.describe('AFTERSIGN second packet Saint Orra handoff', () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test('a phone tap on Take the second packet puts the red tag on the live packet surface', async ({ page }) => {
    const slot = `second-packet-orra-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await page.goto(`/aftersign/?slot=${slot}`);

    const tap = async (choiceId: string) => {
      await page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first().click();
    };

    await page.locator('#packetButton').click();
    await tap('acknowledge-kiosk');
    await tap('deliver-packet');
    await expect(page.locator('button[data-choice-id="return-to-io"]')).toBeVisible();
    await tap('return-to-io');
    await expect(page.locator('button[data-choice-id="choose-return-tone"]')).toBeVisible();
    await tap('choose-return-tone');
    await tap('ask-for-next-job');
    await expect(page.locator('button[data-choice-id="accept-second-packet"]')).toBeVisible();

    await tap('accept-second-packet');

    await expect(page.locator('#packetButton')).toContainText(/red tag/i);
    await expect(
      page.locator('[data-aftersign-second-packet-handoff="accepted"]'),
    ).toContainText(/Saint Orra/i);
    await expect(page.locator('button[data-choice-id="acknowledge-kiosk"]')).toBeVisible();
  });
});
