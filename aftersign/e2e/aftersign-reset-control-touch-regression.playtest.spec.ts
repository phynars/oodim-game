import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

async function reachPacketChoice(page: Page): Promise<void> {
  await page.goto(`/aftersign/?slot=reset-touch-${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
  await expect(page.locator('[data-beat-id="packet-offered"]')).toBeVisible({
    timeout: WAIT_MS,
  });
  const offered = page.locator('button[data-offered-job-id="job-safe-delivery"]');
  await expect(offered).toBeVisible({ timeout: WAIT_MS });
  await offered.tap();
  await page.locator("#packetButton").tap();
  await expect(page.locator('[data-beat-id="packet-choice"]')).toBeVisible({
    timeout: WAIT_MS,
  });
}

test.describe("AFTERSIGN reset control touch regression", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("Start fresh receives a touch pointer and returns the player to the offered packet", async ({ page }) => {
    await reachPacketChoice(page);

    const reset = page.locator(".slice-save-controls #resetButton");
    await expect(reset).toBeVisible({ timeout: WAIT_MS });
    await reset.evaluate((button) => {
      button.addEventListener(
        "pointerdown",
        (event) => button.setAttribute("data-last-pointer-type", event.pointerType),
        { once: true },
      );
    });

    await reset.tap();
    await expect(reset).toHaveAttribute("data-last-pointer-type", "touch");
    await expect(page.locator('[data-beat-id="packet-offered"]')).toBeVisible({
      timeout: WAIT_MS,
    });
  });
});
