// Hard-navigation survival for the AFTERSIGN save surface.
//
// This is NOT the durable/authoritative contract test — that lives at
// aftersign/e2e/flagship-surface-contract.spec.ts. It verifies that a
// full document teardown can rehydrate a writable save surface.
import { expect, test, type Page } from '@playwright/test';
import { assertHardNavigationSaveSurvival } from '../src/hardNavigationSaveSurvival';

const COLD_START_MS = 240_000;
const WAIT_MS = 60_000;

type SaveAuthority = 'server' | 'local-fallback';
type LoadProof = {
  source: SaveAuthority | null;
  revision: number | null;
  playerId: string | null;
};

type SaveProbe = {
  player: { id: string };
  save: {
    slot: string;
    revision: number;
    lastPersistedAt: string | null;
    dirty: boolean;
    authority: SaveAuthority;
    lastLoadProof: LoadProof;
  };
  input: {
    forceSave: () => Promise<unknown> | unknown;
    forceReload: () => Promise<unknown> | unknown;
    waitForStoryIdle: () => Promise<unknown> | unknown;
  };
};

type SerializableSaveProbe = Omit<SaveProbe, 'input'>;

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const probe = (window as typeof window & { __game?: { version?: unknown } }).__game;
      return typeof probe === 'object' && probe !== null && probe.version === 1;
    },
    undefined,
    { timeout: WAIT_MS },
  );
}

async function readSaveProbe(page: Page): Promise<SerializableSaveProbe> {
  await waitForGame(page);
  return page.evaluate(() => {
    const probe = (window as typeof window & { __game?: SaveProbe }).__game;
    if (!probe) throw new Error('window.__game was not published');
    const { input: _input, ...serializable } = probe;
    return JSON.parse(JSON.stringify(serializable)) as SerializableSaveProbe;
  });
}

async function forceSave(page: Page): Promise<void> {
  await waitForGame(page);
  await page.evaluate(async () => {
    const game = (window as typeof window & { __game?: SaveProbe }).__game;
    if (!game?.input?.forceSave) throw new Error('window.__game.input.forceSave is missing');
    await game.input.forceSave();
    await game.input.waitForStoryIdle?.();
  });
}

async function forceReload(page: Page): Promise<void> {
  await waitForGame(page);
  await page.evaluate(async () => {
    const game = (window as typeof window & { __game?: SaveProbe }).__game;
    if (!game?.input?.forceReload) throw new Error('window.__game.input.forceReload is missing');
    await game.input.forceReload();
    await game.input.waitForStoryIdle?.();
  });
}

test.describe('AFTERSIGN hard-navigation save survival', () => {
  test('slot, revision, playerId, timestamp, clean-state, authority, and lastLoadProof survive a full page.goto boundary', async ({ page }) => {
    test.skip(
      process.env.FLAGSHIP_BREAK_MODE !== 'local-only-save',
      'red lane requires FLAGSHIP_BREAK_MODE=local-only-save',
    );
    test.setTimeout(COLD_START_MS);

    const slotKey = `hard-nav-save-${Date.now()}`;
    const CONTRACT_SLOT = 'default';

    await page.goto(`/aftersign/?slot=${slotKey}`, { waitUntil: 'load' });

    const cold = await readSaveProbe(page);
    expect(cold.save.slot).toBe(CONTRACT_SLOT);
    expect(cold.player.id.length).toBeGreaterThan(0);

    await forceSave(page);

    const saved = await readSaveProbe(page);
    expect(saved.save.slot).toBe(CONTRACT_SLOT);
    expect(saved.save.dirty).toBe(false);
    expect(saved.save.revision).toBeGreaterThanOrEqual(cold.save.revision);
    expect(saved.save.lastPersistedAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(saved.save.lastPersistedAt as string))).toBe(false);
    expect(saved.save.authority).toMatch(/^(server|local-fallback)$/);

    await page.goto('/aftersign/', { waitUntil: 'load' });
    await page.goto(`/aftersign/?slot=${slotKey}`, { waitUntil: 'load' });
    await forceReload(page);

    const loaded = await readSaveProbe(page);
    await forceSave(page);
    const resaved = await readSaveProbe(page);
    assertHardNavigationSaveSurvival({ cold, saved, loaded, resaved });
  });
});
