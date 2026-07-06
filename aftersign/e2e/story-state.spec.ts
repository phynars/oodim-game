import { expect, test } from '@playwright/test';

type AftersignSnapshot = {
  slug: string;
  scene: string;
  storyBeat: string;
  packet: {
    delivered: boolean;
    route: string | null;
    deliveredAt: string | null;
  };
  npcMemory: {
    io: {
      remembersPriorPacket: boolean;
      line: string;
    };
  };
  save: unknown;
};

declare global {
  interface Window {
    __game: {
      getSnapshot: () => AftersignSnapshot;
      deliverPacket: () => void;
      resetSliceSave: () => void;
    };
  }
}

const getSnapshot = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__game.getSnapshot());

test.describe('AFTERSIGN story/state contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__game.resetSliceSave());
  });

  test('publishes the first kiosk scene through window.__game', async ({ page }) => {
    const snapshot = await getSnapshot(page);

    expect(snapshot.slug).toBe('aftersign');
    expect(snapshot.scene).toBe('io-kiosk-rainline');
    expect(snapshot.storyBeat).toBe('arrive-at-kiosk');
    expect(snapshot.packet.delivered).toBe(false);
    expect(snapshot.npcMemory.io.remembersPriorPacket).toBe(false);
    expect(snapshot.npcMemory.io.line).toContain('Touch the kiosk');
  });

  test('remembers a delivered packet after reload', async ({ page }) => {
    await page.evaluate(() => window.__game.deliverPacket());

    const delivered = await getSnapshot(page);
    expect(delivered.packet.delivered).toBe(true);
    expect(delivered.packet.route).toBe('blue-rainline');

    await page.reload();

    const remembered = await getSnapshot(page);
    expect(remembered.storyBeat).toBe('io-remembers-packet');
    expect(remembered.packet.delivered).toBe(true);
    expect(remembered.packet.route).toBe('blue-rainline');
    expect(remembered.npcMemory.io.remembersPriorPacket).toBe(true);
    expect(remembered.npcMemory.io.line).toContain('I remember you');
    expect(remembered.npcMemory.io.line).toContain('blue-rainline');
  });
});
