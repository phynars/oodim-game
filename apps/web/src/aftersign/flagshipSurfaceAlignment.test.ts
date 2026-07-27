import { describe, expect, it } from 'vitest';

import {
  createAftersignWindowGameSurface,
  type AftersignStoryStateSnapshot,
} from './windowGameSurface';
import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from './verticalSliceRuntimeState';

describe('AFTERSIGN flagship game surface alignment', () => {
  it('projects the shared story/state subset expected by the WebGL harness', () => {
    const firstSession = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), 'sealed'),
    );
    const returningSession = meetIoForAftersignSlice(firstSession);

    const surface = createAftersignWindowGameSurface(returningSession, {
      playerId: 'player-io-7',
      playerName: 'Seven',
      rememberedSessionIds: ['session-before-kiosk'],
    });

    expect(surface.getStoryState()).toEqual<AftersignStoryStateSnapshot>({
      story: {
        id: 'aftersign.verticalSlice',
        act: 'act-1',
        beat: 'io-remembers-sealed-packet',
        completedBeats: [
          'packet-sealed',
          'io-first-meeting',
          'io-remembers-sealed-packet',
        ],
      },
      state: {
        scene: 'io-return',
        player: {
          id: 'player-io-7',
          name: 'Seven',
        },
        npcs: [
          {
            id: 'io',
            name: 'Io',
            disposition: 'recognizes-player',
            rememberedSessionIds: ['session-before-kiosk'],
            memory: {
              recognizesPlayer: true,
              packetOutcome: 'sealed',
            },
          },
        ],
      },
    });
  });
});
