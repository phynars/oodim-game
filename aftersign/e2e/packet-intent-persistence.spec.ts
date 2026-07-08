import { expect, test } from '@playwright/test';

const waitForGame = async (page) => {
  await page.waitForFunction(() => Boolean(window.__game?.input?.packetPress));
};

test('packet choice persists across reload for the same slot and resets cleanly', async ({ page }) => {
  await page.goto('/?slot=packet-intent-persistence');
  await waitForGame(page);
  await page.evaluate(() => window.__game.resetSliceSave());

  await page.evaluate(() => {
    const t0 = 1_000;
    window.__game.input.packetPress({ timeMs: t0, x: 24, y: 24 });
    window.__game.input.packetRelease({ timeMs: t0 + 90, x: 24, y: 24 });
  });

  const sealedBeforeReload = await page.evaluate(() => window.__game.getSnapshot());
  expect(sealedBeforeReload.packet.sealed).toBe(true);
  expect(sealedBeforeReload.scene.beat).toBe('packet-kept-sealed');
  expect(sealedBeforeReload.interaction.packetIntent.outcome).toBe('sealed');

  await page.reload();
  await waitForGame(page);

  const sealedAfterReload = await page.evaluate(() => window.__game.getSnapshot());
  expect(sealedAfterReload.packet.sealed).toBe(true);
  expect(sealedAfterReload.scene.beat).toBe('packet-kept-sealed');
  expect(sealedAfterReload.interaction.packetIntent.outcome).toBe('sealed');

  await page.evaluate(() => window.__game.resetSliceSave());
  await page.reload();
  await waitForGame(page);

  const resetAfterReload = await page.evaluate(() => window.__game.getSnapshot());
  expect(resetAfterReload.packet.sealed).toBe(true);
  expect(resetAfterReload.packet.delivered).toBe(false);
  expect(resetAfterReload.scene.beat).toBe('packet-offered');
  expect(resetAfterReload.interaction.packetIntent.outcome).toBe('unknown');
  expect(resetAfterReload.interaction.packetIntent.progress).toBe(0);
});
