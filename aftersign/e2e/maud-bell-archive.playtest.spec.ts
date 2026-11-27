import { expect, test, type Browser, type Page } from "@playwright/test";

// Served phone reachability and pending-feedback regression coverage for #3084 and #3124.
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

async function holdNextAuthoritativeSave(page: Page) {
  let sawSave!: () => void;
  let releaseSave!: () => void;
  let completed!: () => void;
  const saved = new Promise<void>((resolve) => { sawSave = resolve; });
  const released = new Promise<void>((resolve) => { releaseSave = resolve; });
  const finished = new Promise<void>((resolve) => { completed = resolve; });
  const handler = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "PUT") return route.continue();
    sawSave();
    await released;
    await route.continue();
    completed();
  };
  await page.route("**/aftersign/save/**", handler);
  return {
    waitUntilHeld: () => saved,
    release: async () => {
      releaseSave();
      await finished;
      await page.unroute("**/aftersign/save/**", handler);
    },
  };
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
  const deliverPacket = page.getByRole("button", { name: "Deliver packet" });
  await expect(deliverPacket).toBeInViewport({ ratio: 1 });
  await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
}

// The fresh context clears localStorage, so on game.oodim.com (a non-local
// host) resolvePlayerId would mint a NEW visitor id and read a different save
// (#2696). Pin the same player id via `?player=` in both contexts so the
// restore check addresses the save the first context wrote.
function slotUrl(slot: string, playerId: string): string {
  return `/aftersign/?slot=${slot}&player=${playerId}`;
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
      const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const slot = `maud-bell-archive-${choice}-${runId}`;
      const playerId = `e2e-maud-bell-${choice}-${runId}`;
      await page.goto(slotUrl(slot, playerId), { waitUntil: "load" });
      await reachOrraPayback(page);

      const carryName = page.locator(
        'button[data-orra-payback-action="carry-name-to-bell-archive"]',
      );
      await expect(carryName).toBeVisible({ timeout: WAIT_MS });
      await expect(carryName).toBeEnabled({ timeout: WAIT_MS });
      const carrySave = await holdNextAuthoritativeSave(page);
      await carryName.tap();
      await carrySave.waitUntilHeld();
      await expect(carryName).toHaveAttribute("data-pending", "true");
      await expect(carryName).toHaveAttribute("aria-busy", "true");
      await expect(carryName).toHaveText("Carrying name…");
      await carrySave.release();

      const nameButton = page.locator(`button[data-maud-name-choice="${choice}"]`);
      await expect(nameButton).toBeVisible({ timeout: WAIT_MS });
      await expect(nameButton).toBeInViewport({ ratio: 1 });
      // Phone-first story: a real touch tap, same as orra-payback.playtest.spec.ts.
      await expect(nameButton).toBeEnabled({ timeout: WAIT_MS });
      const nameSave = await holdNextAuthoritativeSave(page);
      await nameButton.tap();
      await nameSave.waitUntilHeld();
      await expect(nameButton).toHaveAttribute("data-pending", "true");
      await expect(nameButton).toHaveAttribute("aria-busy", "true");
      await expect(nameButton).toHaveText("Saving name…");
      await nameSave.release();

      const unlitDoor = page.getByRole("button", { name: "Go to the Unlit Door" });
      await expect(unlitDoor).toBeInViewport({ ratio: 1 });

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

      await unlitDoor.tap();
      const doorChoice = page.locator('button[data-choice-id="keep-official-record"]');
      await expect(doorChoice).toBeVisible({ timeout: WAIT_MS });
      const doorSave = await holdNextAuthoritativeSave(page);
      await doorChoice.tap();
      await doorSave.waitUntilHeld();
      await expect(doorChoice).toHaveAttribute("data-pending", "true");
      await expect(doorChoice).toHaveAttribute("aria-busy", "true");
      await expect(doorChoice).toHaveText("Saving choice…");
      await doorSave.release();

      const beginEpisodeTwo = page.locator("#beginEpisodeTwo");
      await expect(beginEpisodeTwo).toBeVisible({ timeout: WAIT_MS });
      const beginSave = await holdNextAuthoritativeSave(page);
      await beginEpisodeTwo.tap();
      await beginSave.waitUntilHeld();
      await expect(beginEpisodeTwo).toHaveAttribute("data-pending", "true");
      await expect(beginEpisodeTwo).toHaveAttribute("aria-busy", "true");
      await expect(beginEpisodeTwo).toHaveText("Opening Night Post…");
      await beginSave.release();

      const acceptLedgerRun = page.locator("#acceptEpisodeTwoJob");
      await expect(acceptLedgerRun).toBeVisible({ timeout: WAIT_MS });
      const acceptSave = await holdNextAuthoritativeSave(page);
      await acceptLedgerRun.tap();
      await acceptSave.waitUntilHeld();
      await expect(acceptLedgerRun).toHaveAttribute("data-pending", "true");
      await expect(acceptLedgerRun).toHaveAttribute("aria-busy", "true");
      await expect(acceptLedgerRun).toHaveText("Accepting…");
      await acceptSave.release();

    });
  }
});
