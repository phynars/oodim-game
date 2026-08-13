import { expect, test } from '@playwright/test';

type AftersignSnapshot = {
  story?: {
    beatId?: string;
    currentBeatId?: string;
    deliveredPacketId?: string;
    packetSealed?: boolean;
  };
  npcMemory?: {
    io?: {
      playerName?: string;
      rememberedPacketId?: string;
      references?: string[];
    };
  };
  save?: {
    id?: string;
    revision?: number;
  };
};

type AftersignGameHandle = {
  getSnapshot: () => AftersignSnapshot;
  save: () => unknown | Promise<unknown>;
  load: (payload: unknown) => unknown | Promise<unknown>;
};

declare global {
  interface Window {
    __game?: AftersignGameHandle;
  }
}

const assertSnapshotCarriesStoryMemory = (snapshot: AftersignSnapshot) => {
  const beatId = snapshot.story?.currentBeatId ?? snapshot.story?.beatId;
  expect(beatId, 'window.__game snapshot exposes the active story beat').toBeTruthy();
  expect(snapshot.story?.packetSealed, 'delivery packet is sealed before save').toBe(true);
  expect(snapshot.story?.deliveredPacketId, 'delivered packet id is exposed').toBeTruthy();

  const ioMemory = snapshot.npcMemory?.io;
  expect(ioMemory?.playerName, 'Io memory includes the player identity').toBeTruthy();
  expect(ioMemory?.rememberedPacketId, 'Io remembers the delivered packet id').toBe(
    snapshot.story?.deliveredPacketId,
  );
  expect(ioMemory?.references ?? [], 'Io can reference a prior-session event').toContain(
    snapshot.story?.deliveredPacketId,
  );
};

test('served Aftersign page preserves story beat, Io memory, and sealed delivery across save/load', async ({
  page,
}) => {
  await page.goto('/aftersign/');

  const firstSnapshot = await page.evaluate(() => {
    const game = window.__game;
    if (!game) throw new Error('window.__game is not exposed on the served Aftersign page');
    if (typeof game.getSnapshot !== 'function') throw new Error('window.__game.getSnapshot is missing');
    return game.getSnapshot();
  });

  assertSnapshotCarriesStoryMemory(firstSnapshot);

  const savedPayload = await page.evaluate(async () => {
    const game = window.__game;
    if (!game) throw new Error('window.__game is not exposed on the served Aftersign page');
    if (typeof game.save !== 'function') throw new Error('window.__game.save is missing');
    return game.save();
  });

  await page.reload();

  const reloadedSnapshot = await page.evaluate(async (payload) => {
    const game = window.__game;
    if (!game) throw new Error('window.__game is not exposed after reload');
    if (typeof game.load !== 'function') throw new Error('window.__game.load is missing');
    if (typeof game.getSnapshot !== 'function') throw new Error('window.__game.getSnapshot is missing after reload');
    await game.load(payload);
    return game.getSnapshot();
  }, savedPayload);

  assertSnapshotCarriesStoryMemory(reloadedSnapshot);

  expect(reloadedSnapshot.story?.currentBeatId ?? reloadedSnapshot.story?.beatId).toBe(
    firstSnapshot.story?.currentBeatId ?? firstSnapshot.story?.beatId,
  );
  expect(reloadedSnapshot.story?.deliveredPacketId).toBe(firstSnapshot.story?.deliveredPacketId);
  expect(reloadedSnapshot.npcMemory?.io?.playerName).toBe(firstSnapshot.npcMemory?.io?.playerName);
  expect(reloadedSnapshot.npcMemory?.io?.rememberedPacketId).toBe(firstSnapshot.story?.deliveredPacketId);
});
