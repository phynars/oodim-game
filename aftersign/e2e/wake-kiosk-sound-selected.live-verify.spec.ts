import { expect, test } from "@playwright/test";

test("Wake kiosk sound tap retains its selected treatment through a render frame", async ({ page }) => {
  // #2986: on game.oodim.com /player-memory answers slowly, so the visible
  // sound control is tapped while boot still awaits it. Hold that response
  // to replay the deployed timing: the tap must still reach the music control.
  await page.route("**/player-memory", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.continue();
  });
  await page.goto("/aftersign/", { waitUntil: "commit" });

  const soundButton = page.locator("#soundButton");
  await expect(soundButton).toBeVisible();
  await expect(soundButton).toHaveText("Enable music");
  await expect(soundButton).not.toHaveAttribute("data-kiosk-sound-selected");
  await soundButton.click();
  // The label names the next music action; the warm tile is the receipt.
  await expect(soundButton).toHaveText("Mute music");

  await expect(soundButton).not.toHaveAttribute("aria-pressed", "true");
  await expect(soundButton).toHaveAttribute("data-kiosk-sound-selected", "true");
  await expect(soundButton).toHaveCSS("background-color", "rgb(92, 58, 30)");
  await expect(soundButton).toHaveCSS("border-top-color", "rgb(255, 214, 151)");

  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await expect(soundButton).not.toHaveAttribute("aria-pressed", "true");
  await expect(soundButton).toHaveAttribute("data-kiosk-sound-selected", "true");
});
