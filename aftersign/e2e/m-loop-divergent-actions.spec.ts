import { expect, test, type Page } from "@playwright/test";

const phoneViewport = { width: 390, height: 844 };

async function seedMemory(page: Page, memory: Record<string, unknown>) {
  await page.addInitScript((seed) => {
    window.localStorage.setItem("aftersign:test-memory", JSON.stringify(seed));
  }, memory);
}

async function openAftersign(page: Page) {
  await page.goto("/aftersign/");
  await expect(page.locator("body")).toBeVisible();
}

async function tapVisibleAction(page: Page, actionId: string) {
  const action = page.locator(`[data-action-id="${actionId}"]`).filter({ visible: true }).first();
  await expect(action).toBeVisible();
  await action.tap();
}

async function collectVisibleJobActionIds(page: Page) {
  const actions = page.locator("[data-action-id^='take-job-']").filter({ visible: true });
  await expect(actions.first()).toBeVisible();
  return actions.evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute("data-action-id"))
      .filter((value): value is string => Boolean(value)),
  );
}

async function playToFirstJobOffer(page: Page) {
  await openAftersign(page);

  // This spec is acceptance evidence, not a harness shortcut: every player action
  // below is a tap on a rendered element. `window.__game` may be asserted, but it
  // must not cause progress.
  await tapVisibleAction(page, "start");
  await tapVisibleAction(page, "answer-io");
}

test.describe("M-LOOP divergent available actions", () => {
  test.use({ viewport: phoneViewport });

  test("different durable memories produce different tappable job offers", async ({ browser }) => {
    const firstRun = await browser.newPage();
    await seedMemory(firstRun, {
      playerId: "m-loop-first-run",
      facts: [],
      trust: "unknown",
      completedJobs: [],
    });
    await playToFirstJobOffer(firstRun);
    const firstRunActions = await collectVisibleJobActionIds(firstRun);
    await firstRun.close();

    const trustedCourier = await browser.newPage();
    await seedMemory(trustedCourier, {
      playerId: "m-loop-trusted-courier",
      facts: ["kept-packet-sealed", "delivered-cleanly"],
      trust: "trusted",
      completedJobs: ["blue-seal-safe-run"],
    });
    await playToFirstJobOffer(trustedCourier);
    const trustedActions = await collectVisibleJobActionIds(trustedCourier);
    await trustedCourier.close();

    expect(firstRunActions.sort()).not.toEqual(trustedActions.sort());
  });
});
