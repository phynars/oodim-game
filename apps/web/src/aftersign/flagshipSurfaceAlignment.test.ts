import { describe, expect, it } from 'vitest';

import type { AftersignStoryStateSnapshot, FlagshipGameSurface } from './windowGameSurface';
import { createAftersignWindowGameSurface } from './windowGameSurface';

function makeReturningRecognitionSnapshot(): AftersignStoryStateSnapshot {
  return {
    story: {
      sceneId: 'io-night-post-kiosk',
      act: 'act-1-seal',
      beat: 'io-return-recognition',
    },
    state: {
      delivery: {
        id: 'blue-packet',
        status: 'sealed',
      },
      npcMemory: {
        npcId: 'io',
        relationship: 'returning',
      },
    },
  };
}

describe('AftersignWindowGameSurface flagship contract alignment', () => {
  it('projects the shared window.__game story/state shape for returning NPC recognition', () => {
    const surface: FlagshipGameSurface = createAftersignWindowGameSurface({
      getStoryState: () => makeReturningRecognitionSnapshot(),
    });

    expect(surface.getStoryState()).toMatchObject({
      story: {
        sceneId: 'io-night-post-kiosk',
        act: 'act-1-seal',
        beat: 'io-return-recognition',
      },
      state: {
        delivery: {
          id: 'blue-packet',
          status: 'sealed',
        },
        npcMemory: {
          npcId: 'io',
          relationship: 'returning',
        },
      },
    });
  });
});
