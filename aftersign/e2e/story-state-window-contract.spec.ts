import { test, expect } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type MinimalGameSurface = {
  version?: unknown;
  slug?: unknown;
  scene?: {
    id?: unknown;
    beat?: unknown;
    ready?: unknown;
  };
  story?: unknown;
  player?: unknown;
  delivery?: {
    id?: unknown;
    outcome?: unknown;
  };
  npcs?: {
    io?: {
      id?: unknown;
      present?: unknown;
      lastLine?: unknown;
      memories?: unknown;
    };
  };
  save?: {
    authority?: unknown;
    revision?: unknown;
    dirty?: unknown;
  };
  input?: unknown;
};

async function readGameSurface(page: import("@playwright/test").Page): Promise<MinimalGameSurface> {
  await page.waitForFunction(
    () => Boolean((window as unknown as { __game?: unknown }).__game),
    undefined,
    { timeout: WAIT_MS },
  );

  return page.evaluate(() => {
    const game = (window as unknown as { __game?: unknown }).__game;
    return JSON.parse(JSON.stringify(game)) as MinimalGameSurface;
  });
}

test.describe("AFTERSIGN story/state window contract", () => {
  test("publishes a serializable window.__game surface before harness-driven story input", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `story-state-window-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    const game = await readGameSurface(page);

    expect(game.version).toBe(1);
    expect(game.slug).toBe("aftersign");

    expect(game.scene).toMatchObject({
      id: expect.any(String),
      beat: expect.any(String),
      ready: true,
    });

    expect(game.delivery).toMatchObject({
      id: "blue-packet",
      outcome: expect.stringMatching(/^(unknown|pending|sealed|opened)$/),
    });

    expect(game.npcs?.io).toMatchObject({
      id: "io",
      present: true,
      memories: expect.any(Array),
    });
    expect(typeof game.npcs?.io?.lastLine === "string" || game.npcs?.io?.lastLine === null).toBe(true);

    expect(game.save).toMatchObject({
      authority: expect.any(String),
      revision: expect.any(Number),
      dirty: expect.any(Boolean),
    });

    expect(game.input).toEqual(
      expect.objectContaining({
        choose: expect.any(Function),
        forceSave: expect.any(Function),
        forceReload: expect.any(Function),
        waitForStoryIdle: expect.any(Function),
      }),
    );
  });
});
