import { expect, test, type Browser, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 30_000;
const PLAYER_ID = `start-screen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

declare global {
  interface Window {
    __game?: { scene?: { ready?: boolean } };
  }
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.scene?.ready === true, undefined, {
    timeout: WAIT_MS,
  });
}

async function seedSave(page: Page, slot: string): Promise<void> {
  const response = await page.request.put(
    `/aftersign/save/${encodeURIComponent(PLAYER_ID)}/${encodeURIComponent(slot)}`,
    {
      data: {
        payload: {
          beat: "packet-offered",
          packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
          delivery: { outcome: "unknown" },
          player: { id: PLAYER_ID, name: null, flags: { io_intro_seen: true } },
          memory: [],
          save: { revision: 1 },
        },
      },
      headers: { "content-type": "application/json" },
    },
  );
  expect(response.ok()).toBe(true);
}

test.describe("AFTERSIGN start screen (#2840)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a fresh player sees the Io delivery intro and begins through its only visible control", async ({
    page,
  }) => {
    await page.goto(`/aftersign/?start=1&slot=fresh-start-${Date.now()}`, { waitUntil: "load" });
    await waitForReady(page);

    const startScreen = page.locator("#startScreen");
    await expect(startScreen).toBeVisible();
    await expect(startScreen).toContainText("AFTERSIGN");
    await expect(startScreen).toContainText(/Io needs a courier.*sealed packet/i);
    await expect(page.locator("#beginButton")).toHaveText("Begin delivery");
    await expect(page.locator("#packetButton")).not.toBeVisible();
    await expect(page.locator("#soundButton")).not.toBeVisible();
    await expect(page.locator("#resetButton")).not.toBeVisible();

    await page.locator("#beginButton").tap();
    await expect(startScreen).toBeHidden();
    await expect(page.locator("#packetButton")).toBeVisible();
  });

  test("a restored slot identifies the continuing session before its visible continue tap", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const slot = `continuing-start-${Date.now()}`;
    const seedContext = await browser.newContext();
    try {
      await seedSave(await seedContext.newPage(), slot);
    } finally {
      await seedContext.close();
    }

    const context = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    try {
      const page = await context.newPage();
      await page.goto(`/aftersign/?start=1&slot=${slot}&player=${PLAYER_ID}`, { waitUntil: "load" });
      await waitForReady(page);

      const startScreen = page.locator("#startScreen");
      await expect(startScreen).toContainText("Continuing — Io remembers you");
      await expect(startScreen).not.toContainText("Io needs a courier");
      await expect(page.locator("#beginButton")).toHaveText("Continue delivery");
      await expect(page.locator("#packetButton")).not.toBeVisible();

      await page.locator("#beginButton").tap();
      await expect(startScreen).toBeHidden();
      await expect(page.locator("#packetButton")).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
