import { expect, test } from "@playwright/test";

test("a served-page pointer action is acknowledged in the window latency report", async ({ page }) => {
  await page.goto("/aftersign/");
  await page.locator("#packetButton").click();

  await expect.poll(() => page.evaluate(() =>
    window.__game?.input.getPointerToRenderLatencyReport().samples.length ?? 0,
  )).toBeGreaterThan(0);

  const report = await page.evaluate(() =>
    window.__game.input.getPointerToRenderLatencyReport(),
  );
  expect(report.latest).toBeDefined();
  expect(report.worst).toBeDefined();
  expect(report.latest).toMatchObject({
    frameBudgetMs: 16.7,
    withinBudget: expect.any(Boolean),
  });
  expect(report.latest?.renderedAtMs).toBeGreaterThanOrEqual(
    report.latest?.pointerAtMs ?? 0,
  );
});
