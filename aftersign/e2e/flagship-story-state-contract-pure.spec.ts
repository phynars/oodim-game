import { expect, test } from '@playwright/test';

import {
  assertDurableSaveLoaded,
  assertNpcReferencesPriorMemory,
  assertSerializableFlagshipSurface,
  assertStoryBeatTransition,
  type FlagshipGameSurface,
} from '../../e2e-shared/flagshipStoryStateContract';
import { expectedIoRecognitionLine } from '../src/ioRecognitionDialogue';

type SurfaceOverrides = Partial<
  Omit<FlagshipGameSurface, 'build' | 'scene' | 'player' | 'delivery' | 'npcs' | 'save' | 'input'>
> & {
  build?: Partial<FlagshipGameSurface['build']>;
  scene?: Partial<FlagshipGameSurface['scene']>;
  player?: Partial<FlagshipGameSurface['player']>;
  delivery?: Partial<FlagshipGameSurface['delivery']>;
  npcs?: {
    io?: Partial<FlagshipGameSurface['npcs']['io']>;
  };
  save?: Partial<Omit<FlagshipGameSurface['save'], 'lastLoadProof'>> & {
    lastLoadProof?: Partial<FlagshipGameSurface['save']['lastLoadProof']>;
  };
  input?: Partial<FlagshipGameSurface['input']>;
};

function makeSurface(overrides: SurfaceOverrides = {}): FlagshipGameSurface {
  const base: FlagshipGameSurface = {
    version: 1,
    build: {
      slug: 'aftersign',
      mode: 'test',
    },
    scene: {
      id: 'io-night-post-kiosk',
      act: 'act-1-seal',
      beat: 'arrival',
      ready: true,
    },
    player: {
      id: 'player-story-state-contract',
      name: null,
      flags: {},
    },
    delivery: {
      id: 'blue-packet',
      outcome: 'unknown',
    },
    npcs: {
      io: {
        id: 'io',
        displayName: 'Io Vale',
        present: true,
        trustPosture: 'untested',
        memories: [],
        lastLine: null,
        lastLineMemoryRefs: [],
      },
    },
    save: {
      slot: 'default',
      revision: 1,
      lastPersistedAt: null,
      dirty: false,
      authority: 'server',
      lastLoadProof: {
        source: 'server',
        revision: 1,
        playerId: 'player-story-state-contract',
      },
    },
    input: {
      choose: async () => {},
      advance: async () => {},
      forceSave: async () => {},
      forceReload: async () => {},
      waitForStoryIdle: async () => {},
    },
  };

  return {
    ...base,
    ...overrides,
    build: { ...base.build, ...overrides.build },
    scene: { ...base.scene, ...overrides.scene },
    player: { ...base.player, ...overrides.player },
    delivery: { ...base.delivery, ...overrides.delivery },
    npcs: {
      io: {
        ...base.npcs.io,
        ...overrides.npcs?.io,
      },
    },
    save: {
      ...base.save,
      ...overrides.save,
      lastLoadProof: {
        ...base.save.lastLoadProof,
        ...overrides.save?.lastLoadProof,
      },
    },
    input: { ...base.input, ...overrides.input },
  };
}

test.describe('AFTERSIGN flagship story/state pure contract', () => {
  test('serializable surface keeps the authored story/state spine intact', () => {
    expect(() => assertSerializableFlagshipSurface(makeSurface())).not.toThrow();
  });

  test('story beat transition helper pins the next authored beat and flag', () => {
    const before = makeSurface();
    const after = makeSurface({
      scene: { beat: 'packet-offered' },
      player: { flags: { io_intro_seen: true } },
    });

    expect(() =>
      assertStoryBeatTransition(before, after, 'packet-offered', 'io_intro_seen'),
    ).not.toThrow();
  });

  test('Io returning recognition must cite the durable prior delivery memory, not raw bookkeeping text', () => {
    const returning = makeSurface({
      scene: { beat: 'io-return-recognition' },
      delivery: { outcome: 'sealed' },
      npcs: {
        io: {
          trustPosture: 'trusted-seal',
          memories: [
            {
              id: 'io-remembers-blue-packet-sealed',
              kind: 'delivery-outcome',
              subject: 'player',
              predicate: 'delivered_packet',
              object: 'sealed',
              deliveryId: 'blue-packet',
              sessionId: 'session-a',
              source: 'server',
            },
          ],
          // Canonical returning-tier line (#1077): the contract now
          // checks membership in the canonical line set, not a fragment.
          lastLine: expectedIoRecognitionLine('sealed', false),
          lastLineMemoryRefs: ['io-remembers-blue-packet-sealed'],
        },
      },
    });

    expect(() => assertNpcReferencesPriorMemory(returning, 'sealed')).not.toThrow();
  });

  test('durable save proof rejects local-only reloads after local state is cleared', () => {
    const beforeSave = makeSurface({
      save: {
        revision: 3,
        lastPersistedAt: '2026-07-30T00:00:00.000Z',
      },
      player: {
        flags: { io_intro_seen: true, returned_after_first_session: true },
      },
      npcs: {
        io: {
          memories: [
            {
              id: 'io-remembers-blue-packet-opened',
              kind: 'delivery-outcome',
              subject: 'player',
              predicate: 'delivered_packet',
              object: 'opened',
              deliveryId: 'blue-packet',
              sessionId: 'session-b',
              source: 'server',
            },
          ],
        },
      },
    });
    const afterLoad = makeSurface({
      save: {
        revision: 3,
        lastPersistedAt: '2026-07-30T00:00:00.000Z',
        lastLoadProof: {
          source: 'server',
          revision: 3,
          playerId: 'player-story-state-contract',
        },
      },
      player: beforeSave.player,
      npcs: beforeSave.npcs,
    });

    expect(() => assertDurableSaveLoaded(beforeSave, afterLoad)).not.toThrow();

    const localOnlyLoad = makeSurface({
      save: {
        ...afterLoad.save,
        authority: 'local-fallback',
        lastLoadProof: {
          source: 'local-fallback',
          revision: 3,
          playerId: 'player-story-state-contract',
        },
      },
      player: afterLoad.player,
      npcs: afterLoad.npcs,
    });

    expect(() => assertDurableSaveLoaded(beforeSave, localOnlyLoad)).toThrow(
      /save\.authority === 'server'/,
    );
  });
});
