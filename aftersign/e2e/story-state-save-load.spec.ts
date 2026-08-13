import { expect, test } from '@playwright/test';

type GameSnapshot = {
  story?: {
    activeBeat?: string;
    sealedDeliveryPacket?: {
      id?: string;
      delivered?: boolean;
    };
  };
  npcMemory?: {
    io?: {
      playerName?: string;
      rememberedPacketId?: string;
      priorSessionReference?: string;
    };
  };
};

test.describe('Aftersign story state save/load surface', () => {
  test('preserves story beat, delivery packet, and Io memory across reload + explicit load', async ({ page }) => {
    await page.goto('/aftersign/');

    const initial = await page.evaluate(async () => {
      const game = (window as typeof window & {
        __game?: {
          getSnapshot?: () => GameSnapshot | Promise<GameSnapshot>;
          save?: () => unknown | Promise<unknown>;
          load?: () => unknown | Promise<unknown>;
        };
      }).__game;

      if (!game?.getSnapshot || !game.save || !game.load) {
        throw new Error('window.__game must expose getSnapshot(), save(), and load() for the story-state harness');
      }

      await game.save();
      return game.getSnapshot();
    });

    expect(initial.story?.activeBeat).toBeTruthy();
    expect(initial.story?.sealedDeliveryPacket?.id).toBeTruthy();
    expect(initial.story?.sealedDeliveryPacket?.delivered).toBe(true);
    expect(initial.npcMemory?.io?.playerName).toBeTruthy();
    expect(initial.npcMemory?.io?.rememberedPacketId).toBe(initial.story?.sealedDeliveryPacket?.id);
    expect(initial.npcMemory?.io?.priorSessionReference).toContain(initial.story?.sealedDeliveryPacket?.id);

    await page.reload();

    const restored = await page.evaluate(async () => {
      const game = (window as typeof window & {
        __game?: {
          getSnapshot?: () => GameSnapshot | Promise<GameSnapshot>;
          load?: () => unknown | Promise<unknown>;
        };
      }).__game;

      if (!game?.getSnapshot || !game.load) {
        throw new Error('window.__game must expose getSnapshot() and load() after reload');
      }

      await game.load();
      return game.getSnapshot();
    });

    expect(restored.story?.activeBeat).toBe(initial.story?.activeBeat);
    expect(restored.story?.sealedDeliveryPacket?.id).toBe(initial.story?.sealedDeliveryPacket?.id);
    expect(restored.story?.sealedDeliveryPacket?.delivered).toBe(true);
    expect(restored.npcMemory?.io?.playerName).toBe(initial.npcMemory?.io?.playerName);
    expect(restored.npcMemory?.io?.rememberedPacketId).toBe(initial.story?.sealedDeliveryPacket?.id);
    expect(restored.npcMemory?.io?.priorSessionReference).toContain(initial.story?.sealedDeliveryPacket?.id);
  });
});
