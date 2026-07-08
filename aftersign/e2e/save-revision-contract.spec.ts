import { test, expect, Page } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type Beat = "packet-offered" | "packet-kept-sealed" | "packet-delivered";

type GameSurface = {
  version: 1;
  scene: { beat: Beat | string };
  save: { revision: number; dirty: boolean };
  input: {
    choose(choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet"): Promise<void>;
    forceSave(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

async function game(page: Page): Promise<GameSurface> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
  return page.evaluate(() => window.__game as GameSurface);
}

test.describe("AFTERSIGN save/revision durability contract", () => {
  test("revision advances only when state changed; no-op save is idempotent", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(`/aftersign/?slot=save-revision-${Date.now()}`, { waitUntil: "load" });
    await waitForBeat(page, "packet-offered");

    // Establish a clean persisted baseline first.
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-kept-sealed");

    const afterMutation = await game(page);
    expect(afterMutation.save.dirty).toBe(true);

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const afterStateSave = await game(page);

    // No new state change between saves: revision should remain stable.
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const afterNoOpSave = await game(page);
    expect(afterNoOpSave.save.revision).toBe(afterStateSave.save.revision);
    expect(afterNoOpSave.save.dirty).toBe(false);

    // A new mutation must flip dirty and require a newer persisted revision.
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    const beforeFinalSave = await game(page);
    expect(beforeFinalSave.save.dirty).toBe(true);
    expect(beforeFinalSave.save.revision).toBe(afterNoOpSave.save.revision);

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const afterFinalSave = await game(page);
    expect(afterFinalSave.save.revision).toBeGreaterThan(afterNoOpSave.save.revision);
    expect(afterFinalSave.save.dirty).toBe(false);
  });
});
