import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function reachPacketChoice(page: Page): Promise<void> {
  await page.goto(`/aftersign/?slot=mobile-interaction-${Date.now()}`, {
    waitUntil: "load",
  });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");

  const offered = page.locator(
    'button[data-offered-job-id="job-safe-delivery"]',
  );
  await expect(offered).toBeVisible({ timeout: WAIT_MS });
  await expect(offered).toBeEnabled({ timeout: WAIT_MS });
  await offered.tap();

  const packet = page.locator("#packetButton");
  await expect(packet).toBeVisible({ timeout: WAIT_MS });
  await expect(packet).toBeEnabled({ timeout: WAIT_MS });
  await packet.tap();
  await waitForBeat(page, "packet-choice");
}

test.describe("AFTERSIGN served mobile interaction baseline", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("phone taps keep the offered-job, route, sound, and reset controls live", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await reachPacketChoice(page);

    const acknowledge = page.locator("#acknowledgeRouteButton");
    await expect(acknowledge).toBeVisible({ timeout: WAIT_MS });
    await acknowledge.tap();
    await expect(acknowledge).toHaveAttribute("aria-pressed", "true");

    const sound = page.locator("#soundButton");
    await expect(sound).toBeVisible({ timeout: WAIT_MS });
    await sound.tap();
    await expect(sound).toHaveAttribute("aria-pressed", "true");

    const reset = page.locator(".slice-save-controls #resetButton");
    await expect(reset).toBeVisible({ timeout: WAIT_MS });
    await reset.tap();
    await waitForBeat(page, "packet-offered");
  });
});
