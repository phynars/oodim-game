import { expect, test } from "@playwright/test";

test.describe("next-job board keeps the packet path unambiguous (#3144)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("does not show episode-ending vigil controls before the red-tag job is delivered", async ({ page }) => {
    const id = `next-job-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${id}&player=${id}`, { waitUntil: "load" });

    await tap(page, "Enable music");
    const packet = page.locator("#packetButton");
    await expect(packet).toBeVisible();
    await packet.tap();
    await tap(page, "I listened");
    await tap(page, "I ran early");
    await tap(page, "Lit stair");
    await tap(page, "Deliver packet");
    await page.waitForTimeout(3_000);
    await tap(page, "Blunt return");
    await tap(page, "Ask for next job");

    await expect(page.getByRole("button", { name: "Take the second packet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Deliver next packet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Light the vigil" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Spare the vigil" })).toBeHidden();

  });
});

async function tap(page: import("@playwright/test").Page, name: string): Promise<void> {
  const control = page.getByRole("button", { name: new RegExp(name) });
  await expect(control).toBeVisible();
  await control.tap();
}
