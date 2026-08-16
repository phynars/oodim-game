import { expect, test } from "@playwright/test";

// M-CONTINUE phone playtest — TAP-driven served-page e2e.
//
// This spec plays the aftersign vertical slice on a phone-sized viewport
// with `hasTouch`, driving ONLY the visible affordances the served page
// actually renders. The served page (`aftersign/index.html` +
// `aftersign/main.js`) exposes two persistent action buttons —
// `#acknowledgeRouteButton` and `#deliverButton` — whose visible label
// and `dataset.choiceId` are rewritten by `main.js`'s render path as the
// M-CONTINUE state advances (see `setTextContentIfChanged` calls in
// `main.js` around lines 1082-1118).
//
// We assert against those TWO stable selectors and their *rendered text*
// per beat, because that is what a player can actually see and tap.
// No `[data-beat-id]` / `[data-choice-id]` container selectors exist on
// the served page — this spec deliberately does NOT query for them; if
// a future refactor exposes beats as tappable DOM, add a sibling spec
// rather than reintroducing phantom locators here.

const phoneViewport = { width: 390, height: 844 };

const tapDeliver = async (page: import("@playwright/test").Page): Promise<void> => {
  const button = page.locator("#deliverButton");
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.tap();
};

const tapAcknowledge = async (page: import("@playwright/test").Page): Promise<void> => {
  const button = page.locator("#acknowledgeRouteButton");
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.tap();
};

test.describe("M-CONTINUE phone playtest", () => {
  test.use({ viewport: phoneViewport, hasTouch: true, isMobile: true });

  test("a player taps past io-return-recognition into return-tone and next-job beats", async ({ page }) => {
    await page.goto("/aftersign/");

    // Boot: acknowledge the route, then deliver the packet.
    // At boot, `#acknowledgeRouteButton` reads "Acknowledge route" and
    // `#deliverButton` reads "Deliver packet" (main.js:1082,1084).
    await expect(page.locator("#acknowledgeRouteButton")).toContainText(/acknowledge route/i);
    await expect(page.locator("#deliverButton")).toContainText(/deliver packet/i);
    await tapAcknowledge(page);
    await tapDeliver(page);

    // After delivery the return-tone beat renders: the same two buttons
    // are re-labeled "Kind return" / "Blunt return" (main.js:1092,1094),
    // both wired to choiceId `choose-return-tone`.
    await expect(page.locator("#acknowledgeRouteButton")).toContainText(/kind return/i);
    await expect(page.locator("#deliverButton")).toContainText(/blunt return/i);
    await tapAcknowledge(page);

    // After the return-tone choice, we reach `io-next-job`: the
    // acknowledge button is disabled, and `#deliverButton` re-labels to
    // "Ask for next job" (main.js:1102-1106).
    await expect(page.locator("#acknowledgeRouteButton")).toBeDisabled();
    await expect(page.locator("#deliverButton")).toContainText(/ask for next job/i);
    await tapDeliver(page);

    // After asking for the next job, `#deliverButton` re-labels to
    // "Deliver next packet" (main.js:1108-1112) — the loop continues.
    await expect(page.locator("#deliverButton")).toContainText(/deliver next packet/i);

    // Sanity: the page body still mentions the packet/next-job vocabulary
    // — proves we haven't fallen off into an error or blank state.
    await expect(page.locator("body")).toContainText(/next|packet|orra|io/i);
  });
});
