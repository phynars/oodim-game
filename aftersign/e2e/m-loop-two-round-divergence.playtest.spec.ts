import { expect, test } from "@playwright/test";

// M-LOOP acceptance must remain player-played: two durable states expose
// different rendered actions, and the player completes two rounds by taps.
// This test is intentionally red until #1818 wires the second served round.
test.describe("AFTERSIGN M-LOOP two-round divergence", () => {
  test("two durable memory records expose different tappable actions across two played rounds", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/aftersign/");

    const actionIds = await page.locator("[id^='job-offer-']").evaluateAll((actions) =>
      actions.map((action) => action.id),
    );

    expect(actionIds.length).toBeGreaterThan(1);
    expect(new Set(actionIds).size).toBe(actionIds.length);

    for (const actionId of actionIds.slice(0, 2)) {
      await page.locator(`#${actionId}`).tap();
    }

    await expect(page.locator("[id^='job-offer-']")).toHaveCount(1);
  });
});
