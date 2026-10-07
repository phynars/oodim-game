import { expect, test } from "@playwright/test";

// #2202 — regression probe for the phone-only delivered-beat overlay.
// This is deliberately a served-page interaction: the player taps the
// visible delivery pill, then we ask the browser what owns each visible
// pill's rightmost pixel. A harness input call cannot prove that surface.
test("390×844: delivered controls are not covered at their right edge", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/aftersign/");

  const packet = page.getByRole("button", { name: /tap the packet to preserve the seal/i });
  await expect(packet).toBeVisible();
  await packet.tap();

  const deliver = page.getByRole("button", { name: /^deliver packet$/i });
  await expect(deliver).toBeVisible();
  await deliver.tap();

  await expect(page.getByRole("button", { name: /return to io/i })).toBeVisible();
  await page.getByRole("button", { name: /return to io/i }).tap();

  const evasiveReturn = page.getByRole("button", { name: /evasive return/i });
  await expect(evasiveReturn).toBeVisible();

  const coveredPills = await page.locator("button:visible").evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const box = button.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return false;
        const owner = document.elementFromPoint(box.right - 1, box.top + box.height / 2);
        return owner !== button && !button.contains(owner);
      })
      .map((button) => ({
        label: button.getAttribute("aria-label") || button.textContent?.trim(),
      })),
  );

  expect(coveredPills).toEqual([]);
});
