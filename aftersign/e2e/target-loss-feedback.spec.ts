import { expect, test } from "@playwright/test";

test("packet target loss clears the distinct reticle immediately and fades its prompt", async ({ page }) => {
  await page.goto("/aftersign/");

  const packet = page.locator("#packetButton");
  const reticle = page.locator("#reticle");
  const prompt = page.locator("#targetLossPrompt");
  await expect(packet).toBeVisible();
  await expect(reticle).toBeVisible();

  const box = await packet.boundingBox();
  if (!box) throw new Error("packet button has no pointer target");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(20);
  await page.mouse.up();

  await expect(reticle).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(prompt).toHaveCSS("opacity", "1");
  await page.waitForTimeout(105);
  await expect(prompt).toHaveCSS("opacity", "0");
});
