import { expect, test } from "@playwright/test";

test.describe("AFTERSIGN phone 390×844 regression", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps offer words whole and response dialogue singular", async ({ page }) => {
    await page.goto("/aftersign/?slot=phone-390-layout-regression");
    const offers = page.locator("#offeredJobs button");
    await expect(offers.first()).toBeVisible();
    await expect(offers.first()).toHaveCSS("white-space", "nowrap");
    await expect(offers.first()).toHaveJSProperty("scrollWidth", await offers.first().evaluate((node) => node.clientWidth));

    // Real taps take the player through the visible packet, Deliver, and
    // return controls to the second-packet response.
    await page.locator("#packetButton").click();
    await page.locator("#deliverButton").click();
    await page.locator("#deliverButton").click();
    await expect(page.locator("#skipRouteButton")).toHaveText("Evasive return");
    await page.waitForTimeout(250);
    await page.locator("#skipRouteButton").click();
    await page.locator("#deliverButton").click();
    await page.locator("#skipRouteButton").click();

    const dialogue = page.locator("#line");
    const response = (await dialogue.textContent())?.trim() ?? "";
    expect(response).not.toBe("");
    await expect(page.locator("#ioSecondPacketPointer")).toHaveCount(0);
  });

  test("keeps controls inside and uncovered after Deliver", async ({ page }) => {
    await page.goto("/aftersign/?slot=phone-390-controls");
    await page.locator("#packetButton").click();
    await page.locator("#deliverButton").click();
    await expect(page.locator("#deliverButton")).toHaveText("Return to Io");

    const controls = page.locator("button:visible");
    for (let index = 0; index < await controls.count(); index += 1) {
      const control = controls.nth(index);
      const box = await control.boundingBox();
      expect(box, `visible control ${index} has a box`).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
      const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.id ?? null, {
        x: box!.x + box!.width - 1,
        y: box!.y + box!.height / 2,
      });
      await expect(control).toHaveAttribute("id", hit ?? "__covered__");
    }
  });
});
