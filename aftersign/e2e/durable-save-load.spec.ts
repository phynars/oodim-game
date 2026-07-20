// Hard-navigation survival for the AFTERSIGN save surface.
//
// This is NOT the durable/authoritative contract test — that lives at
// aftersign/e2e/flagship-surface-contract.spec.ts
//   > "durable save/load: authoritative reload survives clearLocalState"
// and is the sole gate for docs/flagship/story-state-contract.md §"save"
// (server authority, clearLocalState, lastLoadProof.source === 'server').
//
// What this spec pins instead: after forceSave(), a full browser
// navigation (page.goto to a fresh document, then back to the slot URL)
// followed by forceReload() must still surface the same slot, revision,
// playerId, and lastLoadProof. The in-page forceReload path in the
// authoritative test does not exercise a real document teardown; this
// one does. It deliberately accepts either 'server' or 'local-fallback'
// because authority polarity is owned by the strict test — duplicating
// that gate here would only add a second place to update when the
// contract shifts.
//
// If you are looking for the test that must fail under
// FLAGSHIP_BREAK_MODE=local-only-save, it is the strict one linked above,
// not this file.
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

test.describe('AFTERSIGN hard-navigation save survival', () => {
  test('slot, revision, playerId, and lastLoadProof survive a full page.goto boundary', async ({ page }) => {
    const slot = `hard-nav-save-${Date.now()}`;

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
    // Authority polarity is intentionally NOT gated here — the strict
    // durable test owns that assertion. See file header.
    expect(saved.save.authority).toMatch(/^(server|local-fallback)$/);

    // The point of this spec: a real document teardown, not an in-page reload.
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
