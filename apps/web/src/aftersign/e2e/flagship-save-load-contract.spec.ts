import { test, expect } from '@playwright/test';

type FlagshipSaveBlock = {
  slot: string;
  revision: number;
  lastPersistedAt: string | null;
  dirty: boolean;
  authority: 'client' | 'server';
  lastLoadProof: {
    source: 'client' | 'server';
    revision: number;
    slot: string;
  } | null;
};

test.describe('AFTERSIGN durable save/load contract', () => {
  test('forceSave survives a clean reload as server-authoritative state', async ({ page }) => {
    await page.goto('/aftersign/');

    await page.waitForFunction(() => Boolean(window.__game));

    await page.evaluate(async () => {
      if (typeof window.__game?.forceSave !== 'function') {
        throw new Error('window.__game.forceSave must be exposed for the durable save/load harness');
      }

      await window.__game.forceSave({ slot: 'contract-save-load' });
    });

    await page.evaluate(async () => {
      if (typeof window.__game?.forceReload !== 'function') {
        throw new Error('window.__game.forceReload must be exposed for the durable save/load harness');
      }

      await window.__game.forceReload({ clearLocalState: true });
    });

    const save = await page.evaluate<FlagshipSaveBlock>(() => {
      const state = window.__game?.getState?.() ?? window.__game;
      return state?.save;
    });

    expect(save).toMatchObject({
      slot: 'contract-save-load',
      dirty: false,
      authority: 'server',
      lastLoadProof: {
        source: 'server',
        slot: 'contract-save-load',
      },
    });
    expect(save.revision).toBeGreaterThan(0);
    expect(save.lastPersistedAt).toEqual(expect.any(String));
    expect(save.lastLoadProof?.revision).toBe(save.revision);
  });
});

declare global {
  interface Window {
    __game?: {
      forceSave?: (options: { slot: string }) => Promise<void> | void;
      forceReload?: (options: { clearLocalState: boolean }) => Promise<void> | void;
      getState?: () => { save?: FlagshipSaveBlock };
      save?: FlagshipSaveBlock;
    };
  }
}

export {};
