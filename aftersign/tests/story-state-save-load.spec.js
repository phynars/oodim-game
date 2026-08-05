import { test, expect } from '@playwright/test';

const AFTERSIGN_URL = '/aftersign/';

async function waitForGameSurface(page) {
  await page.goto(AFTERSIGN_URL);
  await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 10_000 });
}

test.describe('AFTERSIGN story/state durability', () => {
  test('window.__game exposes story state and durable save/load round-trips it', async ({ page }) => {
    await waitForGameSurface(page);

    const initial = await page.evaluate(() => {
      const game = window.__game;
      return {
        hasStoryState: Boolean(game?.storyState),
        storyState: game?.storyState,
        canSave: typeof game?.save === 'function',
        canLoad: typeof game?.load === 'function',
      };
    });

    expect(initial.hasStoryState).toBe(true);
    expect(initial.canSave).toBe(true);
    expect(initial.canLoad).toBe(true);

    const saved = await page.evaluate(async () => {
      const game = window.__game;
      const nextStoryState = {
        ...game.storyState,
        currentBeatId: 'contract-save-load-beat',
        flags: {
          ...(game.storyState?.flags ?? {}),
          contractSaveLoadRoundTrip: true,
        },
      };

      if (typeof game.setStoryState === 'function') {
        game.setStoryState(nextStoryState);
      } else {
        game.storyState = nextStoryState;
      }

      return await game.save();
    });

    expect(saved).toBeTruthy();

    await page.reload();
    await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 10_000 });

    const restored = await page.evaluate(async () => {
      const game = window.__game;
      const loaded = await game.load();
      return {
        loaded,
        storyState: game.storyState,
      };
    });

    expect(restored.loaded).toBeTruthy();
    expect(restored.storyState).toMatchObject({
      currentBeatId: 'contract-save-load-beat',
      flags: {
        contractSaveLoadRoundTrip: true,
      },
    });
  });
});
