import { expect, test } from "@playwright/test";

test.describe("M-LOOP durable-memory job-offer divergence", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("plays two served rounds per durable record through rendered job controls", async ({ page }) => {
    const memories = [
      { id: "mloop-courier", tags: ["courier", "reliable"] },
      { id: "mloop-salvager", tags: ["salvager", "resourceful"] },
    ];
    const offeredActionSets: string[][] = [];

    for (const memory of memories) {
      await page.addInitScript((seed) => {
        localStorage.setItem("aftersign-durable-memory", JSON.stringify(seed));
      }, memory);
      await page.goto("/");

      const offeredJobs = page.locator("#offeredJobs");
      await expect(offeredJobs).toHaveAttribute("data-mloop-divergence-memory", memory.id);

      for (let round = 0; round < 2; round += 1) {
        const actions = offeredJobs.locator("button[data-offered-job-id]");
        await expect(actions.first()).toBeVisible();
        if (round === 0) {
          offeredActionSets.push(await actions.evaluateAll((buttons) =>
            buttons.map((button) => button.getAttribute("data-offered-job-id") ?? ""),
          ));
        }
        await actions.first().click();
        await expect(actions.first()).toBeVisible();
      }
    }

    expect(offeredActionSets).toHaveLength(2);
    expect(offeredActionSets[0]).not.toEqual(offeredActionSets[1]);
  });
});
