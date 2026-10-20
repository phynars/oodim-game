import { expect, test } from "@playwright/test";

const WAIT_MS = 10_000;

test("a fresh player can visibly create a failed route", async ({ page }) => {
  const slot = `route-risk-failure-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );

  const jobOffer = page.locator('[id^="job-offer-"]').first();
  await expect(jobOffer).toBeVisible({ timeout: WAIT_MS });
  await jobOffer.tap();

  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toBeVisible({ timeout: WAIT_MS });
  await packetButton.tap();

  const tray = page.locator("#routeRiskChoice");
  await expect(tray).toBeVisible({ timeout: WAIT_MS });
  await tray.locator('[data-aftersign-tap-choice="take-the-shortcut"]').tap();

  const fragile = tray.locator(
    '[data-aftersign-tap-choice="carry-a-fragile-packet"]',
  );
  await expect(fragile).toBeVisible({ timeout: WAIT_MS });
  await fragile.tap();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __game?: {
                getSnapshot?: () => {
                  player?: { routeRisk?: { succeeded?: boolean } };
                };
              };
            }
          ).__game?.getSnapshot?.().player?.routeRisk?.succeeded,
      ),
    )
    .toBe(false);
});
