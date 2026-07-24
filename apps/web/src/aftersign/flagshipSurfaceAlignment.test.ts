import { describe, expect, it } from 'vitest';

import {
  createAftersignWindowGameSurface,
  type AftersignStoryBeatId,
  type AftersignStoryStateSnapshot,
} from './windowGameSurface';
import type {
  FlagshipDeliveryOutcome,
  FlagshipGameSurface,
  FlagshipSceneBeat,
} from '../../../../e2e-shared/flagshipStoryStateContract';

type CoveredFlagshipSurface = {
  scene: Pick<FlagshipGameSurface['scene'], 'id' | 'act' | 'beat'>;
  delivery: Pick<FlagshipGameSurface['delivery'], 'id' | 'outcome'>;
  npcs: {
    io: Pick<FlagshipGameSurface['npcs']['io'], 'id' | 'displayName' | 'present'>;
  };
};

const BEAT_TO_FLAGSHIP_BEAT: Record<AftersignStoryBeatId, FlagshipSceneBeat> = {
  'packet-unresolved': 'arrival',
  'packet-sealed': 'packet-choice',
  'packet-opened': 'packet-choice',
  'io-first-meeting': 'packet-offered',
  'io-remembers-sealed-packet': 'io-return-recognition',
  'io-remembers-opened-packet': 'io-return-recognition',
};

function getCoveredFlagshipSurface(
  snapshot: AftersignStoryStateSnapshot,
): CoveredFlagshipSurface {
  const packetOutcome = snapshot.state.npcs[0].memory.packetOutcome;
  const deliveryOutcome: FlagshipDeliveryOutcome = packetOutcome ?? 'unknown';

  return {
    scene: {
      id: 'io-night-post-kiosk',
      act: 'act-1-seal',
      beat: BEAT_TO_FLAGSHIP_BEAT[snapshot.story.beat],
    },
    delivery: {
      id: 'blue-packet',
      outcome: deliveryOutcome,
    },
    npcs: {
      io: {
        id: snapshot.state.npcs[0].id,
        displayName: 'Io Vale',
        present: true,
      },
    },
  };
}

describe('AftersignWindowGameSurface flagship contract alignment', () => {
  it('pins the vertical-slice subset that maps onto the FlagshipGameSurface contract', () => {
    const surface = createAftersignWindowGameSurface(
      {
        scene: 'io-night-post-kiosk',
        ioHasMetPlayer: true,
        ioRecognizesPlayer: true,
        packetOutcome: 'sealed',
      } as Parameters<typeof createAftersignWindowGameSurface>[0],
      {
        playerId: 'player-flagship-fast-lane',
        playerName: 'Fast Lane Player',
        rememberedSessionIds: ['session-before'],
      },
    );

    const snapshot = surface.getStoryState();
    const covered = getCoveredFlagshipSurface(snapshot);

    expect(covered).toEqual({
      scene: {
        id: 'io-night-post-kiosk',
        act: 'act-1-seal',
        beat: 'io-return-recognition',
      },
      delivery: {
        id: 'blue-packet',
        outcome: 'sealed',
      },
      npcs: {
        io: {
          id: 'io',
          displayName: 'Io Vale',
          present: true,
        },
      },
    });

    expect(snapshot.state.player).toEqual({
      id: 'player-flagship-fast-lane',
      name: 'Fast Lane Player',
    });
    expect(snapshot.state.npcs[0].memory).toEqual({
      recognizesPlayer: true,
      packetOutcome: 'sealed',
    });
    expect(snapshot.state.npcs[0].rememberedSessionIds).toEqual(['session-before']);
  });
});
