import { expect, test, type Page } from "@playwright/test";

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
  await expect.poll(
    () => page.evaluate(() => window.__game?.getSnapshot?.().scene.beat),
    { timeout: WAIT_MS },
  ).toBe(beat);
}

async function tap(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await expect(target).toBeEnabled();
  await target.tap();
}

test.describe("AFTERSIGN red-tag second packet", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("takes Saint Orra's red-tag route instead of replaying the blue route", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`/aftersign/?slot=red-tag-second-packet-${Date.now()}`, { waitUntil: "load" });
    await waitForReady(page);

    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-return-recognition");
    await tap(page, "#acknowledgeRouteButton");
    await waitForBeat(page, "return-tone-choice");
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-next-job");

    const secondPacket = page.locator('button[data-choice-id="accept-second-packet"]');
    await expect(secondPacket).toHaveText("Take the second packet");
    await secondPacket.tap();
    await tap(page, "#deliverButton");
    await waitForBeat(page, "packet-offered");

    await expect(page.locator("#packetButton")).toContainText(/red tag/i);
    await expect(page.locator("#offeredJobs")).toContainText(/Saint Orra/i);
    await expect(page.locator("#offeredJobs")).not.toContainText(/Blue packet/i);

    await tap(page, "#packetButton");
    await waitForBeat(page, "packet-choice");
    await tap(page, "#deliverButton");
    await waitForBeat(page, "packet-delivered");
    await expect(page.locator("#line")).not.toContainText(/blue route/i);
  });
});
