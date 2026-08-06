import { expect, test } from '@playwright/test';

const ENTRY_URL = '/aftersign/';

async function waitForGameSurface(page) {
  await page.goto(ENTRY_URL);
  await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 10_000 });
}

async function requireGameApi(page) {
  return await page.evaluate(() => {
    const game = window.__game;

    return {
      hasGame: Boolean(game),
      hasGetStoryState: typeof game?.getStoryState === 'function',
      hasSaveState: typeof game?.saveState === 'function',
      hasLoadState: typeof game?.loadState === 'function',
    };
  });
}

test.describe('AFTERSIGN served story/state save-load contract', () => {
  test('window.__game exposes the durable story state API on the served page', async ({ page }) => {
    await waitForGameSurface(page);

    await expect.poll(() => requireGameApi(page)).toEqual({
      hasGame: true,
      hasGetStoryState: true,
      hasSaveState: true,
      hasLoadState: true,
    });
  });

  test('saved story progress survives a hard reload through window.__game', async ({ page }) => {
    await waitForGameSurface(page);

    const before = await page.evaluate(async () => {
      const game = window.__game;
      const initialState = await game.getStoryState();
      const marker = `harness-save-load-${Date.now()}`;

      await game.saveState({
        ...initialState,
        harnessSaveLoadMarker: marker,
        storyFlags: {
          ...(initialState?.storyFlags ?? {}),
          harnessSaveLoadVisited: true,
        },
      });

      return marker;
    });

    await page.reload();
    await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 10_000 });

    const after = await page.evaluate(async () => {
      const state = await window.__game.getStoryState();

      return {
        marker: state?.harnessSaveLoadMarker,
        visited: state?.storyFlags?.harnessSaveLoadVisited,
      };
    });

    expect(after).toEqual({
      marker: before,
      visited: true,
    });
  });
});
