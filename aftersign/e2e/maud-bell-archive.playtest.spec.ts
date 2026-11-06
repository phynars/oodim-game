import { expect, test, type Browser, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(
    `button[data-choice-id="${choiceId}"]:not([disabled])`,
  );
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

async function openFreshContext(browser: Browser, slot: string) {
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
  // The fresh context clears localStorage, so on game.oodim.com (a
  // non-local host) resolvePlayerId would mint a NEW visitor id and read a
  // different save (#2696). Pin the same player id via `?player=` in both
  // contexts so the restore check addresses the save the first context wrote.
  await page.goto(`/aftersign/?slot=${slot}&player=${slot}`, { waitUntil: "load" });
  return { context, page };
}

const CASES = [
  {
    choice: "remembered-name",
    endingId: "maud-bell-archive-lit",
    light: "lit",
    lightText: "The district light stays lit.",
  },
  {
    choice: "archive-decoy",
    endingId: "maud-bell-archive-dark",
    light: "out",
    lightText: "One district light goes out.",
  },
] as const;

test.describe("Maud Bell Archive endings (#2652)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  for (const { choice, endingId, light, lightText } of CASES) {
    test(`tapping ${choice} rings and restores ${endingId}`, async ({
      page,
      browser,
    }) => {
      test.setTimeout(240_000);
      // slot doubles as the player id; it matches PLAYER_ID_PATTERN.
      const slot = `maud-bell-archive-${choice}-${Date.now()}`;
      await page.goto(`/aftersign/?slot=${slot}&player=${slot}`, { waitUntil: "load" });
      await reachOrraPayback(page);

      await tapVisible(
        page,
        'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])',
      );

      const nameButton = page.locator(`button[data-maud-name-choice="${choice}"]`);
      await expect(nameButton).toBeVisible({ timeout: WAIT_MS });
      await nameButton.tap();

      // Bell Archive outcome: the scene module stamps matched/unmatched on
      // the scene once the real touch resolves the name against memory.
      await expect(page.locator('[data-beat="maud-bell-archive"]')).toHaveAttribute(
        "data-bell-archive-outcome",
        light === "lit" ? "matched" : "unmatched",
      );
      const liveCard = page.locator(`[data-ending-id="${endingId}"]`);
      await expect(liveCard).toBeVisible({ timeout: WAIT_MS });
      await expect(liveCard).toHaveAttribute("data-district-light", light);
      await expect(liveCard).toHaveAttribute("data-bell-ringing", "true");

      // Persist-before-card: the card only renders after persistence settles,
      // so the first fresh context must already restore it — no retry loop.
      const { context, page: returning } = await openFreshContext(browser, slot);
      try {
        const restoredCard = returning.locator(`[data-ending-id="${endingId}"]`);
        await expect(restoredCard).toBeVisible({ timeout: WAIT_MS });
        await expect(restoredCard).toHaveAttribute("data-district-light", light);
        await expect(restoredCard).toContainText("Act II — Bell Archive");
        await expect(restoredCard).toContainText(lightText);
        await expect(returning.locator("[data-maud-name-choice]")).toHaveCount(0);
        await expect(returning.locator('[data-beat="maud-bell-archive"]')).toHaveCount(0);
      } finally {
        await context.close();
      }
    });
  }
});
