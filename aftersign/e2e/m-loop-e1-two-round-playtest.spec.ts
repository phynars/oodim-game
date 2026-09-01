import { expect, test, type Locator, type Page } from "@playwright/test";

const phoneViewport = { width: 390, height: 844 };

async function visibleActionLabels(page: Page): Promise<string[]> {
  const actions = page.locator(
    [
      "button:visible",
      "[role='button']:visible",
      "[id^='job-offer-']:visible",
      "[data-action-id]:visible",
      "[data-choice-id]:visible",
    ].join(", "),
  );

  return actions.evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const element = node as HTMLElement;
        return (
          element.getAttribute("data-action-id") ||
          element.getAttribute("data-choice-id") ||
          element.id ||
          element.innerText ||
          element.textContent ||
          ""
        ).trim();
      })
      .filter(Boolean),
  );
}

async function firstVisible(page: Page, patterns: RegExp[]): Promise<Locator> {
  for (const pattern of patterns) {
    const byRole = page.getByRole("button", { name: pattern }).first();
    if (await byRole.isVisible().catch(() => false)) return byRole;

    const byText = page.getByText(pattern).first();
    if (await byText.isVisible().catch(() => false)) return byText;
  }

  throw new Error(`No visible player action matched: ${patterns.map(String).join(", ")}`);
}

async function tapFirstVisible(page: Page, patterns: RegExp[]): Promise<void> {
  await (await firstVisible(page, patterns)).tap();
}

test("M-LOOP-E1: two phone-played rounds re-offer different visible actions", async ({ page }) => {
  await page.setViewportSize(phoneViewport);
  await page.goto("/aftersign/");

  await expect(page.locator("body")).toContainText(/Io|AFTERSIGN/i);

  await expect(page.getByText(/Take the lit stair|lit stair/i).first()).toBeVisible();
  const roundOneActions = await visibleActionLabels(page);
  expect(roundOneActions.length).toBeGreaterThan(0);

  await tapFirstVisible(page, [/Take the lit stair/i, /accept/i, /take job/i, /job/i]);
  await expect(page.locator("body")).toContainText(/packet|deliver|route|stair/i);

  await tapFirstVisible(page, [/keep sealed/i, /seal/i, /deliver/i, /continue/i]);
  await expect(page.locator("body")).toContainText(/deliver|Orra|answer|packet/i);

  await tapFirstVisible(page, [/deliver/i, /hand.*packet/i, /continue/i]);
  await expect(page.locator("body")).toContainText(/return|Io|remember|recogn/i);

  await tapFirstVisible(page, [/return.*Io/i, /return/i, /continue/i]);
  await expect(page.locator("body")).toContainText(/Cross behind the shuttered pharmacy|Stay in the amber lamps|shuttered pharmacy|amber lamps/i);

  const roundTwoActions = await visibleActionLabels(page);
  expect(roundTwoActions.length).toBeGreaterThan(0);
  expect(roundTwoActions).not.toEqual(roundOneActions);

  const gameState = await page.evaluate(() => {
    const maybeGame = (window as Window & { __game?: unknown }).__game;
    if (!maybeGame || typeof maybeGame !== "object") return null;
    const game = maybeGame as { state?: unknown; getState?: () => unknown };
    return typeof game.getState === "function" ? game.getState() : game.state ?? null;
  });

  expect(gameState).toBeTruthy();
});
