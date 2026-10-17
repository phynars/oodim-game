import { expect, test } from "@playwright/test";

test("the visible red-tag packet advances to Saint Orra's delivery beat", async ({ page }) => {
  await page.goto("/aftersign/?slot=red-tag-delivery-advances");

  // The fixture is established through the shipped UI so this remains a
  // player-path regression, not a window.__game input shortcut.
  await page.getByRole("button", { name: "Safe delivery · low risk" }).click();
  await page.locator("#packetButton").click();
  await page.getByRole("button", { name: "Deliver" }).click();
  await page.getByRole("button", { name: "Ask for next job" }).click();
  await page.getByRole("button", { name: "Deliver next packet" }).click();

  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toHaveText("Red tag — Saint Orra");
  await packetButton.click();

  await expect(page.locator("#stateReadout")).toContainText("packet-choice");
  await page.getByRole("button", { name: "Deliver" }).click();
  await expect(page.locator("#line")).toContainText("Saint Orra");
});
