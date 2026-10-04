import { expect, test } from '@playwright/test';

const viewports = [
  { width: 390, height: 844 },
  { width: 1456, height: 839 },
];

function visibleRect(locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  });
}

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

for (const viewport of viewports) {
  test(`packet instruction clears its label at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const instruction = page.getByText('Choose before you leave. Io will remember whether the seal stayed whole');
    const packet = page.getByRole('button', { name: /blue packet/i });

    await expect(instruction).toBeVisible();
    await expect(packet).toBeVisible();
    expect(intersects(await visibleRect(instruction), await visibleRect(packet))).toBe(false);
  });
}

test('route-memory tap visibly confirms the named choice', async ({ page }) => {
  await page.goto('/');

  const choice = page.getByRole('button', { name: /acknowledge route/i });
  await expect(choice).toBeVisible();
  await choice.click();

  await expect(page.getByText(/acknowledge route/i)).toBeVisible();
});
