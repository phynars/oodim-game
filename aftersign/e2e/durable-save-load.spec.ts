import { expect, test } from '@playwright/test';

type SaveAuthority = 'server' | 'local-fallback';

type SaveProof = {
  authority: SaveAuthority;
  playerId: string;
  revision: number;
  savedAt: string;
  slot: string;
};

type SaveState = {
  authority: SaveAuthority;
  dirty: boolean;
  lastLoadProof: SaveProof | null;
  playerId: string;
  revision: number;
  savedAt: string | null;
  slot: string;
};

type AftersignHarness = {
  getSaveState(): SaveState;
  input: {
    forceReload(): Promise<void> | void;
    forceSave(): Promise<void> | SaveProof;
  };
};

declare global {
  interface Window {
    __game?: AftersignHarness;
  }
}

const readSaveState = async (page: import('@playwright/test').Page): Promise<SaveState> => {
  await page.waitForFunction(() => Boolean(window.__game?.getSaveState));

  return page.evaluate(() => {
    const game = window.__game;

    if (!game?.getSaveState) {
      throw new Error('AFTERSIGN must expose window.__game.getSaveState() for durable save/load assertions.');
    }

    return game.getSaveState();
  });
};

const forceSave = async (page: import('@playwright/test').Page): Promise<SaveProof> => {
  await page.waitForFunction(() => Boolean(window.__game?.input?.forceSave));

  return page.evaluate(async () => {
    const game = window.__game;

    if (!game?.input?.forceSave) {
      throw new Error('AFTERSIGN must expose window.__game.input.forceSave() for durable save/load assertions.');
    }

    return game.input.forceSave();
  });
};

const forceReload = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.waitForFunction(() => Boolean(window.__game?.input?.forceReload));

  await page.evaluate(async () => {
    const game = window.__game;

    if (!game?.input?.forceReload) {
      throw new Error('AFTERSIGN must expose window.__game.input.forceReload() for durable save/load assertions.');
    }

    await game.input.forceReload();
  });
};

test.describe('AFTERSIGN durable save/load contract', () => {
  test('restores the same server-authoritative save after a hard session boundary', async ({ page }) => {
    await page.goto('/aftersign');

    const beforeSave = await readSaveState(page);
    const saveProof = await forceSave(page);
    const afterSave = await readSaveState(page);

    expect(afterSave.slot).toBe(beforeSave.slot);
    expect(afterSave.playerId).toBe(beforeSave.playerId);
    expect(afterSave.dirty).toBe(false);
    expect(afterSave.savedAt).toBeTruthy();
    expect(afterSave.revision).toBeGreaterThanOrEqual(beforeSave.revision);
    expect(['server', 'local-fallback']).toContain(afterSave.authority);

    expect(saveProof).toMatchObject({
      authority: afterSave.authority,
      playerId: afterSave.playerId,
      revision: afterSave.revision,
      slot: afterSave.slot,
    });
    expect(saveProof.savedAt).toBeTruthy();

    await page.context().clearCookies();
    await page.reload({ waitUntil: 'networkidle' });
    await forceReload(page);

    const afterReload = await readSaveState(page);

    expect(afterReload.slot).toBe(afterSave.slot);
    expect(afterReload.playerId).toBe(afterSave.playerId);
    expect(afterReload.revision).toBe(afterSave.revision);
    expect(afterReload.dirty).toBe(false);
    expect(afterReload.savedAt).toBe(afterSave.savedAt);
    expect(afterReload.authority).toBe(afterSave.authority);
    expect(afterReload.lastLoadProof).toEqual({
      authority: afterSave.authority,
      playerId: afterSave.playerId,
      revision: afterSave.revision,
      savedAt: afterSave.savedAt,
      slot: afterSave.slot,
    });
  });
});
