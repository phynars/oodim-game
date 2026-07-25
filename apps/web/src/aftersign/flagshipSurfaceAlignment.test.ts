import { describe, expect, it } from 'vitest';

import type { FlagshipGameSurface } from '../../../../e2e-shared/flagshipStoryStateContract';
import {
  type AftersignStoryStateSnapshot,
  createAftersignWindowGameSurface,
} from './windowGameSurface';

describe('AftersignWindowGameSurface flagship alignment', () => {
  it('projects the story/state subset promised by the shared flagship surface contract', () => {
    const snapshot: AftersignStoryStateSnapshot = {
      scene: {
        id: 'io-night-post-kiosk',
      },
      story: {
        act: 'act-1-seal',
        beat: 'io-return-recognition',
      },
      delivery: {
        id: 'blue-packet',
        outcome: 'sealed',
      },
      npcMemory: {
        npcId: 'io',
        recognition: 'returning',
      },
    };

    const surface = createAftersignWindowGameSurface(() => snapshot);
    const storyState = surface.getStoryState();

    const flagshipSubset: Pick<FlagshipGameSurface, 'story' | 'state'> = storyState;

    expect(flagshipSubset).toEqual({
      story: {
        sceneId: 'io-night-post-kiosk',
        act: 'act-1-seal',
        beat: 'io-return-recognition',
      },
      state: {
        delivery: {
          id: 'blue-packet',
          outcome: 'sealed',
        },
        npcMemory: {
          npcId: 'io',
          recognition: 'returning',
        },
      },
    });
  });
});
