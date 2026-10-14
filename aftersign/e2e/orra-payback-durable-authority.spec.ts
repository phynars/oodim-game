import { expect, test, type Browser, type Page } from "@playwright/test";

// #2260: a server-seeded red-tag record must select its visible Orra action
// after a browser-context boundary. This deliberately does not use the
// current page's localStorage: each assertion opens a new context after the
// save endpoint confirms the record, so a local-only restore cannot pass.
const PHONE = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

type RedTagOutcome = "sealed" | "opened";

function slotFor(outcome: RedTagOutcome): string {
  return `orra-payback-durable-${outcome}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function payload(playerId: string, outcome: RedTagOutcome) {
  return {
    beat: "io-return-recognition",
    packet: {
      delivered: true,
      route: "kiosk",
      sealed: outcome === "sealed",
      deliveredAt: "2026-10-14T00:00:00.000Z",
    },
    delivery: { id: "red-tag", outcome },
    player: { id: playerId, name: null, flags: { io_intro_seen: true } },
    memory: [{
      id: `red-tag-${outcome}`,
      kind: "red-tag",
      subject: "saint-orra",
      object: outcome,
      sessionId: "server-seeded",
    }],
    save: { revision: 1 },
  };
}

async function seedRecord(
  page: Page,
  playerId: string,
  slot: string,
  outcome: RedTagOutcome,
): Promise<void> {
  const record = payload(playerId, outcome);
  const url = `/aftersign/save/${encodeURIComponent(playerId)}/${encodeURIComponent(slot)}`;
  const response = await page.request.put(url, { data: { payload: record } });
  expect(response.ok(), `seed ${outcome} record`).toBe(true);
  await expect
    .poll(async () => (await (await page.request.get(url)).json()).payload)
    .toEqual(record);
}

async function freshPhonePage(
  browser: Browser,
  playerId: string,
  slot: string,
): Promise<{ context: Awaited<ReturnType<Browser["newContext"]>>; page: Page }> {
  const context = await browser.newContext({
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(
    `/aftersign/?slot=${encodeURIComponent(slot)}&player=${encodeURIComponent(playerId)}`,
    { waitUntil: "load" },
  );
  await page.waitForFunction(
    () =>
      (window as unknown as {
        __game?: { scene?: { ready?: boolean }; save?: { authority?: string } };
      }).__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
  return { context, page };
}

test.describe("Saint Orra red-tag payback survives a fresh browser context", () => {
  test("server-seeded sealed and opened records expose distinct enabled action ids", async ({
    browser,
    page,
  }) => {
    test.setTimeout(60_000);
    const playerId = `orra-payback-authority-${Date.now()}`;
    const sealedSlot = slotFor("sealed");
    const openedSlot = slotFor("opened");
    await seedRecord(page, playerId, sealedSlot, "sealed");
    await seedRecord(page, playerId, openedSlot, "opened");

    const sealed = await freshPhonePage(browser, playerId, sealedSlot);
    const opened = await freshPhonePage(browser, playerId, openedSlot);
    try {
      const sealedAction = sealed.page.locator(
        'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])',
      );
      const openedAction = opened.page.locator(
        'button[data-orra-payback-action="leave-name-with-orra"]:not([disabled])',
      );
      await expect(sealedAction).toBeVisible({ timeout: WAIT_MS });
      await expect(openedAction).toBeVisible({ timeout: WAIT_MS });
      await expect(
        sealed.page.locator(
          'button[data-orra-payback-action="leave-name-with-orra"]:not([disabled])',
        ),
      ).toHaveCount(0);
      await expect(
        opened.page.locator(
          'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])',
        ),
      ).toHaveCount(0);
    } finally {
      await sealed.context.close();
      await opened.context.close();
    }
  });
});
