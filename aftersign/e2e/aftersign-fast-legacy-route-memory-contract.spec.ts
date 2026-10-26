import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  PACKET_RECALL_LINE_DATA_ATTR,
  PACKET_RECALL_LINE_ID,
} from "../../apps/web/src/aftersign/aftersignPacketRecallRender.ts";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

type LegacySave = {
  payload?: { player?: { routeRisk?: unknown } } | null;
};

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

test.describe("AFTERSIGN legacy fast-route recall", () => {
  test("a route-only legacy fast save reloads without rendering an unplayed recall", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const slot = `legacy-fast-route-${Date.now()}`;
    const seedSession = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });

    try {
      const seedPage = await seedSession.newPage();
      await seedPage.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(seedPage);
      await waitForBeat(seedPage, "packet-offered");

      const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(PLAYER_ID)}/${encodeURIComponent(slot)}`;
      const putResponse = await seedPage.request.put(saveUrl, {
        data: {
          payload: {
            beat: "packet-offered",
            packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
            delivery: { outcome: "unknown" },
            player: {
              id: PLAYER_ID,
              name: null,
              flags: { io_intro_seen: true },
              routeRisk: { lastRoute: "fast", succeeded: true },
            },
            memory: [],
            save: { revision: 1 },
          },
        },
        headers: { "content-type": "application/json" },
      });
      expect(putResponse.ok(), `seed PUT must succeed (HTTP ${putResponse.status()})`).toBe(true);
      const saved = (await (await seedPage.request.get(saveUrl)).json()) as LegacySave;
      expect(saved.payload?.player?.routeRisk).toEqual({
        lastRoute: "fast",
        succeeded: true,
      });
    } finally {
      await seedSession.close();
    }

    const returningSession = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });

    try {
      const returningPage = await returningSession.newPage();
      await returningPage.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(returningPage);
      await waitForBeat(returningPage, "packet-offered");

      const recall = returningPage.locator(`#${PACKET_RECALL_LINE_ID}`);
      await expect(recall).toHaveCount(0);
      await expect(returningPage.locator(`[${PACKET_RECALL_LINE_DATA_ATTR}]`)).toHaveCount(0);
    } finally {
      await returningSession.close();
    }
  });
});
