import { expect, test, type Browser, type Page } from "@playwright/test";

// M4 PLAYTEST gate (#2705): taps-only, phone viewport, served page.
//
// What this adds beyond maud-bell-archive.playtest.spec.ts /
// maud-bell-archive-fresh-context.spec.ts: those assert only data-* ids.
// This spec asserts the VISIBLE text at every dialogue change: the Episode 1
// card, the red-tag control, Orra's recall naming the path's real first tap
// (and not the other path's), the payback control, Maud's archive prompt, and
// the bell ending card. It does this for two records with different first taps
// and different Maud name choices.
//
// Each record validates both visible play paths: the Episode 1 red-tag recall
// and the red-tag payback route into Maud's Bell Archive. The latter ends with
// a persisted bell outcome, checked again after a fresh browser context.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

// Verbatim from aftersign/main.js saintOrraRecallLine().
const RECALL_TAKE = "You took the red tag at once. I remember the hand that did not wait.";
const RECALL_ASK = "You asked what changed before you carried it. I remember the question.";
// Verbatim from aftersign/src/bellArchiveScene.ts.
const MAUD_TITLE = "Maud Underbell — Bell Archive";
const MAUD_PROMPT = "Maud opens the archive. Which name did the bell keep?";

function slotUrl(slot: string, playerId: string): string {
  return `/aftersign/?slot=${slot}&player=${playerId}`;
}

async function tapVisible(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector).first();
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

// Boot → first delivery → Io's next-job beat, by taps only.
async function reachNextJob(page: Page): Promise<void> {
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
}

const CASES = [
  {
    label: "A",
    firstTap: "accept-second-packet",
    recall: RECALL_TAKE,
    otherRecall: RECALL_ASK,
    episodeOneEndingId: "ending-bell-true",
    episodeOneBell: "The Bell Archive rings Orra's name true.",
    episodeOneLight: "South district light: lit",
    maudChoice: "remembered-name",
    endingId: "maud-bell-archive-lit",
    endingLine: "The district light stays lit.",
    endingDialogue: "The archive rests.",
    endingLight: "District light: lit",
  },
  {
    label: "B",
    firstTap: "ask-what-changed",
    recall: RECALL_ASK,
    otherRecall: RECALL_TAKE,
    episodeOneEndingId: "ending-light-out",
    episodeOneBell: "The Bell Archive rings for the wrong name.",
    episodeOneLight: "South district light: out",
    maudChoice: "archive-decoy",
    endingId: "maud-bell-archive-dark",
    endingLine: "One district light goes out.",
    endingDialogue: "The archive closes.",
    endingLight: "District light: out",
  },
] as const;

