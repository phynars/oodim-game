import { expect, test, type Browser, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 60_000;

type Snapshot = {
  npcs: { io: { memory: Array<{ object?: string }> } };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean };
      getSnapshot?: () => Snapshot;
    };
  }
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function openFreshPhoneContext(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });
  expect(await context.cookies()).toEqual([]);
  return context.newPage();
}

test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

test("a fresh session with the same durable identity receives Io's prior exchange", async ({ browser, page }) => {
  test.setTimeout(180_000);
  const slot = `durable-memory-contract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const url = `/aftersign/?slot=${slot}`;

  await page.goto(url, { waitUntil: "load" });
  await waitForReady(page);
  await expect(page.locator("#deliverButton")).toBeVisible();
  await page.locator("#deliverButton").tap();
  await expect.poll(async () => (await snapshot(page)).npcs.io.memory.length, { timeout: WAIT_MS }).toBeGreaterThan(0);

  const freshPage = await openFreshPhoneContext(browser);
  try {
    await freshPage.goto(url, { waitUntil: "load" });
    await waitForReady(freshPage);
    const recalled = await snapshot(freshPage);
    expect(recalled.npcs.io.memory.some((memory) => memory.object === "sealed")).toBe(true);
  } finally {
    await freshPage.context().close();
  }
});
