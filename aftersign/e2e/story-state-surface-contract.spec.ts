import { expect, test } from '@playwright/test';

test('window.__game exposes story/state contract fields for harness assertions', async ({ page }) => {
  await page.goto('/?slot=packet-intent-scene');

  await page.waitForFunction(() => (window as any).__game?.version === 1);

  const surface = await page.evaluate(() => {
    const game = (window as any).__game;
    return {
      storyBeat: game?.storyBeat ?? null,
      sessionId: game?.sessionId ?? null,
    };
  });

  expect(typeof surface.storyBeat).toBe('string');
  expect(surface.storyBeat).toBeTruthy();
  expect(typeof surface.sessionId).toBe('string');
  expect(surface.sessionId).toBeTruthy();
});
