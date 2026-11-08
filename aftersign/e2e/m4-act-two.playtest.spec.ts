import { expect, test, type Browser, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

function slotUrl(slot: string, playerId: string): string {
  return `/aftersign/?slot=${slot}&player=${playerId}`;
}

async function tapVisible(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await target.tap();
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  await tapVisible(page, `button[data-choice-id="${choiceId}"]:not([disabled])`);
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function openFreshContext(browser: Browser, slot: string, playerId: string) {
  const context = await browser.newContext({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  const page = await context.newPage();
  await page.goto(slotUrl(slot, playerId), { waitUntil: "load" });
  return { context, page };
}

async function reachOrraPayback(page: Page, firstTap: string): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await tapVisible(page, '#offeredJobs button[data-offered-job-id="job-safe-delivery"]');
  await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, firstTap);
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

const CASES = [
  {
    firstTap: "acknowledge-kiosk",
    firstTapText: "acknowledge",
    otherTapText: "what changed",
    maudChoice: "remembered-name",
    endingId: "maud-bell-archive-lit",
    endingText: "The district light stays lit.",
  },
  {
    firstTap: "ask-what-changed",
    firstTapText: "what changed",
    otherTapText: "acknowledge",
    maudChoice: "archive-decoy",
    endingId: "maud-bell-archive-dark",
    endingText: "One district light goes out.",
  },
] as const;

test.describe("M4 phone Act II playtest (#2705)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  for (const scenario of CASES) {
    test(`touch path ${scenario.firstTap} reaches ${scenario.endingId} and restores`, async ({ page, browser }) => {
      test.setTimeout(240_000);
      const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const slot = `m4-act-two-${scenario.maudChoice}-${runId}`;
      const playerId = `e2e-m4-${scenario.maudChoice}-${runId}`;
      await page.goto(slotUrl(slot, playerId), { waitUntil: "load" });

      await reachOrraPayback(page, scenario.firstTap);

      // Episode 1 ending is only committed by the light-vigil choice
      // (episode-one-ending-no-stale-copy-served.spec.ts:44-47,
      // episode-one-ending-served.spec.ts:67-71). Tap it by touch before
      // reading the card. If the served page doesn't offer light-vigil at
      // round-two io-return-recognition, this tap is where the spec fails,
      // and that gap gets filed as a bug (#2705: never skip).
      await tapChoice(page, "light-vigil");

      // Episode 1 ending card: `#episodeOneEnding [data-ending-id]` with ids
      // like `ending-bell-true` / `ending-light-out`. Any `ending-*` id is
      // accepted; the Act II Maud ids (`maud-bell-archive-*`) come later.
      const episodeOneEnding = page.locator("#episodeOneEnding [data-ending-id]").first();
      await expect(episodeOneEnding).toBeVisible({ timeout: WAIT_MS });
      await expect(episodeOneEnding).toHaveAttribute("data-ending-id", /^ending-/);
      await expect(episodeOneEnding).not.toBeEmpty();

      const redTag = page.locator('button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])');
      await expect(redTag).toBeVisible({ timeout: WAIT_MS });
      await expect(redTag).toContainText(/red tag|orra/i);
      await redTag.tap();

      const dialogue = page.locator("#line");
      await expect(dialogue).toContainText(new RegExp(scenario.firstTapText, "i"), { timeout: WAIT_MS });
      await expect(dialogue).not.toContainText(new RegExp(scenario.otherTapText, "i"));

      const maudChoice = page.locator(`button[data-maud-name-choice="${scenario.maudChoice}"]`);
      await expect(maudChoice).toBeVisible({ timeout: WAIT_MS });
      await expect(page.locator('[data-beat="maud-bell-archive"]')).toContainText(/name|archive/i);
      await maudChoice.tap();

      const ending = page.locator(`[data-ending-id="${scenario.endingId}"]`);
      await expect(ending).toBeVisible({ timeout: WAIT_MS });
      await expect(ending).toContainText("Act II — Bell Archive");
      await expect(ending).toContainText(scenario.endingText);

      const { context, page: returning } = await openFreshContext(browser, slot, playerId);
      try {
        const restoredEnding = returning.locator(`[data-ending-id="${scenario.endingId}"]`);
        await expect(restoredEnding).toBeVisible({ timeout: WAIT_MS });
        await expect(restoredEnding).toContainText("Act II — Bell Archive");
        await expect(restoredEnding).toContainText(scenario.endingText);
      } finally {
        await context.close();
      }
    });
  }
});
