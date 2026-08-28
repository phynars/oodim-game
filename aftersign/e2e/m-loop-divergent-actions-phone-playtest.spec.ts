import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

const ACTION_SELECTORS = [
  "#deliverButton",
  "#acknowledgeRouteButton",
  "#skipRouteButton",
] as const;

type ActionSelector = (typeof ACTION_SELECTORS)[number];

type FlagshipReadOnlySnapshot = {
  scene: { ready?: boolean; beat?: string };
  packet: { delivered: boolean; sealed: boolean };
  delivery: { outcome: string };
  npcs: {
    io: {
      memory: Array<{ id?: string; object?: string; action?: string }>;
    };
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean; beat?: string };
      getSnapshot?: () => FlagshipReadOnlySnapshot;
    };
  }
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function snapshot(page: Page): Promise<FlagshipReadOnlySnapshot> {
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function tapVisibleEnabled(page: Page, selector: ActionSelector): Promise<void> {
  const action = page.locator(selector);
  await expect(action).toBeVisible();
  await expect(action).toBeEnabled();
  await action.tap();
}

async function enabledActionSignature(page: Page): Promise<string[]> {
  const signature: string[] = [];

  for (const selector of ACTION_SELECTORS) {
    const action = page.locator(selector);
    if ((await action.isVisible()) && (await action.isEnabled())) {
      signature.push(selector);
    }
  }

  return signature;
}

async function startFreshSlot(page: Page, prefix: string): Promise<void> {
  const slot = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);
}

async function deliverByTapsOnly(page: Page): Promise<void> {
  await tapVisibleEnabled(page, "#deliverButton");
  await expect
    .poll(async () => (await snapshot(page)).packet.delivered, { timeout: WAIT_MS })
    .toBe(true);
}

test.describe("AFTERSIGN M-LOOP divergent actions phone playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("two played save-states with different memory records expose different tappable actions", async ({ page }) => {
    await startFreshSlot(page, "m-loop-safe-route");
    await deliverByTapsOnly(page);
    const safeSnapshot = await snapshot(page);
    expect(safeSnapshot.npcs.io.memory.length).toBeGreaterThan(0);

    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    const safeActions = await enabledActionSignature(page);

    await startFreshSlot(page, "m-loop-risk-route");
    await deliverByTapsOnly(page);

    // M-LOOP requires memory to matter mechanically. The second save-state
    // must be seeded by a real, rendered player action, not by mutating
    // window.__game. If this tap is impossible, the served page has no
    // player-reachable route-risk branch yet.
    await tapVisibleEnabled(page, "#acknowledgeRouteButton");

    const riskSnapshot = await snapshot(page);
    expect(riskSnapshot.npcs.io.memory.length).toBeGreaterThan(0);

    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    const riskActions = await enabledActionSignature(page);

    expect(riskSnapshot.npcs.io.memory).not.toEqual(safeSnapshot.npcs.io.memory);
    expect(riskActions).not.toEqual(safeActions);
  });
});
