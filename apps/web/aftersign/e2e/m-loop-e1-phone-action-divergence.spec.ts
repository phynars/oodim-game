import { expect, test, type Page } from "@playwright/test";

const PHONE = { width: 390, height: 844 };

type SaveSeed = {
  returnTone: "warm" | "guarded";
  route: "delivered" | "skipped";
};

async function seedSave(page: Page, seed: SaveSeed) {
  await page.addInitScript((saved) => {
    localStorage.setItem("aftersign-save", JSON.stringify({ memory: saved }));
  }, seed);
}

async function playRoundByTap(page: Page) {
  await page.goto("/aftersign");

  // The production surface must expose the round's choices as visible DOM ids.
  // This gate intentionally uses no input harness: a player reaches the choice
  // through the same touch targets they see.
  await page.locator("#io").tap();
  await page.locator("#orra").tap();
}

async function offeredTappableIds(page: Page) {
  return page.locator("button[id]:visible, [role=button][id]:visible").evaluateAll((targets) =>
    targets
      .filter((target) => !(target as HTMLButtonElement).disabled)
      .map((target) => target.id)
      .sort(),
  );
}

test.describe("M-LOOP E1: memory changes the actions a phone player can take", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("divergent saves offer different visible tappable actions after a taps-only round", async ({ browser }) => {
    const saveA = await browser.newPage();
    await seedSave(saveA, { returnTone: "warm", route: "delivered" });
    await playRoundByTap(saveA);
    const snapshotA = await saveA.evaluate(() => window.__game.getSnapshot());
    const actionsA = await offeredTappableIds(saveA);

    const saveB = await browser.newPage();
    await seedSave(saveB, { returnTone: "guarded", route: "skipped" });
    await playRoundByTap(saveB);
    const snapshotB = await saveB.evaluate(() => window.__game.getSnapshot());
    const actionsB = await offeredTappableIds(saveB);

    // Snapshot access proves the divergent memory premise; it never drives play.
    expect(snapshotA).not.toEqual(snapshotB);
    expect(actionsA).not.toEqual(actionsB);

    await saveA.close();
    await saveB.close();
  });
});
