import { expect, test, type Browser, type Page } from "@playwright/test";

// Failing-first contract for #2260/#2264. This is intentionally a durable
// restore witness, not a played story spec: it writes two server saves,
// discards each browser context, and reads the enabled route identifier from
// fresh documents. The implementation must provide the documented stable
// `data-orra-route-id` attribute on its visible route button.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
const PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

type RedTagOutcome = "intact" | "opened";

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function seedOrraPayback(
  page: Page,
  slot: string,
  outcome: RedTagOutcome,
): Promise<void> {
  const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(PLAYER_ID)}/${encodeURIComponent(slot)}`;
  const response = await page.request.put(saveUrl, {
    data: {
      payload: {
        beat: "orra-payback",
        packet: {
          delivered: true,
          route: null,
          sealed: outcome === "intact",
          deliveredAt: "2026-10-13T00:00:00.000Z",
        },
        delivery: { outcome },
        player: {
          id: PLAYER_ID,
          name: null,
          flags: { io_intro_seen: true, red_tag_delivered: true },
        },
        memory: [],
        save: { revision: 1 },
      },
    },
    headers: { "content-type": "application/json" },
  });
  expect(response.ok(), `seed PUT must succeed (HTTP ${response.status()})`).toBe(
    true,
  );
}

async function restoredRouteId(
  browser: Browser,
  slot: string,
): Promise<string | null> {
  const session = await browser.newContext({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });

  try {
    const page = await session.newPage();
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    return page
      .locator("button[data-orra-route-id]:not([disabled])")
      .getAttribute("data-orra-route-id");
  } finally {
    await session.close();
  }
}

test.describe("AFTERSIGN Saint Orra durable payback contract", () => {
  test("server-restored intact and opened red tags expose different enabled route IDs in fresh sessions", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    test.setTimeout(COLD_START_MS);
    const intactSlot = `orra-payback-intact-${Date.now()}`;
    const openedSlot = `orra-payback-opened-${Date.now()}`;

    const seedSession = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    try {
      const seedPage = await seedSession.newPage();
      await seedOrraPayback(seedPage, intactSlot, "intact");
      await seedOrraPayback(seedPage, openedSlot, "opened");
    } finally {
      await seedSession.close();
    }

    const intactRouteId = await restoredRouteId(browser, intactSlot);
    const openedRouteId = await restoredRouteId(browser, openedSlot);

    expect(intactRouteId).toBeTruthy();
    expect(openedRouteId).toBeTruthy();
    expect(intactRouteId).not.toBe(openedRouteId);
  });
});
