import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP — two consecutive rounds, played tap-only.
//
// Founder bar from docs/flagship/BRIEF.md (2026-08-22): the standing
// playtest must complete TWO consecutive rounds on the served page. This
// spec drives the shipped UI from a phone viewport with real taps only.
// `window.__game` is read as an assertion mirror, never as an input surface.

declare global {
  interface Window {
    __game?: {
      scene?: { ready?: boolean; beat?: string };
      interaction?: { lastAction?: string | null };
      getSnapshot?: () => {
        scene?: { beat?: string };
        story?: { offeredJobs?: Array<{ semanticKey?: string }> };
        npcs?: { io?: { memories?: Array<{ kind?: string; object?: string }> } };
      };
    };
  }
}

const WAIT_MS = 15_000;
const COLD_START_MS = 120_000;
const PHONE_VIEWPORT = { width: 390, height: 844 };

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beat}"]`),
    `visible dialogue should be stamped with beat ${beat}`,
  ).toBeVisible({ timeout: WAIT_MS });
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.getSnapshot?.().scene?.beat ?? null),
      { timeout: WAIT_MS, message: `window.__game should mirror visible beat ${beat}` },
    )
    .toBe(beat);
}

async function tapButton(page: Page, selector: string, label: string): Promise<void> {
  const button = page.locator(selector).first();
  await expect(button, `${label} should be visible and tappable`).toBeVisible({
    timeout: WAIT_MS,
  });
  await button.tap();
}

async function tapFirstOfferedJob(page: Page): Promise<string> {
  const offeredTray = page.locator("#offeredJobs");
  await expect(offeredTray).toBeVisible({ timeout: WAIT_MS });
  const button = offeredTray
    .locator("button[data-mloop-job-id][data-aftersign-job-take-action]:not([disabled])")
    .first();
  await expect(button, "an offered job should be visible and tappable").toBeVisible({
    timeout: WAIT_MS,
  });
  const actionId = (await button.getAttribute("data-aftersign-job-take-action")) ?? "";
  const jobId = (await button.getAttribute("data-mloop-job-id")) ?? "";
  expect(actionId, "offered job action id must be stamped").not.toBe("");
  expect(jobId, "offered job id must be stamped").not.toBe("");
  await button.tap();
  await expect(button, "tap should arm the exact offered-job button").toHaveAttribute(
    "data-aftersign-job-take",
    "armed",
  );
  const expectedLastAction = `${actionId}:${jobId}`;
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.interaction?.lastAction ?? null),
      { timeout: WAIT_MS, message: `tap should commit ${expectedLastAction}` },
    )
    .toBe(expectedLastAction);
  return expectedLastAction;
}

async function completePacketRoundAfterOffer(page: Page): Promise<void> {
  await tapButton(page, "#packetButton", "packet button");
  await waitForBeat(page, "packet-choice");
  await tapButton(page, "#acknowledgeRouteButton", "acknowledge route button");
  await tapButton(page, "#deliverButton", "deliver packet button");
  await waitForBeat(page, "packet-delivered");
  await waitForBeat(page, "io-return-recognition");
  await tapButton(page, "#deliverButton", "return-tone button");
  await waitForBeat(page, "return-tone-choice");
  await tapButton(page, "#deliverButton", "ask-for-next-job button");
  await waitForBeat(page, "io-next-job");
  await tapButton(page, "#deliverButton", "deliver next packet button");
  await waitForBeat(page, "packet-offered");
}

async function offeredFingerprints(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    window.__game?.getSnapshot?.().story?.offeredJobs
      ?.map((job) => job.semanticKey ?? "")
      .filter(Boolean)
      .sort() ?? [],
  );
}

test.describe("AFTERSIGN M-LOOP two-round phone playtest", () => {
  test("a phone player completes round one, returns to packet-offered, and sees a mechanically different second-round job set", async ({
    browser,
  }) => {
    test.setTimeout(COLD_START_MS);

    const context: BrowserContext = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });
    const slot = `m-loop-two-rounds-${Date.now()}`;
    const page = await context.newPage();

    try {
      await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(page);
      await waitForBeat(page, "packet-offered");

      const firstRoundFingerprints = await offeredFingerprints(page);
      expect(firstRoundFingerprints, "round one must publish offered-job fingerprints").not.toEqual([]);
      const firstLastAction = await tapFirstOfferedJob(page);

      await completePacketRoundAfterOffer(page);

      const secondRoundFingerprints = await offeredFingerprints(page);
      expect(secondRoundFingerprints, "round two must publish offered-job fingerprints").not.toEqual([]);
      expect(
        secondRoundFingerprints,
        "completed round-one memory must mechanically change the second-round offered actions",
      ).not.toEqual(firstRoundFingerprints);

      const secondLastAction = await tapFirstOfferedJob(page);
      expect(
        secondLastAction,
        "round two should commit a different offered action/job axis than round one",
      ).not.toBe(firstLastAction);

      const memoryKinds = await page.evaluate(() =>
        window.__game?.getSnapshot?.().npcs?.io?.memories?.map((fact) => fact.kind ?? "") ?? [],
      );
      expect(memoryKinds, "round one delivery must leave Io with durable memory facts").toContain(
        "delivery-outcome",
      );
    } finally {
      await context.close();
    }
  });
});
