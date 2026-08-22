import { expect, test } from '@playwright/test';

const PHONE_VIEWPORT = { width: 390, height: 844 };

async function tapVisibleChoice(page: import('@playwright/test').Page, pattern: RegExp) {
  const choice = page
    .getByRole('button', { name: pattern })
    .or(page.getByText(pattern).locator('visible=true'))
    .first();

  await expect(choice).toBeVisible();
  await choice.tap();
}

test.describe('M-CONTINUE deadline playtest', () => {
  test.use({ viewport: PHONE_VIEWPORT, isMobile: true, hasTouch: true });

  test('a phone player reaches two visible beats after Io return recognition by taps only', async ({ page }) => {
    await page.goto('/aftersign/');

    await expect(page.locator('body')).toContainText(/Io|Night Post|packet|seal/i);

    // Acceptance input must be player input. window.__game is only used below as
    // an assertion surface after the rendered page has advanced by taps.
    await tapVisibleChoice(page, /continue|begin|start|listen|take|packet/i);
    await tapVisibleChoice(page, /sealed|keep|carry|deliver|box/i);
    await tapVisibleChoice(page, /return|back|Io|kiosk/i);

    await expect(page.locator('body')).toContainText(/You came back|unbroken|seal did not|trust/i);

    // Founder bar, quoted from docs/flagship/BRIEF.md:
    // "After Io's return recognition, the game GOES ON: wire the authored
    // script through scene 8 (the return-tone choice), then author and wire the
    // beat it was written to feed — Io hands the player the next job."
    await tapVisibleChoice(page, /kind|evasive|blunt|answer|tone/i);
    await expect(page.locator('body')).toContainText(/kind|evasive|blunt|came back|next/i);

    await tapVisibleChoice(page, /next job|job|take it|accept|route/i);
    await expect(page.locator('body')).toContainText(/next job|Orra|Bell Archive|Moth Pier|route|delivery/i);

    const storyState = await page.evaluate(() => {
      const game = (window as unknown as { __game?: { story?: unknown; state?: unknown } }).__game;
      return game?.story ?? game?.state ?? null;
    });

    expect(storyState).toBeTruthy();
  });
});
