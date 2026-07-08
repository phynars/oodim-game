import { expect, test } from "@playwright/test";

type MemoryFact = {
  id: string;
};

type GameSurface = {
  version: number;
  io: {
    memory: MemoryFact[];
  };
  save: {
    revision: number;
    dirty: boolean;
  };
  input: {
    advance(): Promise<void>;
  };
};

test("durable save/load contract survives a reload", async ({ page }) => {
  await page.goto("/?slot=packet-intent-scene");
  await page.waitForFunction(() => (window as any).__game?.version === 1);

  const before = await page.evaluate(() => {
    const game = (window as any).__game as GameSurface;
    return {
      revision: game.save.revision,
      dirty: game.save.dirty,
      memoryIds: game.io.memory.map((fact) => fact.id),
    };
  });

  await page.evaluate(async () => {
    const game = (window as any).__game as GameSurface;
    await game.input.advance();
  });

  await page.waitForFunction(() => (window as any).__game?.save?.dirty === true);
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.version === 1);

  const after = await page.evaluate(() => {
    const game = (window as any).__game as GameSurface;
    return {
      revision: game.save.revision,
      dirty: game.save.dirty,
      memoryIds: game.io.memory.map((fact) => fact.id),
    };
  });

  expect(after.revision).toBeGreaterThan(before.revision);
  expect(after.dirty).toBe(false);
  expect(after.memoryIds).toEqual(before.memoryIds);
});
