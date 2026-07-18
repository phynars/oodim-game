// Red contract for the AFTERSIGN `window.__game` surface.
//
// Source of truth: docs/flagship/story-state-contract.md (FlagshipGameSurface).
// The runtime publisher lives in aftersign/index.html — publishState().
//
// This spec is intentionally minimal: it asserts the SHAPE the harness will
// rely on at first read, before any input is driven. Per-branch behavior
// (choose flows, memory round-trip, durable save) is covered by the sibling
// specs listed in that doc's "Required tests" section — this one only pins
// the surface's existence and top-level types so a future refactor cannot
// silently rename or drop a field the other specs depend on.
import { expect, test, type Page } from '@playwright/test';

const WAIT_MS = 15_000;

type FlagshipGameProbe = {
  version: 1;
  build: { slug: 'aftersign'; mode: 'test' | 'dev' | 'prod' };
  scene: {
    id: string;
    act: string;
    beat: string;
    ready: boolean;
  };
  player: {
    id: string;
    name: string | null;
    flags: Record<string, boolean | number | string>;
  };
  delivery: {
    id: 'blue-packet';
    outcome: 'unknown' | 'sealed' | 'opened' | 'withheld' | 'returned';
  };
  npcs: {
    io: {
      id: 'io';
      displayName: string;
      present: boolean;
      trustPosture: 'untested' | 'trusted-seal' | 'useful-breach';
      memories: unknown[];
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: {
    slot: string;
    revision: number;
    lastPersistedAt: string | null;
    dirty: boolean;
    authority: 'server' | 'local-fallback';
    lastLoadProof: {
      source: 'server' | 'local-fallback' | null;
      revision: number | null;
      playerId: string | null;
    };
  };
};

async function readSerializableProbe(page: Page): Promise<FlagshipGameProbe> {
  await page.waitForFunction(
    () => {
      const probe = (window as typeof window & { __game?: { version?: unknown } }).__game;
      return typeof probe === 'object' && probe !== null && probe.version === 1;
    },
    undefined,
    { timeout: WAIT_MS },
  );

  // JSON round-trip proves the surface is serializable — the harness has to
  // be able to structured-clone it out of the page context, so functions on
  // `input` are excluded from THIS assertion by design.
  return page.evaluate(() => {
    const probe = (window as typeof window & { __game?: unknown }).__game;
    return JSON.parse(JSON.stringify(probe)) as FlagshipGameProbe;
  });
}

test.describe('AFTERSIGN window.__game contract', () => {
  test('exposes the FlagshipGameSurface story/state shape on first stable read', async ({ page }) => {
    await page.goto(`/aftersign/?slot=window-game-contract-${Date.now()}`, {
      waitUntil: 'load',
    });

    const probe = await readSerializableProbe(page);

    expect(probe).toMatchObject({
      version: 1,
      build: {
        slug: 'aftersign',
        mode: expect.stringMatching(/^(test|dev|prod)$/),
      },
      scene: {
        id: expect.any(String),
        act: expect.any(String),
        beat: expect.any(String),
        ready: expect.any(Boolean),
      },
      player: {
        id: expect.any(String),
        // `name` may be null before the player has been prompted.
        flags: expect.any(Object),
      },
      delivery: {
        id: 'blue-packet',
        outcome: expect.stringMatching(/^(unknown|sealed|opened|withheld|returned)$/),
      },
      npcs: {
        io: {
          id: 'io',
          displayName: expect.any(String),
          present: expect.any(Boolean),
          trustPosture: expect.stringMatching(/^(untested|trusted-seal|useful-breach)$/),
          memories: expect.any(Array),
          lastLineMemoryRefs: expect.any(Array),
        },
      },
      save: {
        slot: expect.any(String),
        revision: expect.any(Number),
        dirty: expect.any(Boolean),
        authority: expect.stringMatching(/^(server|local-fallback)$/),
        lastLoadProof: {
          // source may legitimately be null before any load has occurred.
          revision: expect.anything(),
          playerId: expect.anything(),
        },
      },
    });

    // Non-empty invariants the doc calls out explicitly.
    expect(probe.player.id.length).toBeGreaterThan(0);
    expect(probe.scene.id.length).toBeGreaterThan(0);
    expect(probe.scene.act.length).toBeGreaterThan(0);
    expect(probe.scene.beat.length).toBeGreaterThan(0);

    // `player.name` is nullable but, if present, must be a string.
    if (probe.player.name !== null) {
      expect(typeof probe.player.name).toBe('string');
    }

    // `input` is a set of functions and therefore stripped by the JSON
    // round-trip above; assert it separately on the live surface.
    const inputShape = await page.evaluate(() => {
      const input = (window as typeof window & { __game?: { input?: Record<string, unknown> } }).__game?.input;
      if (!input) return null;
      return {
        choose: typeof input.choose,
        advance: typeof input.advance,
        forceSave: typeof input.forceSave,
        forceReload: typeof input.forceReload,
        waitForStoryIdle: typeof input.waitForStoryIdle,
      };
    });

    expect(inputShape).toEqual({
      choose: 'function',
      advance: 'function',
      forceSave: 'function',
      forceReload: 'function',
      waitForStoryIdle: 'function',
    });
  });
});
