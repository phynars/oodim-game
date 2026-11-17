import { expect, test, type Browser, type Page, type Route } from "@playwright/test";
import { IO_DEFAULT_OFFER_LINE } from "../src/ioDefaultOfferCopy.js";

// Stale blue-seal reminder (PR #2867). A legacy save that already
// committed a sealed delivery but predates the Io-memory delivery-outcome
// fact used to fall back to IO_DEFAULT_OFFER_LINE ("Keep it sealed if you
// want the city to trust you…") at the next packet-offered beat — Io
// re-asking a decision the courier already made. This spec seeds exactly
// that save shape, reloads in a fresh browser context, and pins the
// post-decision line. A fresh slot (pre-delivery) must still hear the
// default offer line.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;
const SAVE_ENDPOINT_BASE = "/aftersign/save";
const SEALED_FOLLOW_UP_LINE =
  "You kept the blue seal closed. The city noticed; choose the work you can carry next.";

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({ timeout: WAIT_MS });
}

// Player-memory is per-player; serve an empty record so the seeded legacy
// save (no delivery-outcome fact) is the only memory source.
async function emptyPlayerMemory(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === "/player-memory",
    async (route: Route) => {
      await route.fulfill({ status: 200, json: { facts: {} } });
    },
  );
}

async function phoneContext(browser: Browser) {
  return browser.newContext({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });
}

test.describe("AFTERSIGN stale blue-seal reminder", () => {
  test("a legacy sealed save without Io's memory fact does not repeat the blue-seal reminder", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    const slot = `stale-seal-legacy-${stamp}`;
    // Worker mode mints a per-context player id; pin one so the seed and
    // the returning context address the same save.
    const playerId = `stale-seal-${stamp}`;
    const url = `/aftersign/index.html?slot=${slot}&player=${playerId}`;

    const seed = await phoneContext(browser);
    try {
      const seedPage = await seed.newPage();
      await emptyPlayerMemory(seedPage);
      await seedPage.goto(url, { waitUntil: "load" });
      await waitForBeat(seedPage, "packet-offered");
      const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(playerId)}/${encodeURIComponent(slot)}`;
      const put = await seedPage.request.put(saveUrl, {
        data: {
          payload: {
            // Seeded at io-next-job (a beat that speaks its own line, so the
            // returning-session boot override stays out of the way); the
            // player then taps into the next offer.
            beat: "io-next-job",
            packet: { delivered: true, route: "kiosk", sealed: true, deliveredAt: 1 },
            delivery: { id: "blue-packet", outcome: "sealed" },
            player: {
              id: playerId,
              name: null,
              flags: { io_intro_seen: true },
              returnReason: "blunt",
            },
            memory: [],
            save: { revision: 1 },
          },
        },
        headers: { "content-type": "application/json" },
      });
      expect(put.ok(), `seed PUT must succeed (HTTP ${put.status()})`).toBe(true);
    } finally {
      await seed.close();
    }

    const returning = await phoneContext(browser);
    try {
      const page = await returning.newPage();
      await emptyPlayerMemory(page);
      await page.goto(url, { waitUntil: "load" });
      await waitForBeat(page, "io-next-job");
      const deliverNext = page.locator('button[data-choice-id="deliver-packet"]:not([disabled])');
      await expect(deliverNext).toBeVisible({ timeout: WAIT_MS });
      await deliverNext.tap();
      await waitForBeat(page, "packet-offered");
      const line = page.locator("#line");
      await expect(line).toContainText(SEALED_FOLLOW_UP_LINE, { timeout: WAIT_MS });
      await expect(line).not.toContainText(IO_DEFAULT_OFFER_LINE);
    } finally {
      await returning.close();
    }
  });

  test("a fresh slot before any delivery still hears Io's default offer line", async ({ browser }) => {
    test.setTimeout(120_000);
    const fresh = await phoneContext(browser);
    try {
      const page = await fresh.newPage();
      await emptyPlayerMemory(page);
      await page.goto(`/aftersign/index.html?slot=stale-seal-fresh-${Date.now()}`, { waitUntil: "load" });
      await waitForBeat(page, "packet-offered");
      const line = page.locator("#line");
      await expect(line).toContainText(IO_DEFAULT_OFFER_LINE, { timeout: WAIT_MS });
      await expect(line).not.toContainText(SEALED_FOLLOW_UP_LINE);
    } finally {
      await fresh.close();
    }
  });
});
