import { expect, test } from '@playwright/test';

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 30_000;

async function tapVisibleChoice(page: import('@playwright/test').Page, choiceId: string) {
  const choice = page.locator(`[data-choice-id="${choiceId}"]`).first();
  await expect(choice, `choice ${choiceId} is rendered for player input`).toBeVisible({ timeout: COLD_START_MS });
  await expect(choice, `choice ${choiceId} is enabled for player input`).toBeEnabled();
  await choice.tap({ trial: true });
  await choice.tap();
}

async function expectVisibleStoryText(page: import('@playwright/test').Page, pattern: RegExp, label: string) {
  await expect(page.getByText(pattern).first(), label).toBeVisible({ timeout: COLD_START_MS });
}

test.describe('M-CONTINUE second packet copy', () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test('player can ask for the next job and see Io hand off the second packet copy', async ({ page }) => {
    await page.goto('/aftersign/');

    await tapVisibleChoice(page, 'listen-to-io');
    await tapVisibleChoice(page, 'keep-seal');
    await tapVisibleChoice(page, 'deliver-sealed');
    await tapVisibleChoice(page, 'return-to-io');

    await expectVisibleStoryText(page, /you came back/i, 'Io return recognition is visible before the continuation beat');

    await tapVisibleChoice(page, 'kind-return');
    await tapVisibleChoice(page, 'ask-for-next-job');

    await expectVisibleStoryText(
      page,
      /second packet|next job|bell archive|saint orra|moth pier/i,
      'Io visibly gives the player actionable copy for the next packet'
    );
  });
});
