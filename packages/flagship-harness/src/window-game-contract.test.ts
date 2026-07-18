import { describe, expect, it } from 'vitest';

/**
 * Flagship harness contract: every playable flagship scene must expose a
 * deterministic story/state probe on window.__game before gameplay code can
 * claim a story beat exists.
 *
 * This is intentionally written as a red contract against the future runner:
 * attachFlagshipHarnessProbe must load the scene in the WebGL-headless harness
 * and return the page's window.__game value after the first stable frame.
 */
import { attachFlagshipHarnessProbe } from './window-game-contract';

describe('flagship window.__game story/state contract', () => {
  it('exposes the current story beat and durable player/session identity', async () => {
    const game = await attachFlagshipHarnessProbe({
      slug: 'aftersign',
      playerId: 'harness-player-window-game',
    });

    expect(game).toEqual(
      expect.objectContaining({
        slug: 'aftersign',
        player: expect.objectContaining({
          id: 'harness-player-window-game',
          sessionId: expect.any(String),
        }),
        story: expect.objectContaining({
          beatId: expect.any(String),
          actId: expect.any(String),
          summary: expect.any(String),
        }),
        state: expect.any(Object),
      }),
    );

    expect(game.story.beatId.length).toBeGreaterThan(0);
    expect(game.story.actId.length).toBeGreaterThan(0);
    expect(game.story.summary.length).toBeGreaterThan(0);
  });
});
