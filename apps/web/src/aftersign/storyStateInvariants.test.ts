import { describe, expect, it } from 'vitest';

import { createAftersignGameSurface } from './windowGameSurface';

describe('AFTERSIGN story/state harness contract', () => {
  it('exposes the first playable story beat through window.__game state invariants', () => {
    const surface = createAftersignGameSurface({
      mode: 'test',
      playerId: 'story-contract-player',
      now: () => 0,
    });

    surface.start();

    const snapshot = surface.getSnapshot();

    expect(snapshot.story).toMatchObject({
      act: 'vertical-slice',
      beatId: 'arrival-at-io-phone',
      status: 'active',
    });
    expect(snapshot.player).toMatchObject({
      id: 'story-contract-player',
      canMove: true,
    });
    expect(snapshot.npcs).toContainEqual(
      expect.objectContaining({
        id: 'io',
        present: true,
        currentBeatId: 'arrival-at-io-phone',
      }),
    );

    surface.stop();
  });
});
