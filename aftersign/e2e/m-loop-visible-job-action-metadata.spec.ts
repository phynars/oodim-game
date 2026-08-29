import { expect, test } from '@playwright/test';

test.describe('AFTERSIGN M-LOOP visible job action metadata', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('first round exposes a tappable job offer with route-risk metadata', async ({ page }) => {
    await page.goto('/aftersign/');

    const safeDeliveryOffer = page.getByRole('button', {
      name: /safe delivery\s*·\s*low risk/i,
    });

    await expect(safeDeliveryOffer).toBeVisible();
    await expect(safeDeliveryOffer).toHaveAttribute(/data-(?:offered-job-risk|route-risk)/, 'low');

    await safeDeliveryOffer.tap();

    const routeChoice = page.getByRole('button', { name: /deliver|route|stair|cut|bell/i }).first();
    await expect(routeChoice).toBeVisible();
    await routeChoice.tap();

    const outcomeChoice = page.getByRole('button', { name: /answer|reply|return|deliver|done|continue/i }).first();
    await expect(outcomeChoice).toBeVisible();
    await outcomeChoice.tap();

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const game = (window as typeof window & {
            __game?: { getSnapshot?: () => { beat?: string; scene?: string; state?: string } };
          }).__game;

          return game?.getSnapshot?.()?.beat ?? game?.getSnapshot?.()?.scene ?? game?.getSnapshot?.()?.state;
        });
      })
      .toBe('io-return-recognition');
  });
});
