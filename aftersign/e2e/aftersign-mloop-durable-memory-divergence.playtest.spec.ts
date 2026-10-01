import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

type DurableRecord = {
  slot: string;
  firstRoundJobIds: string[];
  secondRoundJobIds: string[];
};

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`);
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function playRound(page: Page, jobId?: string): Promise<string[]> {
  await waitForBeat(page, "packet-offered");
  const tray = page.locator("#offeredJobs");
  const jobs = tray.locator("button[data-offered-job-id]");
  const offeredJobIds = await jobs.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("data-offered-job-id") ?? ""),
  );

  const selectedJob = jobId
    ? tray.locator(`button[data-offered-job-id="${jobId}"]`)
    : jobs.first();
  await expect(selectedJob).toBeVisible({ timeout: WAIT_MS });
  await selectedJob.tap();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");

  await waitForBeat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");

  return offeredJobIds;
}

async function playTwoRounds(page: Page, slot: string): Promise<DurableRecord> {
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);

  const firstRoundJobIds = await playRound(page);
  const secondRoundJobIds = await playRound(page, "job-night-transfer");

  return { slot, firstRoundJobIds, secondRoundJobIds };
}

test.describe("AFTERSIGN M-LOOP durable-memory job divergence", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("two durable records expose divergent served job actions after two played rounds", async ({ page }) => {
    test.setTimeout(90_000);
    const seed = Date.now();

    const first = await playTwoRounds(page, `mloop-durable-a-${seed}`);
    const second = await playTwoRounds(page, `mloop-durable-b-${seed}`);

    expect(first.slot).not.toBe(second.slot);
    expect(first.firstRoundJobIds).toEqual(["job-safe-default"]);
    expect(second.firstRoundJobIds).toEqual(["job-safe-default"]);
    expect(first.secondRoundJobIds).toEqual(["job-night-transfer", "job-signed-receipt"]);
    expect(second.secondRoundJobIds).toEqual(["job-night-transfer", "job-signed-receipt"]);
    expect(first.firstRoundJobIds).not.toEqual(first.secondRoundJobIds);
    expect(second.firstRoundJobIds).not.toEqual(second.secondRoundJobIds);
  });
});
