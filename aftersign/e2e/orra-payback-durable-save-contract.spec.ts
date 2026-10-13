import { expect, test, type Browser, type Page } from "@playwright/test";

// AFTERSIGN #2260 — failing-first durable authority contract for Saint Orra.
// Each outcome is seeded through the save endpoint, verified by GET, then
// restored only after the seeding context has closed. This deliberately does
// not drive a client-side choice: it proves the server record owns the route.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
const PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

type PaybackAction = "carry-name-to-bell-archive" | "leave-name-with-orra";

type SavedPayload = {
  payload?: {
    delivery?: { id?: string; outcome?: string };
  } | null;
};

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function seedOrraPayback(
  page: Page,
  slot: string,
  outcome: "sealed" | "opened",
): Promise<void> {
  const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(PLAYER_ID)}/${encodeURIComponent(slot)}`;
  const response = await page.request.put(saveUrl, {
    data: {
      payload: {
        beat: "io-return-recognition",
        packet: {
          delivered: true,
          route: null,
          sealed: outcome === "sealed",
          deliveredAt: Date.now(),
        },
        delivery: { id: "red-tag", outcome },
        player: {
          id: PLAYER_ID,
          name: null,
          flags: { io_intro_seen: true },
          orraPaybackAction: null,
        },
        memory: [],
        save: { revision: 1 },
      },
    },
    headers: { "content-type": "application/json" },
  });
  expect(response.ok(), `seed PUT must succeed (HTTP ${response.status()})`).toBe(true);

  const saved = (await (await page.request.get(saveUrl)).json()) as SavedPayload;
  expect(saved.payload?.delivery).toEqual({ id: "red-tag", outcome });
}

async function expectFreshContextAction(
  browser: Browser,
  slot: string,
  action: PaybackAction,
): Promise<void> {
  const returningSession = await browser.newContext({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });

  try {
    const returningPage = await returningSession.newPage();
    await returningPage.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(returningPage);

    const offered = returningPage.locator(`button[data-orra-payback-action="${action}"]`);
    await expect(offered).toBeVisible({ timeout: WAIT_MS });
    await expect(offered).toBeEnabled();
  } finally {
    await returningSession.close();
  }
}

test.describe("Saint Orra durable red-tag payback contract (#2260)", () => {
  test("server-restored sealed and opened records expose distinct enabled payback action ids in fresh browser sessions", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    test.setTimeout(COLD_START_MS);

    const records = [
      { outcome: "sealed" as const, action: "carry-name-to-bell-archive" as const },
      { outcome: "opened" as const, action: "leave-name-with-orra" as const },
    ];

    for (const record of records) {
      const slot = `orra-durable-${record.outcome}-${Date.now()}`;
      const seedingSession = await browser.newContext({
        viewport: PHONE_VIEWPORT,
        hasTouch: true,
        isMobile: true,
      });
      try {
        await seedOrraPayback(await seedingSession.newPage(), slot, record.outcome);
      } finally {
        await seedingSession.close();
      }
      await expectFreshContextAction(browser, slot, record.action);
    }
  });
});
