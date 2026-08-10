import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __game?: {
      scene: { beat: string };
      delivery: { outcome: string };
      npcs: {
        io: {
          lastLine?: string | null;
          lastLineMemoryRefs?: string[];
          memory: Array<{ id?: string; kind?: string; object?: string }>;
        };
      };
      input: {
        choose: (choiceId: string) => void | Promise<void>;
        forceSave: () => void | Promise<void>;
        waitForStoryIdle: () => void | Promise<void>;
      };
      getSnapshot: () => {
        scene: { beat: string };
        delivery: { outcome: string };
        npcs: {
          io: {
            lastLine?: string | null;
            lastLineMemoryRefs?: string[];
            memory: Array<{ id?: string; kind?: string; object?: string }>;
          };
        };
      };
      resetSliceSave?: () => void | Promise<void>;
    };
  }
}

const WAIT_MS = 10_000;

async function waitForSurface(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof window.__game?.getSnapshot === "function" &&
      typeof window.__game?.input?.choose === "function" &&
      typeof window.__game?.input?.forceSave === "function" &&
      typeof window.__game?.input?.waitForStoryIdle === "function",
    undefined,
    { timeout: WAIT_MS },
  );
}

async function idle(page: Page): Promise<void> {
  await page.evaluate(() => window.__game!.input.waitForStoryIdle());
}

test("Io references a prior-session memory fact after a real page reload", async ({ page }) => {
  const slotKey = `io-prior-session-hard-reload-${Date.now()}-${test.info().workerIndex}`;

  await page.goto(`/aftersign/?slot=${slotKey}`, { waitUntil: "load" });
  await waitForSurface(page);

  await page.evaluate(() => window.__game!.resetSliceSave?.());
  await idle(page);

  await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
  await idle(page);
  await page.evaluate(() => window.__game!.input.choose("acknowledge-kiosk"));
  await idle(page);
  await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
  await idle(page);
  await page.evaluate(() => window.__game!.input.forceSave());

  const beforeReload = await page.evaluate(() => window.__game!.getSnapshot());
  const rememberedIds = beforeReload.npcs.io.memory
    .map((fact) => fact.id)
    .filter((id): id is string => typeof id === "string");
  expect(beforeReload.delivery.outcome).toBe("sealed");
  expect(rememberedIds.length).toBeGreaterThan(0);

  await page.reload({ waitUntil: "load" });
  await waitForSurface(page);
  await idle(page);
  await page.evaluate(() => window.__game!.input.choose("return-to-io"));
  await idle(page);

  const afterReload = await page.evaluate(() => window.__game!.getSnapshot());
  const referencedMemoryIds = afterReload.npcs.io.lastLineMemoryRefs ?? [];

  expect(afterReload.scene.beat).toBe("io-return-recognition");
  expect(afterReload.delivery.outcome).toBe("sealed");
  expect(afterReload.npcs.io.lastLine).toEqual(expect.any(String));
  expect(referencedMemoryIds.length).toBeGreaterThan(0);
  expect(referencedMemoryIds.every((id) => rememberedIds.includes(id))).toBe(true);
});
