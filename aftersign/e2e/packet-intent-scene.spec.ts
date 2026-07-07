import { expect, test } from '@playwright/test';

const waitForGame = async (page) => {
  await page.waitForFunction(() => Boolean(window.__game?.input?.packetPress));
};

test('scene exposes packet tap/hold intent through window.__game', async ({ page }) => {
  await page.goto('/?slot=packet-intent-scene');
  await waitForGame(page);
  await page.evaluate(() => window.__game.resetSliceSave());

  const tapSnapshot = await page.evaluate(async () => {
    const t0 = 1_000;
    window.__game.input.packetPress({ timeMs: t0, x: 24, y: 24 });
    window.__game.input.packetRelease({ timeMs: t0 + 90, x: 24, y: 24 });
    return window.__game.getSnapshot();
  });

  expect(tapSnapshot.packet.sealed).toBe(true);
  expect(tapSnapshot.scene.beat).toBe('packet-kept-sealed');
  expect(tapSnapshot.interaction.packetIntent.outcome).toBe('sealed');
  expect(tapSnapshot.interaction.packetIntent.progress).toBe(0);

  const holdSnapshot = await page.evaluate(async () => {
    await window.__game.resetSliceSave();
    const t0 = 2_000;
    window.__game.input.packetPress({ timeMs: t0, x: 24, y: 24 });
    window.__game.input.packetTick(t0 + 450);
    return window.__game.getSnapshot();
  });

  expect(holdSnapshot.packet.sealed).toBe(false);
  expect(holdSnapshot.scene.beat).toBe('packet-opened');
  expect(holdSnapshot.interaction.packetIntent.outcome).toBe('opened');
  expect(holdSnapshot.interaction.packetIntent.progress).toBe(1);

  const resetSnapshot = await page.evaluate(async () => {
    await window.__game.resetSliceSave();
    return window.__game.getSnapshot();
  });

  expect(resetSnapshot.scene.beat).toBe('packet-offered');
  expect(resetSnapshot.packet.sealed).toBe(true);
  expect(resetSnapshot.packet.delivered).toBe(false);
  expect(resetSnapshot.interaction.packetIntent.outcome).toBe('unknown');
  expect(resetSnapshot.interaction.packetIntent.progress).toBe(0);
});
