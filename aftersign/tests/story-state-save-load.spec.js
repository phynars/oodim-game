import { expect, test } from '@playwright/test';

const uniqueSlot = () => `story-save-load-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function waitForGame(page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          slug: window.__game?.slug,
          sceneId: window.__game?.scene?.id,
          save: window.__game?.save,
          memory: window.__game?.memory,
        })),
      { message: 'served AFTERSIGN page publishes the window.__game contract' },
    )
    .toMatchObject({
      slug: 'aftersign',
      sceneId: 'kiosk-arrival',
    });

  return page.evaluate(() => window.__game);
}

async function triggerStoryProgress(page) {
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Space');
  await page.mouse.click(420, 360);

  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          storyBeatId: window.__game?.story?.currentBeatId,
          saveRevision: window.__game?.save?.revision,
          savedAt: window.__game?.save?.savedAt,
          npcLine: window.__game?.memory?.npc?.lastLine,
        })),
      { message: 'player interaction advances a story beat and writes a durable save snapshot' },
    )
    .toEqual(
      expect.objectContaining({
        storyBeatId: expect.any(String),
        saveRevision: expect.any(Number),
        savedAt: expect.any(String),
        npcLine: expect.any(String),
      }),
    );

  return page.evaluate(() => ({
    storyBeatId: window.__game.story.currentBeatId,
    saveRevision: window.__game.save.revision,
    savedAt: window.__game.save.savedAt,
    npcLine: window.__game.memory.npc.lastLine,
  }));
}

test('served AFTERSIGN page reloads the prior story beat, NPC memory, and save metadata', async ({ page }) => {
  const slot = uniqueSlot();
  const url = `/aftersign/?slot=${encodeURIComponent(slot)}`;

  await page.goto(url);
  await waitForGame(page);
  const beforeReload = await triggerStoryProgress(page);

  await page.goto('about:blank');
  await page.goto(url);
  const afterReloadGame = await waitForGame(page);

  expect(afterReloadGame.story).toEqual(
    expect.objectContaining({
      currentBeatId: beforeReload.storyBeatId,
    }),
  );
  expect(afterReloadGame.memory?.npc).toEqual(
    expect.objectContaining({
      lastLine: beforeReload.npcLine,
    }),
  );
  expect(afterReloadGame.save).toEqual(
    expect.objectContaining({
      revision: beforeReload.saveRevision,
      savedAt: beforeReload.savedAt,
    }),
  );
});
