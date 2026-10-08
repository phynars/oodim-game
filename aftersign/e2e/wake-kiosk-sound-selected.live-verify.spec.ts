import { expect, test } from "@playwright/test";

test("Wake kiosk sound tap retains its selected treatment through a render frame", async ({ page }) => {
  await page.goto("/aftersign/");

  const soundButton = page.locator("#soundButton");
  await expect(soundButton).toBeVisible();
  await expect(soundButton).toHaveText("Wake kiosk sound");
  await soundButton.click();

  await expect(soundButton).toHaveAttribute("aria-pressed", "true");
  await expect(soundButton).toHaveAttribute("data-kiosk-sound-selected", "true");
  await expect(soundButton).toHaveCSS("background-color", "rgb(92, 58, 30)");
  await expect(soundButton).toHaveCSS("border-top-color", "rgb(255, 214, 151)");

  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await expect(soundButton).toHaveAttribute("aria-pressed", "true");
  await expect(soundButton).toHaveAttribute("data-kiosk-sound-selected", "true");
});
