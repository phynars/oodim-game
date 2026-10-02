import { expect, test } from '@playwright/test';

test('Io recognition publishes the packet-confirmed cue after a sealed return', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(async () => {
    const game = (window as Window & {
      __game?: {
        input?: {
          choose?: (choiceId: string) => Promise<void>;
          advance?: () => Promise<void>;
          forceReload?: () => Promise<void>;
        };
        enableAudio?: () => Promise<void>;
      };
    }).__game;

    if (!game?.input?.choose || !game.input.advance || !game.input.forceReload) {
      throw new Error('window.__game input contract is unavailable');
    }

    await game.enableAudio?.();
    await game.input.choose('keep-packet-sealed');
    await game.input.advance();
    await game.input.forceReload();
  });

  await expect(page.locator('#line')).toContainText('blue seal');
  await expect.poll(() => page.evaluate(() => {
    const game = (window as Window & {
      __game?: { _runtime?: { audio?: { lastCue?: string | null } } };
    }).__game;
    return game?._runtime?.audio?.lastCue ?? null;
  })).toBe('packet-confirmed');
});