test.describe("M4 phone Act II playtest (#2705)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  for (const scenario of CASES) {
    test(`record ${scenario.label}: ${scenario.firstTap} → Episode 1 card → Orra recall, restored`, async ({ page, browser }) => {
      test.setTimeout(180_000);
      const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const slot = `m4-recall-${scenario.label}-${runId}`;
      const playerId = `e2e-m4-recall-${scenario.label}-${runId}`;
      await page.goto(slotUrl(slot, playerId), { waitUntil: "load" });

      await reachNextJob(page);
      // The path's real first tap on Io's red-tag offer.
      await tapChoice(page, scenario.firstTap);
      // The vigil tray renders at io-next-job; light-vigil commits Episode 1.
      await tapChoice(page, "light-vigil");

      const card = page.locator("#episodeOneEnding [data-ending-id]").first();
      await expect(card).toBeVisible({ timeout: WAIT_MS });
      await expect(card).toHaveAttribute("data-ending-id", scenario.episodeOneEndingId);
      await expect(card).toContainText("Episode 1 — complete");
      await expect(card).toContainText(scenario.episodeOneBell);
      await expect(card).toContainText(scenario.episodeOneLight);

      const redTag = page.locator('button[data-choice-id="carry-red-tag-to-saint-orra"]:not([disabled])');
      await expect(redTag).toBeVisible({ timeout: WAIT_MS });
      await expect(redTag).toHaveText("Carry the red tag to Saint Orra");
      await redTag.tap();

      const recall = page.locator("#saintOrraRedTagRecall");
      await expect(recall).toHaveText(scenario.recall, { timeout: WAIT_MS });
      await expect(page.locator("body")).not.toContainText(scenario.otherRecall);
      await expect(redTag).toHaveCount(0);

      {
        const { context, page: returning } = await openFreshContext(browser, slot, playerId);
        try {
          await expect(returning.locator("#episodeOneEnding [data-ending-id]").first())
            .toHaveAttribute("data-ending-id", scenario.episodeOneEndingId, { timeout: WAIT_MS });
          await expect(returning.locator("#saintOrraRedTagRecall")).toHaveText(scenario.recall, {
            timeout: WAIT_MS,
          });
          await expect(returning.locator("body")).not.toContainText(scenario.otherRecall);
        } finally {
          await context.close();
        }
      }

      const maudEntry = page.locator(
        'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])',
      );
      await expect(maudEntry).toBeVisible({ timeout: WAIT_MS });
      await expect(maudEntry).toHaveText("Carry the name to the Bell Archive");
      await maudEntry.tap();

      const maud = page.locator('[data-beat="maud-bell-archive"]');
      await expect(maud).toBeVisible({ timeout: WAIT_MS });
      await expect(maud).toContainText(MAUD_TITLE);
      await expect(maud).toContainText(MAUD_PROMPT);
      const nameButton = page.locator(`button[data-maud-name-choice="${scenario.maudChoice}"]`);
      const tappedName = await nameButton.textContent();
      await nameButton.tap();

      const ending = page.locator(`[data-ending-id="${scenario.endingId}"]`);
      await expect(ending).toBeVisible({ timeout: WAIT_MS });
      await expect(ending).toContainText(scenario.endingLine);
      await expect(ending).toContainText(tappedName || "");

      const { context, page: returning } = await openFreshContext(browser, slot, playerId);
      try {
        const restored = returning.locator(`[data-ending-id="${scenario.endingId}"]`);
        await expect(restored).toBeVisible({ timeout: WAIT_MS });
        await expect(restored).toContainText(scenario.endingLine);
        await expect(returning.locator("[data-maud-name-choice]")).toHaveCount(0);
      } finally {
        await context.close();
      }
    });

    test(`record ${scenario.label}: red-tag payback → Maud ${scenario.maudChoice} → ${scenario.endingId}, restored`, async ({ page, browser }) => {
      test.setTimeout(240_000);
      const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const slot = `m4-bell-${scenario.label}-${runId}`;
      const playerId = `e2e-m4-bell-${scenario.label}-${runId}`;
      await page.goto(slotUrl(slot, playerId), { waitUntil: "load" });

      await reachNextJob(page);
      await tapChoice(page, "accept-second-packet");
      await tapChoice(page, "deliver-packet");
      await waitForBeat(page, "packet-offered");
      await tapVisible(page, '#offeredJobs button[data-offered-job-id="job-night-transfer"]');
      await tapVisible(page, "#packetButton");
      await waitForBeat(page, "packet-choice");
      await tapChoice(page, "acknowledge-kiosk");
      await tapChoice(page, "deliver-packet");
      await waitForBeat(page, "io-return-recognition");

      const payback = page.locator(
        'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])',
      );
      await expect(payback).toBeVisible({ timeout: WAIT_MS });
      await expect(payback).toHaveText("Carry the name to the Bell Archive");
      await payback.tap();

      const maud = page.locator('[data-beat="maud-bell-archive"]');
      await expect(maud).toBeVisible({ timeout: WAIT_MS });
      await expect(maud).toContainText(MAUD_TITLE);
      await expect(maud).toContainText(MAUD_PROMPT);

      const nameButton = page.locator(`button[data-maud-name-choice="${scenario.maudChoice}"]`);
      await expect(nameButton).toBeEnabled({ timeout: WAIT_MS });
      const tappedName = await nameButton.textContent();
      await nameButton.tap();

      const ending = page.locator(`[data-ending-id="${scenario.endingId}"]`);
      await expect(ending).toBeVisible({ timeout: WAIT_MS });
      await expect(ending).toContainText("Act II — Bell Archive");
      await expect(ending).toContainText("The Bell Archive rings.");
      await expect(ending).toContainText(scenario.endingLine);
      await expect(ending).toContainText(scenario.endingDialogue);
      await expect(ending).toContainText(tappedName || "");
      await expect(ending).toContainText(scenario.endingLight);

      const { context, page: returning } = await openFreshContext(browser, slot, playerId);
      try {
        const restored = returning.locator(`[data-ending-id="${scenario.endingId}"]`);
        await expect(restored).toBeVisible({ timeout: WAIT_MS });
        await expect(restored).toContainText("Act II — Bell Archive");
        await expect(restored).toContainText(scenario.endingLine);
        await expect(returning.locator("[data-maud-name-choice]")).toHaveCount(0);
      } finally {
        await context.close();
      }
    });
  }
});
