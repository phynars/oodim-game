import { test, expect, type Page } from "@playwright/test";

import { type FlagshipGameSurface } from "../../e2e-shared/flagshipStoryStateContract";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: FlagshipGameSurface;
  }
}

async function readSurface(page: Page): Promise<FlagshipGameSurface> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
  return page.evaluate(() => window.__game as FlagshipGameSurface);
}

async function waitForStoryIdle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__game?.input?.waitForStoryIdle === "function",
    undefined,
    { timeout: WAIT_MS },
  );
  await page.evaluate(() => window.__game!.input.waitForStoryIdle());
}

test.describe("AFTERSIGN phase 2 input/delivery harness contract", () => {
  test("sealed choice exposes delivery outcome and story-idle helper", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(`/aftersign/?slot=flagship-phase2-${Date.now()}`, { waitUntil: "load" });
    const initial = await readSurface(page);

    expect(initial.delivery.outcome).toBe("unknown");

    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await waitForStoryIdle(page);
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForStoryIdle(page);

    const delivered = await readSurface(page);
    expect(delivered.delivery.outcome).toBe("sealed");
    expect(delivered.scene.beat).toBe("packet-delivered");
  });
});
