import { expect, test } from '@playwright/test';

type AftersignSnapshot = {
  story?: {
    beat?: string;
    sessionId?: string;
    savedAt?: string;
  };
  npcs?: {
    io?: {
      memory?: unknown[];
      lastLine?: string;
      lastLineMemoryRefs?: string[];
    };
  };
  save?: {
    slot?: string;
    version?: number;
    updatedAt?: string;
  };
};

declare global {
  interface Window {
    __game?: {
      getSnapshot?: () => AftersignSnapshot;
      save?: (slot?: string) => Promise<AftersignSnapshot> | AftersignSnapshot;
      load?: (slot?: string) => Promise<AftersignSnapshot> | AftersignSnapshot;
      rememberNpcFact?: (npcId: string, fact: { id: string; text: string }) => Promise<void> | void;
      speakToNpc?: (npcId: string) => Promise<string> | string;
    };
  }
}

const slot = 'playwright-story-state-save-load';
const rememberedFact = {
  id: 'prior-session-io-power-restored',
  text: 'The player restored power before leaving the station.',
};

async function waitForGame(page: import('@playwright/test').Page) {
  await page.goto('/aftersign/');
  await page.waitForFunction(() => Boolean(window.__game?.getSnapshot));
}

test('served page preserves story state and NPC memory across save/load', async ({ page }) => {
  await waitForGame(page);

  const firstSnapshot = await page.evaluate(async ({ slot, rememberedFact }) => {
    if (!window.__game?.rememberNpcFact || !window.__game.save || !window.__game.getSnapshot) {
      throw new Error('window.__game is missing story save/load test hooks');
    }

    await window.__game.rememberNpcFact('io', rememberedFact);
    await window.__game.save(slot);
    return window.__game.getSnapshot();
  }, { slot, rememberedFact });

  expect(firstSnapshot.story?.beat).toBeTruthy();
  expect(firstSnapshot.npcs?.io?.memory).toEqual(
    expect.arrayContaining([expect.objectContaining(rememberedFact)]),
  );
  expect(firstSnapshot.save?.slot).toBe(slot);
  expect(firstSnapshot.save?.updatedAt).toBeTruthy();

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__game?.load && window.__game?.getSnapshot));

  const restored = await page.evaluate(async ({ slot }) => {
    if (!window.__game?.load || !window.__game.getSnapshot || !window.__game.speakToNpc) {
      throw new Error('window.__game is missing story restore test hooks');
    }

    await window.__game.load(slot);
    const line = await window.__game.speakToNpc('io');
    return { line, snapshot: window.__game.getSnapshot() };
  }, { slot });

  expect(restored.snapshot.story?.beat).toBe(firstSnapshot.story?.beat);
  expect(restored.snapshot.npcs?.io?.memory).toEqual(
    expect.arrayContaining([expect.objectContaining(rememberedFact)]),
  );
  expect(restored.line).toContain('restored power');
  expect(restored.snapshot.npcs?.io?.lastLine).toBe(restored.line);
  expect(restored.snapshot.npcs?.io?.lastLineMemoryRefs).toContain(rememberedFact.id);
});
