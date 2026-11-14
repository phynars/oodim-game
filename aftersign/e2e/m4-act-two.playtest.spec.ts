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
// Verbatim from aftersign/main.js renderText() #saintOrraReturnNeed (fresh
// slot: player.name unset → "the courier", the remembered-name choice).
const ORRA_RETURN_NEED =
  'Saint Orra: The red tag was mine. Maud Underbell\'s Bell Archive needs your name, "the courier". Carry it there — "Mara Vell" and "Orra Bell" are names the archive offers to trap you.';
const ARCHIVE_CONTROL = 'button[data-orra-payback-action="carry-name-to-bell-archive"]';

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

  // #2804 directed variant: second delivery WITHOUT "Take the second
  // packet". No red tag taken → no Orra need line and no name-carrying
  // control on Io's return card.
  test("#2804: second delivery without taking the red tag offers no archive control", async ({ page }) => {
    test.setTimeout(180_000);
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const slot = `m4-2804-skip-${runId}`;
    const playerId = `e2e-m4-2804-skip-${runId}`;
    await page.goto(slotUrl(slot, playerId), { waitUntil: "load" });

    await reachNextJob(page);
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-offered");
    await tapVisible(page, '#offeredJobs button[data-offered-job-id="job-night-transfer"]');
    await tapVisible(page, "#packetButton");
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");

    await expect(page.locator("#saintOrraReturnNeed")).toHaveCount(0);
    await expect(page.locator(ARCHIVE_CONTROL)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Carry the name to the Bell Archive");
  });

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

      const orraNameCase = page.locator('#saintOrraNameCase[data-beat-id="orra-first-name"]');
      await expect(orraNameCase).toBeVisible({ timeout: WAIT_MS });
      // #2808 F2 — this fresh slot never sets player.name, so the rendered
      // name clause must be the fallback, never a raw "null"/"undefined".
      await expect(orraNameCase).toHaveText(
        "Saint Orra: Maud Underbell needs your name. Carry it sealed to the Bell Archive.",
      );
      await expect(orraNameCase).not.toContainText(/\b(null|undefined)\b/);
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

      // #2804 F2: Orra's need line (name to carry + decoys) is on screen
      // before the archive control, and the control sits after it.
      const orraNeed = page.locator('#saintOrraReturnNeed[data-beat-id="orra-return-need"]');
      await expect(orraNeed).toBeVisible({ timeout: WAIT_MS });
      await expect(orraNeed).toHaveText(ORRA_RETURN_NEED);
      const payback = page.locator(
        'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])',
      );
      await expect(payback).toBeVisible({ timeout: WAIT_MS });
      expect(
        await orraNeed.evaluate((need) => {
          const button = document.getElementById("orraPaybackAction");
          return !!button && !!(need.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
        }),
        "archive control renders after Orra's need line",
      ).toBe(true);
      await expect(payback).toHaveText("Carry the name to the Bell Archive");
      await payback.tap();

      const maud = page.locator('[data-beat="maud-bell-archive"]');
      await expect(maud).toBeVisible({ timeout: WAIT_MS });
      await expect(maud).toContainText(MAUD_TITLE);
      await expect(maud).toContainText(MAUD_PROMPT);

      // #2800: the card itself must fit the phone viewport (top edge
      // reachable, not pushed above y=0 by the bottom-anchored HUD) and
      // be a touch-scrollable container. On main the panel is unbounded,
      // so its top sits above the viewport and this fails.
      const panel = page.locator(".hud .panel");
      await expect
        .poll(async () => {
          const box = await panel.boundingBox();
          return box ? box.y >= 0 && box.y + box.height <= PHONE_VIEWPORT.height + 1 : false;
        }, { message: "dialogue card fits inside the 390×844 viewport", timeout: WAIT_MS })
        .toBe(true);
      const panelStyle = await panel.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { overflowY: cs.overflowY, touchAction: cs.touchAction };
      });
      expect(["auto", "scroll"]).toContain(panelStyle.overflowY);

      const nameButtons = page.locator("button[data-maud-name-choice]");
      await expect(nameButtons).toHaveCount(3, { timeout: WAIT_MS });
      for (let index = 0; index < 3; index += 1) {
        const nameChoice = nameButtons.nth(index);
        await expect(nameChoice).toBeVisible();
        await expect(nameChoice).not.toHaveText(/^\s*$/);
        // Poll: the newest-section scroll settles over a few frames.
        await expect
          .poll(async () => {
            const bounds = await nameChoice.boundingBox();
            if (!bounds) return false;
            return bounds.y >= 0 && bounds.y + bounds.height <= PHONE_VIEWPORT.height;
          }, { message: `name choice ${index} fully inside the viewport`, timeout: WAIT_MS })
          .toBe(true);
        // Not clipped by the scroll container or covered: the button owns
        // its own center point, i.e. a tap there lands on it.
        const ownsCenter = await nameChoice.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!hit && (hit === el || el.contains(hit));
        });
        expect(ownsCenter, `name choice ${index} owns its center point`).toBe(true);
      }
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

      const bellOutcome = ending.locator(".episode-one-ending__outcome");
      await expect(bellOutcome).toContainText(`The bell rings for ${tappedName || ""}.`);
      await expect
        .poll(async () => {
          const bounds = await bellOutcome.boundingBox();
          return !!bounds && bounds.y >= 0 && bounds.y + bounds.height <= PHONE_VIEWPORT.height;
        }, { message: "bell recipient line fully inside the viewport after a name tap", timeout: WAIT_MS })
        .toBe(true);

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
