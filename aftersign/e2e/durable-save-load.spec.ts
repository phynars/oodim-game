// Red contract for the AFTERSIGN durable save/load surface.
//
// This pins the harness-level invariant the flagship brief asks for: a save is
// not real until a fresh page can load it through window.__game and expose an
// explicit load proof. The implementation may use the server authority or the
// local fallback in test mode, but the observable contract must survive a hard
// session boundary.
import { expect, test, type Page } from '@playwright/test';

const WAIT_MS = 15_000;

type SaveAuthority = 'server' | 'local-fallback';
type LoadProof = {
  source: SaveAuthority | null;
  revision: number | null;
  playerId: string | null;
};

type SaveProbe = {
  player: {
    id: string;
  };
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

test.describe('AFTERSIGN durable save/load contract', () => {
  test('reloads a saved slot with explicit authority and load proof', async ({ page }) => {
    const slot = `durable-save-load-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: 'load' });

    const cold = await readSaveProbe(page);
    expect(cold.save.slot).toBe(slot);
    expect(cold.player.id.length).toBeGreaterThan(0);

    await forceSave(page);

    const saved = await readSaveProbe(page);
    expect(saved.save.slot).toBe(slot);
    expect(saved.save.dirty).toBe(false);
    expect(saved.save.revision).toBeGreaterThanOrEqual(cold.save.revision);
    expect(saved.save.lastPersistedAt).toEqual(expect.any(String));
    expect(saved.save.authority).toMatch(/^(server|local-fallback)$/);

    await page.goto('/aftersign/', { waitUntil: 'load' });
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: 'load' });
    await forceReload(page);

    const loaded = await readSaveProbe(page);
    expect(loaded.save.slot).toBe(slot);
    expect(loaded.save.lastLoadProof).toEqual({
      source: saved.save.authority,
      revision: saved.save.revision,
      playerId: saved.player.id,
    });
    expect(loaded.player.id).toBe(saved.player.id);
    expect(loaded.save.revision).toBe(saved.save.revision);
  });
});
