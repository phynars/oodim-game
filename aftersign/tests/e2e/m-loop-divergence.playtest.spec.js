import { test, expect } from '@playwright/test';

const PHONE_VIEWPORT = { width: 390, height: 844 };
const SAVE_KEY = 'aftersign.player.memory.v1';
const FIRST_TIME_MEMORY = {
  playerId: 'm-loop-first-time',
  trustPosture: 'unknown',
  completedRuns: 0,
  facts: [],
};
const TRUSTED_COURIER_MEMORY = {
  playerId: 'm-loop-trusted-courier',
  trustPosture: 'trusted',
  completedRuns: 3,
  facts: [
    { id: 'delivered-sealed-packet', value: true },
    { id: 'avoided-bell-risk', value: true },
  ],
};

async function bootWithMemory(page, memory) {
  await page.setViewportSize(PHONE_VIEWPORT);
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: SAVE_KEY, value: memory },
  );
  await page.goto('/aftersign/');
}

async function visibleActionSignature(page) {
  const actionButtons = page
    .getByRole('button')
    .filter({ hasNotText: /^(continue|next|back|close)$/i });

  await expect(actionButtons.first()).toBeVisible();

  return actionButtons.evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !button.disabled;
      })
      .map((button) => ({
        testId: button.getAttribute('data-testid'),
        ariaLabel: button.getAttribute('aria-label'),
        roleText: button.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      }))
      .filter((action) => action.testId || action.ariaLabel || action.roleText),
  );
}

test.describe('M-LOOP played divergence', () => {
  test('two memory records produce different tappable actions on the served page', async ({ page }) => {
    await bootWithMemory(page, FIRST_TIME_MEMORY);
    const firstTimeActions = await visibleActionSignature(page);

    await page.context().clearCookies();
    await page.evaluate(() => window.localStorage.clear());

    await bootWithMemory(page, TRUSTED_COURIER_MEMORY);
    const trustedCourierActions = await visibleActionSignature(page);

    expect(trustedCourierActions).not.toEqual(firstTimeActions);
  });
});
