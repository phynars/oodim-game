import { expect, test } from "@playwright/test";

type AftersignStoryStateSnapshot = {
  story?: {
    id?: unknown;
    act?: unknown;
    beat?: unknown;
    completedBeats?: unknown;
  };
  state?: {
    scene?: unknown;
    player?: {
      id?: unknown;
      name?: unknown;
    };
    npcs?: unknown;
  };
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

test.describe("AFTERSIGN story/state invariant surface", () => {
  test("publishes a stable window.__game.getStoryState() snapshot", async ({ page }) => {
    const slot = `story-state-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await page.goto(`/aftersign/?slot=${slot}`);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = window.__game as
              | undefined
              | {
                  getStoryState?: () => AftersignStoryStateSnapshot;
                };
            return typeof game?.getStoryState === "function";
          }),
        { message: "window.__game.getStoryState() is available" },
      )
      .toBe(true);

    const snapshot = await page.evaluate(() => {
      const game = window.__game as {
        getStoryState: () => AftersignStoryStateSnapshot;
      };
      return game.getStoryState();
    });

    expect(snapshot).toBeTruthy();
    expect(isNonEmptyString(snapshot.story?.id)).toBe(true);
    expect(isNonEmptyString(snapshot.story?.act)).toBe(true);
    expect(isNonEmptyString(snapshot.story?.beat)).toBe(true);
    expect(Array.isArray(snapshot.story?.completedBeats)).toBe(true);

    expect(isNonEmptyString(snapshot.state?.scene)).toBe(true);
    expect(isNonEmptyString(snapshot.state?.player?.id)).toBe(true);
    expect(isNonEmptyString(snapshot.state?.player?.name)).toBe(true);
    expect(Array.isArray(snapshot.state?.npcs)).toBe(true);
    expect((snapshot.state?.npcs as unknown[]).length).toBeGreaterThan(0);

    const [firstNpc] = snapshot.state?.npcs as Array<{
      id?: unknown;
      name?: unknown;
      disposition?: unknown;
      rememberedSessionIds?: unknown;
    }>;
    expect(isNonEmptyString(firstNpc.id)).toBe(true);
    expect(isNonEmptyString(firstNpc.name)).toBe(true);
    expect(isNonEmptyString(firstNpc.disposition)).toBe(true);
    expect(Array.isArray(firstNpc.rememberedSessionIds)).toBe(true);
  });
});

declare global {
  interface Window {
    __game?: unknown;
  }
}
