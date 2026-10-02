import { expect, test, type Page } from "@playwright/test";

type StorySnapshot = {
  scene?: {
    beat?: string;
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => StorySnapshot;
    };
  }
}

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

test.describe("AFTERSIGN sealed delivery story state", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("keeps packet-delivered observable at the delivery action boundary before Io recognition", async ({
    page,
  }) => {
    await page.goto(`/aftersign/?slot=sealed-delivery-story-beat-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForGame(page);

    // Real player path: the first visible kiosk control exposes delivery,
    // then the visible delivery control commits it. Do not drive state via
    // window.__game.input; that surface is observation-only in this spec.
    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible();
    await packetButton.click();

    const deliverButton = page.locator("#deliverButton");
    await expect(deliverButton).toBeVisible();
    await deliverButton.click();

    // deliverPacket sets this beat synchronously. Read it before any idle
    // helper can wait through the scheduled Io-recognition transition.
    const delivered = await page.evaluate(
      () => window.__game?.getSnapshot?.() ?? null,
    );
    expect(delivered?.scene?.beat).toBe("packet-delivered");

    // The later beat remains required; this test pins sequence rather than
    // weakening the contract to accept whichever state happens to be sampled.
    await page.waitForFunction(
      () => window.__game?.getSnapshot?.().scene?.beat === "io-return-recognition",
      undefined,
      { timeout: WAIT_MS, polling: "raf" },
    );
  });
});
