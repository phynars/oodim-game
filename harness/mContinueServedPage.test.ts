import { describe, expect, test } from 'vitest';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const REQUIRED_POST_RECOGNITION_BEATS = 2;

type FlagshipBeat = {
  id?: string;
  key?: string;
  slug?: string;
  sceneId?: string;
  beatId?: string;
};

type FlagshipHarnessSurface = {
  currentBeatId?: string;
  currentSceneId?: string;
  beatHistory?: Array<string | FlagshipBeat>;
  beatsReached?: Array<string | FlagshipBeat>;
  storyState?: {
    currentBeatId?: string;
    currentSceneId?: string;
    beatHistory?: Array<string | FlagshipBeat>;
    beatsReached?: Array<string | FlagshipBeat>;
  };
  continueFromRecognition?: () => Promise<void> | void;
  chooseReturnTone?: (tone: string) => Promise<void> | void;
  deliverPacket?: () => Promise<void> | void;
};

declare global {
  interface Window {
    __game?: FlagshipHarnessSurface;
  }
}

const beatId = (beat: string | FlagshipBeat): string => {
  if (typeof beat === 'string') return beat;
  return beat.id ?? beat.key ?? beat.slug ?? beat.sceneId ?? beat.beatId ?? '';
};

const reachedBeatIds = (surface: FlagshipHarnessSurface): string[] => {
  const state = surface.storyState ?? {};
  return [
    ...(surface.beatHistory ?? []),
    ...(surface.beatsReached ?? []),
    ...(state.beatHistory ?? []),
    ...(state.beatsReached ?? []),
    surface.currentBeatId,
    surface.currentSceneId,
    state.currentBeatId,
    state.currentSceneId,
  ]
    .filter((beat): beat is string | FlagshipBeat => Boolean(beat))
    .map(beatId)
    .filter(Boolean);
};

describe('M-CONTINUE served-page story reachability contract', () => {
  test('phone-shaped play can continue past Io return recognition into two later beats', async () => {
    // This is intentionally written against the served-page window.__game surface.
    // The runner must provide a real page at game.oodim.com/aftersign or the local equivalent.
    expect(PHONE_VIEWPORT).toEqual({ width: 390, height: 844 });

    const surface = globalThis.window?.__game;
    expect(surface, 'served page must expose window.__game for story-state assertions').toBeTruthy();

    await surface?.continueFromRecognition?.();
    await surface?.chooseReturnTone?.('steady');
    await surface?.deliverPacket?.();

    const reached = reachedBeatIds(surface ?? {});
    const recognitionIndex = reached.indexOf('io-return-recognition');
    expect(recognitionIndex, 'served story state must include io-return-recognition before continuing').toBeGreaterThanOrEqual(0);

    const postRecognition = reached.slice(recognitionIndex + 1);
    expect(
      postRecognition,
      'M-CONTINUE requires at least two served-page beats after io-return-recognition',
    ).toEqual(expect.arrayContaining(['return-tone-choice', 'io-next-job']));
    expect(new Set(postRecognition).size).toBeGreaterThanOrEqual(REQUIRED_POST_RECOGNITION_BEATS);
  });
});
