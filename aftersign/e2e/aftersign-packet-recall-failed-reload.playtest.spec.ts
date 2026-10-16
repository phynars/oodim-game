import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN failed-route recall must survive a real browser reload after the
// player has re-entered the packet flow. This is deliberately a served-page
// contract: the save is seeded through the authoritative endpoint, player
// movement is taps only, and window.__game is not used to drive the run.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
const PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function seedFailedRouteRiskSave(page: Page, slot: string): Promise<void> {
  const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(PLAYER_ID)}/${encodeURIComponent(slot)}`;
  const payload = {
    beat: "packet-offered",
    packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
    delivery: { outcome: "unknown" },
    player: {
      id: PLAYER_ID,
      name: null,
      flags: { io_intro_seen: true },
      routeRisk: { lastRoute: "safe", succeeded: false },
    },
    memory: [],
    save: { revision: 1 },
  };

  const put = await page.request.put(saveUrl, {
    data: { payload },
    headers: { "content-type": "application/json" },
  });
  expect(put.ok(), `seed PUT must succeed (HTTP ${put.status()})`).toBe(true);

  const get = await page.request.get(saveUrl, {
    headers: { accept: "application/json" },
  });
  expect(get.ok(), `seed GET must succeed (HTTP ${get.status()})`).toBe(true);
  const saved = (await get.json()) as {
    payload?: { player?: { routeRisk?: { succeeded?: boolean } } } | null;
  };
  expect(saved.payload?.player?.routeRisk?.succeeded).toBe(false);
}

test.describe("AFTERSIGN failed-route recall reload (phone tap)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("failed-route repair offer remains after a hard reload in packet choice", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `packet-recall-failed-reload-${Date.now()}`;

    await seedFailedRouteRiskSave(page, slot);
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForBeat(page, "packet-offered");

    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    await page.reload({ waitUntil: "load" });
    await waitForBeat(page, "packet-choice");

    const tray = page.locator("#routeRiskChoice");
    await expect(
      tray.locator(
        'button[data-aftersign-tap-choice="repair-the-loss"]:not([disabled])',
      ),
      "failed-route recovery offer must survive a hard reload",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      tray.locator('button[data-aftersign-tap-choice="take-the-shortcut"]'),
      "succeeded-route offer must not replace failed-route recovery after reload",
    ).toHaveCount(0);
  });
});
