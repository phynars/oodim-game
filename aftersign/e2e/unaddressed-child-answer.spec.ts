import { expect, test, type Browser, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;
const ANSWERS = [["i-dont-know", "I don't know."], ["i-know-where-to-begin", "I know where to begin."]] as const;
// #3067: the Unaddressed Child asks on the Act II card (after Continue to Act II),
// not on the Act I ending card. The confident control's text is branch-specific.
const TAKE_BUTTON_TEXT: Record<string, string> = {
  "i-dont-know": "I don't know.",
  "i-know-where-to-begin": "I know where to begin by the quiet door.",
};
const ACT_TWO_TAKE = '[data-act-two-opening-id="episode-two-act-two-take-opening"]';
test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

async function tap(page: Page, selector: string) {
  const control = page.locator(selector);
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await control.tap();
}

async function reachChild(page: Page, slot: string, player: string) {
  await page.goto(`/aftersign/?slot=${slot}&player=${player}`, { waitUntil: "load" });
  await expect(page.locator('[data-beat-id="packet-offered"]')).toBeVisible({ timeout: WAIT_MS });
  for (const selector of [
    '#offeredJobs button[data-offered-job-id="job-safe-delivery"]', "#packetButton", 'button[data-choice-id="acknowledge-kiosk"]', 'button[data-choice-id="deliver-packet"]',
    'button[data-return-reason="kind"]', 'button[data-choice-id="ask-for-next-job"]', 'button[data-choice-id="accept-second-packet"]', 'button[data-choice-id="deliver-packet"]',
    '#offeredJobs button[data-offered-job-id="job-night-transfer"]', "#packetButton", 'button[data-choice-id="acknowledge-kiosk"]', 'button[data-choice-id="deliver-packet"]',
    'button[data-orra-payback-action="carry-name-to-bell-archive"]', 'button[data-maud-name-choice="remembered-name"]', 'button[data-choice-id="open-unlit-door"]',
    'button[data-choice-id="keep-official-record"]', "#beginEpisodeTwo", "#acceptEpisodeTwoJob",
  ]) await tap(page, selector);
}

async function chooseNikoTakeAndContinue(page: Page) {
  await tap(page, 'button[data-niko-shortcut-choice="take"]');
  await expect(page.locator('[data-ending-id="episode-two-act-one"]')).toBeVisible({ timeout: WAIT_MS });
  await tap(page, '[data-episode-two-next-step="act-two-continuation"]');
  await expect(page.locator(ACT_TWO_TAKE)).toBeVisible({ timeout: WAIT_MS });
}

async function fresh(browser: Browser, slot: string, player: string) {
  const context = await browser.newContext({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(`/aftersign/?slot=${slot}&player=${player}`, { waitUntil: "load" });
  return { context, page };
}
const ids = (tag: string) => ({ slot: `child-${tag}-${Date.now().toString(36)}`, player: `e2e-${Math.random().toString(36).slice(2, 10)}` });

test.describe("Unaddressed Child answer (#3055, moved to Act II by #3067)", () => {
  test("shows both Unaddressed Child answers as tappable visible controls on the Act II card at 390x844", async ({ page }) => {
    test.setTimeout(240_000);
    const { slot, player } = ids("controls");
    await reachChild(page, slot, player);
    await expect(page.locator('button[data-unaddressed-child-answer]')).toHaveCount(0);
    await chooseNikoTakeAndContinue(page);
    for (const [id] of ANSWERS) {
      const answer = page.locator(`${ACT_TWO_TAKE} button[data-unaddressed-child-answer="${id}"]`);
      await expect(answer).toBeVisible({ timeout: WAIT_MS });
      await expect(answer).toHaveText(TAKE_BUTTON_TEXT[id]);
    }
  });

  test("persists each tapped Unaddressed Child answer in the authoritative slot save", async ({ page, browser }) => {
    test.setTimeout(300_000);
    for (const [id, label] of ANSWERS) {
      const { slot, player } = ids(id);
      await reachChild(page, slot, player);
      await chooseNikoTakeAndContinue(page);
      await tap(page, `button[data-unaddressed-child-answer="${id}"]`);
      await expect(page.locator('[data-act-two-end-card="true"]')).toContainText(label, { timeout: WAIT_MS });
      await expect(async () => {
        const { context, page: restored } = await fresh(browser, slot, player);
        try {
          await expect(restored.locator('[data-act-two-end-card="true"]')).toContainText(`Your answer: ${label}`, { timeout: WAIT_MS });
        } finally { await context.close(); }
      }).toPass({ timeout: 90_000, intervals: [1_000, 2_000, 5_000] });
    }
  });

  test("names the selected Unaddressed Child answer on the Act II end card", async ({ page }) => {
    test.setTimeout(240_000);
    const { slot, player } = ids("ending");
    await reachChild(page, slot, player);
    await chooseNikoTakeAndContinue(page);
    await tap(page, 'button[data-unaddressed-child-answer="i-dont-know"]');
    const card = page.locator('[data-act-two-end-card="true"]');
    await expect(card).toBeVisible({ timeout: WAIT_MS });
    await expect(card).toContainText("Shortcut answer: take");
    await expect(card).toContainText("Where do you begin?");
    await expect(card).toContainText("Your answer: I don't know.");
    await expect(page.locator('[data-act-two-continuation="to-be-continued"]')).toBeVisible({ timeout: WAIT_MS });
    await expect(page.locator('[data-act-two-continuation="to-be-continued"]')).toHaveText("To be continued.");
  });

  test("restores the selected Unaddressed Child answer on the Act II end card in a fresh browser context", async ({ page, browser }) => {
    test.setTimeout(300_000);
    const { slot, player } = ids("restore");
    await reachChild(page, slot, player);
    await chooseNikoTakeAndContinue(page);
    await tap(page, 'button[data-unaddressed-child-answer="i-know-where-to-begin"]');
    await expect(async () => {
      const { context, page: restored } = await fresh(browser, slot, player);
      try {
        const card = restored.locator('[data-act-two-end-card="true"]');
        await expect(card).toBeVisible({ timeout: WAIT_MS });
        await expect(card).toContainText("Your answer: I know where to begin.");
      } finally { await context.close(); }
    }).toPass({ timeout: 90_000, intervals: [1_000, 2_000, 5_000] });
  });
});
