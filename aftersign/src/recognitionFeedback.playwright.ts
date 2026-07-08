// @ts-nocheck
import { expect, test } from '@playwright/test';

test('io recognition beat publishes memoryBeat contract on window.__game.story', async ({ page }) => {
  await page.goto('/');

  await page.waitForFunction(() => {
    const memoryBeat = (window as any).__game?.story?.memoryBeat;
    return memoryBeat && memoryBeat.kind === 'io_packet_return';
  });

  const memoryBeat = await page.evaluate(() => (window as any).__game?.story?.memoryBeat);

  expect(memoryBeat.kind).toBe('io_packet_return');
  expect(['sealed', 'opened']).toContain(memoryBeat.outcome);
  expect(typeof memoryBeat.startedAt).toBe('number');
  expect(typeof memoryBeat.inputLockMs).toBe('number');
  expect(typeof memoryBeat.cameraDeltaMeters).toBe('number');
  expect(typeof memoryBeat.cameraYawDegrees).toBe('number');
  expect(typeof memoryBeat.lineId).toBe('string');
});
