import { expect, test } from "@playwright/test";

test("390×844: delivered beat leaves every visible pill unobscured", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/aftersign/?slot=phone-delivery-pill-occlusion");

  const packet = page.locator("#packetButton");
  await packet.click();
  const deliver = page.locator("#deliverButton");
  await expect(deliver).toHaveText("Deliver packet");
  await deliver.click();

  await expect(page.locator("#deliverButton")).toHaveText("Evasive return", {
    timeout: 5_000,
  });
  const occlusions = await page.locator("#routeChoice button:visible").evaluateAll((buttons) =>
    buttons.flatMap((button) => {
      const box = button.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return [];
      const hit = document.elementFromPoint(box.right - 1, box.top + box.height / 2);
      return hit === button || button.contains(hit) ? [] : [{
        label: button.textContent?.trim(),
        coveredBy: hit instanceof Element ? `${hit.tagName}.${hit.className}` : String(hit),
      }];
    }),
  );

  expect(occlusions).toEqual([]);
});
