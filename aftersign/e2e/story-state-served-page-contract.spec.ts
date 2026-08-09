import { expect, test, type Page } from '@playwright/test';

type AftersignServedSnapshot = {
  scene?: {
    beat?: string;
    ready?: boolean;
  };
  story?: {
    beat?: string;
    memoryBeat?: {
      kind?: string;
      outcome?: string;
    } | null;
  };
  state?: {
    save?: unknown;
    npcs?: Array<{
      id?: string;
      disposition?: string;
      memory?: Record<string, unknown>;
    }>;
  };
  input?: unknown;
};

type AftersignServedGame = {
  getSnapshot?: () => AftersignServedSnapshot;
  input?: {
    choose?: (choice: 'seal' | 'open') => Promise<unknown> | unknown;
    forceSave?: () => Promise<unknown> | unknown;
    forceReload?: (options?: { clearLocalState?: boolean }) => Promise<unknown> | unknown;
    waitForStoryIdle?: () => Promise<unknown> | unknown;
  };
};

declare global {
  interface Window {
    __game?: AftersignServedGame;
  }
}

const readSnapshot = async (page: Page): Promise<AftersignServedSnapshot> => {
  return page.evaluate(() => {
    const game = window.__game;
    if (!game?.getSnapshot) {
      throw new Error('served /aftersign/ window.__game.getSnapshot is missing');
    }

    return JSON.parse(JSON.stringify(game.getSnapshot())) as AftersignServedSnapshot;
  });
};

const waitForServedHarness = async (page: Page): Promise<void> => {
  await page.goto('/aftersign/');
  await page.waitForFunction(() => {
    const game = window.__game;
    return Boolean(
      game?.getSnapshot &&
        game.input?.choose &&
        game.input?.forceSave &&
        game.input?.forceReload,
    );
  });
};

const waitForStoryIdle = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await window.__game?.input?.waitForStoryIdle?.();
  });
};

test('served page exposes the story/state surface used by the flagship slice', async ({ page }) => {
  await waitForServedHarness(page);
  await page.evaluate(() => window.__game!.input!.forceReload?.({ clearLocalState: true }));
  await waitForStoryIdle(page);

  const baseline = await readSnapshot(page);
  expect(baseline.scene?.ready).toBe(true);
  expect(typeof (baseline.scene?.beat ?? baseline.story?.beat)).toBe('string');

  await page.evaluate(async () => {
    await window.__game!.input!.choose?.('seal');
    await window.__game!.input!.forceSave?.();
    await window.__game!.input!.waitForStoryIdle?.();
  });

  const afterChoice = await readSnapshot(page);
  const serializedAfterChoice = JSON.stringify(afterChoice);
  expect(serializedAfterChoice).toContain('seal');

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__game?.getSnapshot && window.__game.input?.forceReload));
  await page.evaluate(async () => {
    await window.__game!.input!.forceReload?.();
    await window.__game!.input!.waitForStoryIdle?.();
  });

  const afterReload = await readSnapshot(page);
  const serializedAfterReload = JSON.stringify(afterReload);
  expect(serializedAfterReload).toContain('seal');
});
