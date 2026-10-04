import { expect, test } from "@playwright/test";

const viewports = [
  { width: 390, height: 844 },
  { width: 1456, height: 839 },
];

test.describe("packet-choice layout and route-memory feedback", () => {
  for (const viewport of viewports) {
    test(`keeps the packet instruction clear of its label at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/aftersign/index.html?slot=packet-choice-layout");

      await page.locator("#packetButton").click();
      const instruction = page.locator("[data-aftersign-packet-choice-affordance]");
      await expect(instruction).toBeVisible();

      const [instructionBox, packetBox] = await Promise.all([
        instruction.boundingBox(),
        page.locator("#packetButton").boundingBox(),
      ]);
      expect(instructionBox).not.toBeNull();
      expect(packetBox).not.toBeNull();
      expect(
        instructionBox!.x < packetBox!.x + packetBox!.width
          && instructionBox!.x + instructionBox!.width > packetBox!.x
          && instructionBox!.y < packetBox!.y + packetBox!.height
          && instructionBox!.y + instructionBox!.height > packetBox!.y,
      ).toBe(false);
    });
  }

  test("names the selected route-memory choice after a visible tap", async ({ page }) => {
    await page.goto("/aftersign/index.html?slot=route-memory-feedback");
    await page.locator("#packetButton").click();

    const routeChoice = page.locator("#routeRiskChoice");
    const choice = routeChoice.locator("button").first();
    const choiceName = await choice.innerText();
    await choice.click();

    await expect(routeChoice).toContainText(choiceName);
    await expect(routeChoice.locator("[data-aftersign-route-memory-confirmation]")).toHaveText(choiceName);
  });
});
