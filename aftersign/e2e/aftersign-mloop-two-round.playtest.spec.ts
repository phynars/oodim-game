import { expect, test, type Page } from "@playwright/test";
import { performPacketGesture, type PacketOutcome } from "./helpers/packetGesture";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

type JobOfferSet = readonly string[];

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

async function offeredJobIds(page: Page): Promise<JobOfferSet> {
  const jobs = page.locator("#offeredJobs button[data-offered-job-id]");
  await expect(jobs.first()).toBeVisible({ timeout: WAIT_MS });
  return jobs.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("data-offered-job-id") ?? ""),
  );
}

async function completeRound(
  page: Page,
  jobId: string,
  packetOutcome: PacketOutcome,
): Promise<void> {
  await page.locator(`#offeredJobs button[data-offered-job-id="${jobId}"]`).tap();
  await performPacketGesture(page, packetOutcome, WAIT_MS);
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
}

async function playTwoRounds(
  page: Page,
  slot: string,
  firstPacketOutcome: PacketOutcome,
  expectedMemory: string,
): Promise<{
  fresh: JobOfferSet;
  completed: JobOfferSet;
}> {
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");

  const fresh = await offeredJobIds(page);
  await expect(page.locator("#offeredJobs")).toHaveAttribute(
    "data-mloop-divergence-memory",
    "fresh",
  );
  await completeRound(page, fresh[0], firstPacketOutcome);

  const completed = await offeredJobIds(page);
  await expect(page.locator("#offeredJobs")).toHaveAttribute(
    "data-mloop-divergence-memory",
    expectedMemory,
  );
  await expect(completed).not.toEqual(fresh);
  await completeRound(page, completed[0], "sealed");

  return { fresh, completed };
}

test.describe("AFTERSIGN M-LOOP durable-memory divergence", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("two durable records expose divergent visible job actions after played rounds", async ({ page }) => {
    test.setTimeout(180_000);
    const runId = Date.now();
    const sealedRecord = await playTwoRounds(
      page,
      `mloop-durable-sealed-${runId}`,
      "sealed",
      "completed",
    );
    const openedRecord = await playTwoRounds(
      page,
      `mloop-durable-opened-${runId}`,
      "opened",
      "debt-held",
    );

    // The two distinct durable records begin from the same visible action,
    // then diverge because one sealed and one opened its first packet.
    // Their completed offer sets are rendered, observed, and tapped.
    await expect(sealedRecord.completed).not.toEqual(openedRecord.completed);
    await expect(sealedRecord.fresh).toEqual(openedRecord.fresh);
  });
});
