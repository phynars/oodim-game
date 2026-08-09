import { expect, test } from '@playwright/test';

/**
 * Contract: the served /aftersign/ page exposes the real
 * `AftersignWindowGameHarness` on `window.__game`, and that harness
 * preserves story beat + NPC memory across a durable-save round trip
 * spanning a page reload.
 *
 * The harness surface we exercise (verbatim from
 * `apps/web/src/aftersign/harness/bootWindowGame.ts`):
 *   - `restoreDurableSave(payload: string): void`
 *   - `meetNpc('io' | 'orra'): void`
 *   - `getStoryState(): AftersignStoryStateSnapshot`
 *   - `getRecallTrigger(): AftersignRecallTrigger | null`
 *
 * The durable-save payload format matches `AftersignDurableSaveEnvelope`
 * from `apps/web/src/aftersign/verticalSliceDurableSave.ts`.
 */

type AftersignNpcSnapshot = {
  id: 'io' | 'orra';
  disposition: 'waiting' | 'met-player' | 'recognizes-player';
  memory: {
    recognizesPlayer: boolean;
    packetOutcome?: 'sealed' | 'opened' | null;
  };
};

type AftersignStoryStateSnapshot = {
  story: {
    beat: string;
    completedBeats: string[];
  };
  state: {
    save?: { key: string; savedAtTurn: number };
    npcs: AftersignNpcSnapshot[];
  };
};

type AftersignRecallTrigger = { npcId: 'io' | 'orra'; firedAtMs: number } | null;

type AftersignWindowGameHarness = {
  version: 1;
  restoreDurableSave: (payload: string) => void;
  meetNpc: (id: 'io' | 'orra') => void;
  getStoryState: () => AftersignStoryStateSnapshot;
  getRecallTrigger: () => AftersignRecallTrigger;
};

declare global {
  interface Window {
    __game?: AftersignWindowGameHarness;
  }
}

const DURABLE_SAVE_PAYLOAD = JSON.stringify({
  key: 'aftersign.verticalSlice.v1',
  savedAtTurn: 7,
  state: {
    version: 1,
    packetOutcome: 'sealed',
    ioHasMetPlayer: true,
  },
});

async function waitForHarness(page: import('@playwright/test').Page) {
  await page.goto('/aftersign/');
  await page.waitForFunction(
    () => Boolean(window.__game && window.__game.version === 1 && window.__game.restoreDurableSave),
  );
}

function findNpc(
  snapshot: AftersignStoryStateSnapshot,
  id: 'io' | 'orra',
): AftersignNpcSnapshot | undefined {
  return snapshot.state.npcs.find((npc) => npc.id === id);
}

test('served page preserves story state and NPC memory across save/load', async ({ page }) => {
  await waitForHarness(page);

  // Baseline: fresh harness — no save, Io waiting, packet unresolved.
  const baseline = await page.evaluate(() => {
    if (!window.__game) throw new Error('window.__game not initialised');
    return window.__game.getStoryState();
  });

  expect(baseline.story.beat).toBe('packet-unresolved');
  expect(baseline.state.save).toBeUndefined();
  expect(findNpc(baseline, 'io')?.disposition).toBe('waiting');
  expect(findNpc(baseline, 'io')?.memory.recognizesPlayer).toBe(false);

  // Reload and restore a durable save representing a prior session
  // where the player sealed the packet and met Io. On the served
  // page, this proves state survives a full page reload.
  await page.reload();
  await page.waitForFunction(
    () => Boolean(window.__game && window.__game.restoreDurableSave),
  );

  const restored = await page.evaluate((payload) => {
    if (!window.__game) throw new Error('window.__game not initialised after reload');
    window.__game.restoreDurableSave(payload);
    return {
      snapshot: window.__game.getStoryState(),
      recallTriggerAfterRestore: window.__game.getRecallTrigger(),
    };
  }, DURABLE_SAVE_PAYLOAD);

  // Save envelope is surfaced.
  expect(restored.snapshot.state.save).toEqual({
    key: 'aftersign.verticalSlice.v1',
    savedAtTurn: 7,
  });

  // Io remembers meeting the player, but recognition hasn't re-fired
  // yet (recognition is a *return*-beat, triggered by meetNpc).
  const ioAfterRestore = findNpc(restored.snapshot, 'io');
  expect(ioAfterRestore?.disposition).toBe('met-player');
  expect(ioAfterRestore?.memory.recognizesPlayer).toBe(false);
  expect(ioAfterRestore?.memory.packetOutcome).toBe('sealed');

  // Packet outcome persisted through save/reload/restore.
  expect(restored.snapshot.story.completedBeats).toContain('packet-sealed');
  expect(restored.snapshot.story.completedBeats).toContain('io-first-meeting');

  // A durable-save restore is a load, not a meet — no recall trigger
  // fires until the player re-encounters the NPC.
  expect(restored.recallTriggerAfterRestore).toBeNull();

  // Meeting Io again after restore fires the recognition beat: NPC
  // memory carries into a new story beat referencing the sealed packet.
  const afterMeet = await page.evaluate(() => {
    if (!window.__game) throw new Error('window.__game not initialised');
    window.__game.meetNpc('io');
    return {
      snapshot: window.__game.getStoryState(),
      recallTrigger: window.__game.getRecallTrigger(),
    };
  });

  const ioAfterMeet = findNpc(afterMeet.snapshot, 'io');
  expect(ioAfterMeet?.disposition).toBe('recognizes-player');
  expect(ioAfterMeet?.memory.recognizesPlayer).toBe(true);
  expect(afterMeet.snapshot.story.beat).toBe('io-remembers-sealed-packet');
  expect(afterMeet.snapshot.story.completedBeats).toContain('io-remembers-sealed-packet');

  // Recognition transition (met → recognizes) fires the recall trigger.
  expect(afterMeet.recallTrigger).not.toBeNull();
  expect(afterMeet.recallTrigger?.npcId).toBe('io');
  expect(typeof afterMeet.recallTrigger?.firedAtMs).toBe('number');
});
