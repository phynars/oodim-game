import { expect, test, type Page } from "@playwright/test";

// Phone-played regression guard: the first visible packet offer must advance
// through a real touch tap, never through the window.__game input bridge.
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

type Snapshot = { scene?: { ready?: boolean; beat?: string } };

declare global {
  interface Window {
    __game?: {
      scene?: { ready?: boolean; beat?: string };
      getSnapshot?: () => Snapshot;
    };
  }
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => Boolean(window.__game?.scene?.ready && window.__game?.getSnapshot),
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => window.__game?.getSnapshot?.().scene?.beat ?? null),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

test.describe("AFTERSIGN packet offer touch playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone tap on the visible packet offer reaches the deliberate packet choice", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const slot = `packet-offer-touch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    const packetOffer = page.locator("#packetButton");
    await expect(packetOffer).toBeVisible({ timeout: WAIT_MS });
    await expect(packetOffer).toBeEnabled({ timeout: WAIT_MS });
    await packetOffer.tap();

    await waitForBeat(page, "packet-choice");
  });
});
