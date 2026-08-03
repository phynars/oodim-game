import { describe, expect, it } from 'vitest';

type StoryBeat = {
  readonly id: string;
  readonly completed: boolean;
  readonly turn: number;
};

type NpcMemory = {
  readonly npcId: string;
  readonly rememberedBeatId: string;
  readonly line: string;
};

type SaveSnapshot = {
  readonly playerId: string;
  readonly turn: number;
  readonly story: {
    readonly activeBeatId: string;
    readonly completedBeats: readonly StoryBeat[];
  };
  readonly npcMemories: readonly NpcMemory[];
};

type GameSurface = {
  readonly save: () => SaveSnapshot;
  readonly load: (snapshot: SaveSnapshot) => void;
  readonly act: (actionId: string) => void;
  readonly getSnapshot: () => SaveSnapshot;
};

function createGameSurface(playerId = 'player-soren'): GameSurface {
  let snapshot: SaveSnapshot = {
    playerId,
    turn: 0,
    story: {
      activeBeatId: 'wake-at-the-beacon',
      completedBeats: [],
    },
    npcMemories: [],
  };

  function completeBeat(id: string): void {
    if (snapshot.story.completedBeats.some((beat) => beat.id === id)) return;

    snapshot = {
      ...snapshot,
      story: {
        activeBeatId: id === 'wake-at-the-beacon' ? 'io-recognizes-player' : id,
        completedBeats: [
          ...snapshot.story.completedBeats,
          { id, completed: true, turn: snapshot.turn },
        ],
      },
    };
  }

  return {
    save: () => structuredClone(snapshot),
    load: (nextSnapshot) => {
      snapshot = structuredClone(nextSnapshot);
    },
    act: (actionId) => {
      snapshot = { ...snapshot, turn: snapshot.turn + 1 };

      if (actionId === 'open-beacon-door') {
        completeBeat('wake-at-the-beacon');
      }

      if (actionId === 'speak-to-io' && snapshot.story.completedBeats.some((beat) => beat.id === 'wake-at-the-beacon')) {
        snapshot = {
          ...snapshot,
          npcMemories: [
            ...snapshot.npcMemories,
            {
              npcId: 'io',
              rememberedBeatId: 'wake-at-the-beacon',
              line: 'You opened the beacon door before the rain stopped.',
            },
          ],
        };
        completeBeat('io-recognizes-player');
      }
    },
    getSnapshot: () => structuredClone(snapshot),
  };
}

describe('player-visible flagship save/load contract', () => {
  it('persists story state and lets an NPC reference the prior session', () => {
    const firstSession = createGameSurface();

    firstSession.act('open-beacon-door');
    const durableSave = firstSession.save();

    const secondSession = createGameSurface();
    secondSession.load(durableSave);
    secondSession.act('speak-to-io');

    const restored = secondSession.getSnapshot();

    expect(restored.playerId).toBe('player-soren');
    expect(restored.story.completedBeats).toEqual([
      { id: 'wake-at-the-beacon', completed: true, turn: 1 },
      { id: 'io-recognizes-player', completed: true, turn: 2 },
    ]);
    expect(restored.npcMemories).toContainEqual({
      npcId: 'io',
      rememberedBeatId: 'wake-at-the-beacon',
      line: 'You opened the beacon door before the rain stopped.',
    });
  });
});
