import { expect, test, type Browser, type Page } from "@playwright/test";

// #2754 (story #2726) fail-to-pass: a completed Act II ending — outcome
// (lit / out) AND the name shown with it — is restored from the
// authoritative slot save in a fresh browser context.
//
// On main only `story.maudBellArchiveEndingId` was saved, so the restored
// card read "The bell rings for the courier." instead of the chosen name.
// The name assertions below fail there. The fix sets
// `story.maudBellArchiveName` in Maud's onSelect (main.js), saves it in
// persistence.js, hydrates it on boot, and passes it to the restore render.
//
// Taps only: every step is a `.tap()` on a visible element at 390×844.
// The spec never writes to `window.__game`.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`);
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function tapVisible(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await target.tap();
}

async function reachOrraPayback(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await tapVisible(page, '#offeredJobs button[data-offered-job-id="job-safe-delivery"]');
  await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await tapVisible(page, 'button[data-return-reason="blunt"]:not([disabled])');
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "accept-second-packet");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
  await tapVisible(page, '#offeredJobs button[data-offered-job-id="job-night-transfer"]');
  await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
}

async function openFreshContext(browser: Browser, slot: string, player: string) {
  const context = await browser.newContext({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(`/aftersign/?slot=${slot}&player=${player}`, { waitUntil: "load" });
  return { context, page };
}

type Case = { choice: string; endingId: string; light: string };
const LIT: Case = { choice: "remembered-name", endingId: "maud-bell-archive-lit", light: "lit" };
const DIM: Case = { choice: "archive-decoy", endingId: "maud-bell-archive-dark", light: "out" };

/** Complete the Act II ending by taps; return the visible outcome line. */
async function completeEnding(page: Page, slot: string, player: string, c: Case): Promise<string> {
  await page.goto(`/aftersign/?slot=${slot}&player=${player}`, { waitUntil: "load" });
  await reachOrraPayback(page);
  await tapVisible(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])');
  const nameButton = page.locator(`button[data-maud-name-choice="${c.choice}"]`);
  await expect(nameButton).toBeVisible({ timeout: WAIT_MS });
  await nameButton.tap();
  const card = page.locator(`[data-ending-id="${c.endingId}"]`);
  await expect(card).toBeVisible({ timeout: WAIT_MS });
  await expect(card).toHaveAttribute("data-district-light", c.light);
  const outcome = (await card.locator(".episode-one-ending__outcome").textContent())?.trim() ?? "";
  expect(outcome).toMatch(/The bell rings for /);
  return outcome;
}

/** Reopen the same slot in a fresh context; assert outcome + name match. */
async function assertRestored(browser: Browser, slot: string, player: string, c: Case, outcome: string) {
  await expect(async () => {
    const { context, page } = await openFreshContext(browser, slot, player);
    try {
      const card = page.locator(`[data-ending-id="${c.endingId}"]`);
      await expect(card).toBeVisible({ timeout: WAIT_MS });
      await expect(card).toHaveAttribute("data-district-light", c.light);
      await expect(card.locator(".episode-one-ending__outcome")).toHaveText(outcome);
      await expect(page.locator("[data-maud-name-choice]")).toHaveCount(0);
      await expect(page.locator('[data-beat="maud-bell-archive"]')).toHaveCount(0);
    } finally {
      await context.close();
    }
  }).toPass({ timeout: 90_000, intervals: [1_000, 2_000, 5_000] });
}

const ids = (tag: string) => ({
  player: `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  slot: `durable-act-ii-${tag}-${Date.now()}`,
});

test.describe("Durable Act II ending (#2726)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("restores the same Act II ending outcome and name in a fresh browser context", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("name");
    const outcome = await completeEnding(page, slot, player, DIM);
    expect(outcome).toContain("Mara Vell");
    await assertRestored(browser, slot, player, DIM, outcome);
  });

  test("reaches the lit ending by taps only at 390×844", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("lit");
    const outcome = await completeEnding(page, slot, player, LIT);
    await assertRestored(browser, slot, player, LIT, outcome);
  });

  test("reaches the dimmed ending by taps only at 390×844", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("dim");
    const outcome = await completeEnding(page, slot, player, DIM);
    await assertRestored(browser, slot, player, DIM, outcome);
  });

  test("disables every Act II name control after the first visible tap", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("final");
    await page.goto(`/aftersign/?slot=${slot}&player=${player}`, { waitUntil: "load" });
    await reachOrraPayback(page);
    await tapVisible(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])');

    const first = page.locator('button[data-maud-name-choice="remembered-name"]');
    await expect(first).toBeVisible({ timeout: WAIT_MS });
    await first.tap();
    const ending = page.locator('[data-ending-id="maud-bell-archive-lit"]');
    await expect(ending).toBeVisible({ timeout: WAIT_MS });
    const outcome = (await ending.locator(".episode-one-ending__outcome").textContent())?.trim() ?? "";
    const nameControls = page.locator("button[data-maud-name-choice]");
    await expect(nameControls).toHaveCount(3);
    expect(await nameControls.evaluateAll((controls) => controls.every((control) => control.disabled))).toBe(true);
    await expect(ending).toHaveAttribute("data-district-light", "lit");
    await expect(ending.locator(".episode-one-ending__outcome")).toHaveText(outcome);
    await assertRestored(browser, slot, player, LIT, outcome);
  });

  test("does not reopen an Act II choice after restoring an ending", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("nochoice");
    const outcome = await completeEnding(page, slot, player, DIM);
    await assertRestored(browser, slot, player, DIM, outcome);
    const { context, page: returning } = await openFreshContext(browser, slot, player);
    try {
      await expect(returning.locator(`[data-ending-id="${DIM.endingId}"]`)).toBeVisible({ timeout: WAIT_MS });
      await expect(returning.locator("button[data-maud-name-choice]")).toHaveCount(0);
      await expect(
        returning.locator('button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])'),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
