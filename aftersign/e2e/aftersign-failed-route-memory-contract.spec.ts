import { expect, test, type Page } from "@playwright/test";
import {
  PACKET_RECALL_LINE_DATA_ATTR,
  PACKET_RECALL_LINE_ID,
} from "../../apps/web/src/aftersign/aftersignPacketRecallRender.ts";

// This is a DURABLE-SAVE CONTRACT, not a played acceptance spec. It seeds a
// save over HTTP, reloads the page, and asserts the recall line renders with
// the stable DOM contract. No player input is driven here — the point is the
// server→client restore surface, not an input flow. Named without `playtest`
// / `played` so `playtest-input-surface-guard.spec.ts` does not treat it as
// acceptance evidence (that guard requires a visible .tap/.click/.press).

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
const PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

type FailedRouteSave = {
  payload?: {
    player?: { routeRisk?: { lastRoute?: string; succeeded?: boolean } };
  } | null;
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

async function seedFailedRouteMemory(page: Page, slot: string): Promise<void> {
  const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(PLAYER_ID)}/${encodeURIComponent(slot)}`;
  const response = await page.request.put(saveUrl, {
    data: {
      payload: {
        beat: "packet-offered",
        packet: {
          delivered: false,
          route: null,
          sealed: true,
          deliveredAt: null,
        },
        delivery: { outcome: "unknown" },
        player: {
          id: PLAYER_ID,
          name: null,
          flags: { io_intro_seen: true },
          routeRisk: { lastRoute: "safe", succeeded: false },
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

  const saved = (await (await page.request.get(saveUrl)).json()) as FailedRouteSave;
  expect(saved.payload?.player?.routeRisk).toEqual({
    lastRoute: "safe",
    succeeded: false,
  });
}

test.describe("AFTERSIGN durable failed-route memory contract", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a server-stored failed route stamps its stable recall line ID", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `failed-route-memory-contract-${Date.now()}`;

    await seedFailedRouteMemory(page, slot);
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    const recall = page.locator(`#${PACKET_RECALL_LINE_ID}`);
    await expect(recall).toBeVisible({ timeout: WAIT_MS });
    await expect(recall).toHaveAttribute(PACKET_RECALL_LINE_DATA_ATTR, "failed");
  });
});
