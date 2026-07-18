import { expect, test } from '@playwright/test';

type SerializableFlagshipProbe = {
  slug: string;
  player: {
    id: string;
    sessionId: string;
  };
  story: {
    beatId: string;
    actId: string;
    summary: string;
  };
  state: Record<string, unknown>;
};

test.describe('AFTERSIGN window.__game story/state contract', () => {
  test('exposes a serializable story/state probe after the first stable frame', async ({ page }) => {
    await page.goto('/');

    await page.waitForFunction(() => {
      const probe = (window as typeof window & { __game?: unknown }).__game;
      return typeof probe === 'object' && probe !== null;
    });

    const game = await page.evaluate<SerializableFlagshipProbe>(() => {
      const probe = (window as typeof window & { __game?: unknown }).__game;
      return JSON.parse(JSON.stringify(probe)) as SerializableFlagshipProbe;
    });

    expect(game).toMatchObject({
      slug: 'aftersign',
      player: {
        id: expect.any(String),
        sessionId: expect.any(String),
      },
      story: {
        beatId: expect.any(String),
        actId: expect.any(String),
        summary: expect.any(String),
      },
      state: expect.any(Object),
    });

    expect(game.player.id.length).toBeGreaterThan(0);
    expect(game.player.sessionId.length).toBeGreaterThan(0);
    expect(game.story.beatId.length).toBeGreaterThan(0);
    expect(game.story.actId.length).toBeGreaterThan(0);
    expect(game.story.summary.length).toBeGreaterThan(0);
  });
});
