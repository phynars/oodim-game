import { expect, test } from '@playwright/test';

test.describe('io recognition beat feel contract', () => {
  test('memory beat timing, camera, and lock stay in the tuned envelope', async ({ page }) => {
    await page.goto('/');

    await page.waitForFunction(() => {
      const game = (window as any).__game;
      return game?.version === 1 && game?.story?.memoryBeat;
    });

    const memoryBeat = await page.evaluate(() => {
      const game = (window as any).__game;
      return game.story.memoryBeat;
    });

    expect(memoryBeat.kind).toBe('io_packet_return');
    expect(['sealed', 'opened']).toContain(memoryBeat.outcome);

    const durationMs = Number(memoryBeat.endedAt) - Number(memoryBeat.startedAt);
    expect(durationMs).toBeGreaterThanOrEqual(1100);
    expect(durationMs).toBeLessThanOrEqual(1350);

    expect(Number(memoryBeat.cameraDeltaMeters)).toBeGreaterThanOrEqual(0.24);
    expect(Number(memoryBeat.cameraDeltaMeters)).toBeLessThanOrEqual(0.36);

    expect(Number(memoryBeat.cameraYawDegrees)).toBeGreaterThanOrEqual(3);
    expect(Number(memoryBeat.cameraYawDegrees)).toBeLessThanOrEqual(5);

    expect(Number(memoryBeat.inputLockMs)).toBeLessThanOrEqual(1220);
  });
});
