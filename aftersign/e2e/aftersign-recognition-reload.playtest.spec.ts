import { expect, test } from "@playwright/test";

const slot = `recognition-reload-${Date.now()}`;

async function waitForBeat(page: import("@playwright/test").Page, beat: string) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.getAttribute("data-aftersign-beat"),
      ),
    )
    .toBe(beat);
}

/**
 * Player-facing regression for the recognition save boundary. The journey is
 * intentionally taps-only; __game is never used to advance the scene.
 */
test("reload preserves Io's visible recognition beat", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

  await expect(page.locator("#packetButton")).toBeVisible();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-acknowledged");

  await expect(page.locator("#packetButton")).toBeVisible();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-delivered");

  await expect(page.locator("#packetButton")).toBeVisible();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "io-return-recognition");

  const recognition = page.locator("#dialogue");
  await expect(recognition).toBeVisible();
  const lineBeforeReload = await recognition.textContent();
  await expect(lineBeforeReload?.trim()).not.toBe("");

  await page.reload({ waitUntil: "load" });

  await waitForBeat(page, "io-return-recognition");
  await expect(recognition).toHaveText(lineBeforeReload ?? "");
  await expect(page.locator("[data-aftersign-tone-choice]")).toBeVisible();
});
