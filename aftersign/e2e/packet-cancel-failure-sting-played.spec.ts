import { expect, test } from '@playwright/test';

test.describe('AFTERSIGN packet cancel failure sting', () => {
  test('a played packet-cancel gesture produces the pinned failure sting envelope', async ({ page }) => {
    await page.goto('/');

    const packetButton = page.locator('#packetButton');
    await expect(packetButton).toBeVisible();

    const box = await packetButton.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 34, startY, { steps: 5 });
    await page.mouse.up();

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = window.__game;
            return game?.interaction?.lastAction ?? null;
          }),
        { timeout: 1000 },
      )
      .toBe('packet-cancelled');

    const liveEnvelope = await page.evaluate(() => {
      const game = window.__game;
      const root = document.documentElement;
      const sting = document.querySelector<HTMLElement>('.failure-sting');
      const style = getComputedStyle(root);

      return {
        feedback: game?.interaction?.failureFeedback ?? null,
        hudShakeX: Number(style.getPropertyValue('--confirm-shake-x').replace('px', '').trim() || '0'),
        hudShakeY: Number(style.getPropertyValue('--confirm-shake-y').replace('px', '').trim() || '0'),
        flashOpacity: sting ? Number(getComputedStyle(sting).opacity) : 0,
      };
    });

    expect(liveEnvelope.feedback).toMatchObject({
      active: true,
      kind: 'packet-cancelled',
      durationMs: 180,
      easing: 'easeOutQuad',
      hudShakePx: 8,
      hudDropPx: 2,
      flashAlpha: 0.34,
    });
    expect(Math.abs(liveEnvelope.hudShakeX)).toBeGreaterThan(0);
    expect(liveEnvelope.hudShakeY).toBeGreaterThanOrEqual(0);
    expect(liveEnvelope.flashOpacity).toBeGreaterThan(0);
    expect(liveEnvelope.flashOpacity).toBeLessThanOrEqual(0.34);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = window.__game;
            return game?.interaction?.failureFeedback?.active ?? false;
          }),
        { timeout: 1200 },
      )
      .toBe(false);
  });
});

declare global {
  interface Window {
    __game?: {
      interaction?: {
        lastAction?: string;
        failureFeedback?: {
          active: boolean;
          kind: string;
          durationMs: number;
          easing: string;
          hudShakePx: number;
          hudDropPx: number;
          flashAlpha: number;
        };
      };
    };
  }
}
