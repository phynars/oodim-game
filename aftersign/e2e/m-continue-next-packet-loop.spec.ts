import { expect, test } from '@playwright/test';

async function tapVisibleButton(page: import('@playwright/test').Page, name: RegExp) {
  const button = page.getByRole('button', { name }).first();
  await expect(button).toBeVisible();
  await button.tap();
}

test.describe('M-CONTINUE next packet loop playtest', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('a phone player can tap from the first packet through Io handing off the next job', async ({ page }) => {
    await page.goto('/aftersign/');

    await expect(page.getByText(/sealed blue packet/i).first()).toBeVisible();

    await tapVisibleButton(page, /keep.*seal|leave.*sealed|preserve/i);
    await tapVisibleButton(page, /route|listen|continue/i);
    await tapVisibleButton(page, /deliver|sign box|drop/i);
    await tapVisibleButton(page, /return|back to io|io/i);

    await expect(page.getByText(/you came back/i).first()).toBeVisible();

    await tapVisibleButton(page, /blunt|just.*work|job/i);

    await expect(page.getByText(/next job|another packet|new packet/i).first()).toBeVisible();

    const packetControls = [
      page.getByRole('button', { name: /keep.*seal|leave.*sealed|preserve/i }).first(),
      page.getByRole('button', { name: /open|break.*seal/i }).first(),
      page.getByRole('button', { name: /return|withhold|not.*carry/i }).first(),
    ];

    for (const control of packetControls) {
      await expect(control).toBeVisible();
    }

    const state = await page.evaluate(() => {
      const game = (window as typeof window & { __game?: unknown }).__game;
      if (!game || typeof game !== 'object') return null;
      return JSON.parse(JSON.stringify(game));
    });

    expect(state).toBeTruthy();
  });
});
