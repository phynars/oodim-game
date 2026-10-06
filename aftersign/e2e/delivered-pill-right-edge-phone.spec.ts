import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("delivered phone pills own their visible right edge", async ({ page }) => {
  await page.goto(`/aftersign/?slot=delivered-pill-edge-${Date.now()}`);
  await expect.poll(() => page.evaluate(() => window.__game?.scene?.beat)).toBe("packet-offered");

  const deliver = page.getByRole("button", { name: "Deliver packet", exact: true });
  await expect(deliver).toBeVisible();
  await deliver.tap();

  await expect.poll(() => page.evaluate(() => window.__game?.scene?.beat)).toBe("io-return-recognition");
  await expect(page.locator(".aftersign-scene-transition")).toHaveCount(0);

  await expect
    .poll(() =>
      page.locator("#routeChoice button").evaluateAll((buttons) =>
        buttons.every((button) => {
          const box = button.getBoundingClientRect();
          const hit = document.elementFromPoint(box.right - 1, box.top + box.height / 2);
          return hit === button || hit?.closest("button") === button;
        }),
      ),
    )
    .toBe(true);

  await expect(page).toHaveScreenshot("delivered-phone-pills.png");
});
