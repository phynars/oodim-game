import { describe, expect, it } from 'vitest';

import {
  AFTERSIGN_DURABLE_SAVE_KEY,
  createInitialAftersignState,
  encodeAftersignSave,
  restoreAftersignState,
} from './verticalSliceState';

describe('Aftersign durable save surface', () => {
  it('preserves save metadata after restored story progression is saved again', () => {
    const firstSession = createInitialAftersignState({
      playerId: 'player-durable-surface',
      now: 1_789_000_000_000,
    });

    firstSession.completeStoryBeat('io-introduction');
    firstSession.recordNpcMemory('io', {
      kind: 'recognizes-player',
      summary: 'Io remembers the player stabilized the first signal.',
      occurredAt: 1_789_000_001_000,
    });

    const firstSave = encodeAftersignSave(firstSession.snapshot());
    const restored = restoreAftersignState(firstSave, {
      now: 1_789_000_010_000,
    });

    restored.completeStoryBeat('first-return');

    const secondSave = encodeAftersignSave(restored.snapshot());
    const secondRestore = restoreAftersignState(secondSave, {
      now: 1_789_000_020_000,
    });
    const snapshot = secondRestore.snapshot();

    expect(snapshot.state.save).toMatchObject({
      key: AFTERSIGN_DURABLE_SAVE_KEY,
      playerId: 'player-durable-surface',
      turn: 2,
      restoredFromSave: true,
    });
    expect(snapshot.story.completedBeats).toEqual([
      'io-introduction',
      'first-return',
    ]);
    expect(snapshot.npcs.io.memories).toContainEqual(
      expect.objectContaining({
        kind: 'recognizes-player',
        summary: 'Io remembers the player stabilized the first signal.',
      }),
    );
  });
});
