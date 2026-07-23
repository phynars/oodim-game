import { expect, test } from '@playwright/test';

type AftersignStoryStateSnapshot = {
  story: {
    id: string;
    act: string;
    beat: string;
    completedBeats: string[];
  };
  state: {
    scene: string;
    player: {
      id: string;
      name: string;
    };
    npcs: Array<{
      id: string;
      name: string;
      disposition: string;
      rememberedSessionIds: string[];
    }>;
  };
};

declare global {
  interface Window {
    __game?: {
      getStoryState?: () => AftersignStoryStateSnapshot;
    };
  }
}

const expectNonEmptyString = (value: unknown, label: string) => {
  expect(typeof value, `${label} should be a string`).toBe('string');
  expect((value as string).trim().length, `${label} should not be empty`).toBeGreaterThan(0);
};

test.describe('AFTERSIGN story/state harness contract', () => {
  test('exposes a stable window.__game story/state snapshot for narrative assertions', async ({ page }) => {
    await page.goto('/');

    const snapshot = await page.evaluate(() => window.__game?.getStoryState?.() ?? null);

    expect(snapshot, 'window.__game.getStoryState() must return a story/state snapshot').not.toBeNull();

    expectNonEmptyString(snapshot?.story.id, 'story.id');
    expectNonEmptyString(snapshot?.story.act, 'story.act');
    expectNonEmptyString(snapshot?.story.beat, 'story.beat');
    expect(Array.isArray(snapshot?.story.completedBeats), 'story.completedBeats should be an array').toBe(true);

    expectNonEmptyString(snapshot?.state.scene, 'state.scene');
    expectNonEmptyString(snapshot?.state.player.id, 'state.player.id');
    expectNonEmptyString(snapshot?.state.player.name, 'state.player.name');

    expect(Array.isArray(snapshot?.state.npcs), 'state.npcs should be an array').toBe(true);
    expect(snapshot?.state.npcs.length, 'at least one remembering NPC should be present').toBeGreaterThan(0);

    const firstNpc = snapshot?.state.npcs[0];
    expectNonEmptyString(firstNpc?.id, 'state.npcs[0].id');
    expectNonEmptyString(firstNpc?.name, 'state.npcs[0].name');
    expectNonEmptyString(firstNpc?.disposition, 'state.npcs[0].disposition');
    expect(Array.isArray(firstNpc?.rememberedSessionIds), 'state.npcs[0].rememberedSessionIds should be an array').toBe(true);
  });
});
