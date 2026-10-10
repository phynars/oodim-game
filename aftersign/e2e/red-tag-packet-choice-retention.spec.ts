import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN red-tag retention through `packet-choice` and the following
// `io-return-recognition` beat (#2201 live-verify follow-up to #2192).
//
// The first test follows the explicit second-packet acceptance. The second
// keeps faith with the packet already visible when Io promises Saint Orra:
// a player may touch it before choosing “Take the second packet,” and that
// touch must still take the promised red-tag route (#2258).

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean };
      getSnapshot?: () => { scene: { beat: string } };
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

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.getSnapshot?.().scene.beat),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function tap(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await expect(target).toBeEnabled();
  await target.tap();
}

async function reachNextJob(page: Page): Promise<void> {
  await tap(page, "#deliverButton");
  await waitForBeat(page, "io-return-recognition");
  await tap(page, "#acknowledgeRouteButton");
  await waitForBeat(page, "return-tone-choice");
  await tap(page, "#deliverButton");
  await waitForBeat(page, "io-next-job");
}

test.describe("AFTERSIGN red-tag packet retention (#2201, #2258)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a played second packet retains Saint Orra through packet-choice and the next return", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto(`/aftersign/?slot=red-tag-retention-${Date.now()}`, { waitUntil: "load" });
    await waitForReady(page);
    await reachNextJob(page);

    const secondPacket = page.locator('button[data-choice-id="accept-second-packet"]');
    await expect(secondPacket).toHaveText("Take the second packet");
    await secondPacket.tap();
    await tap(page, "#deliverButton");
    await waitForBeat(page, "packet-offered");

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toHaveText("Red tag — Saint Orra");
    await packetButton.tap();
    await waitForBeat(page, "packet-choice");
    await expect(packetButton).toHaveText("Red tag — Saint Orra");

    const routeChoice = page.locator("#routeRiskChoice");
    await expect(routeChoice).toBeVisible();
    await expect(routeChoice).toContainText("Long way — past the kiosk");
    await expect(routeChoice).not.toContainText("Lit stair — under Io's window");

    await tap(page, "#deliverButton");
    await waitForBeat(page, "packet-delivered");
    await waitForBeat(page, "io-return-recognition");
    const lineEl = page.locator("#line");
    await expect(lineEl).toContainText(/red tag/i);
    await expect(lineEl).toContainText(/saint orra/i);
    await expect(lineEl).not.toContainText(/blue seal/i);
  });

  test("the visible packet follows Io's red-tag promise before the second-packet choice", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto(`/aftersign/?slot=red-tag-promise-${Date.now()}`, { waitUntil: "load" });
    await waitForReady(page);
    await reachNextJob(page);

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toHaveText("Red tag — Saint Orra");
    await packetButton.tap();
    await waitForBeat(page, "packet-choice");
    await expect(packetButton).toHaveText("Red tag — Saint Orra");
    await expect(page.locator("#routeRiskChoice")).toContainText("Long way — past the kiosk");
  });
});
