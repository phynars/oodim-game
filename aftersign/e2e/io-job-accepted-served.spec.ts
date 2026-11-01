import { expect, test, type Page } from "@playwright/test";

import { ioJobAcceptedLine } from "../src/ioJobAcceptedCopy.js";
import {
  selectIoJobOffers,
  type PlayerMemory,
} from "../../packages/aftersign/src/computeOfferedJobs";

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

interface GameWindow extends Window {
  __game?: {
    scene?: { ready?: boolean };
    interaction?: { lastAction?: string | null };
  };
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as GameWindow).__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should visibly reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(
    choice,
    `choice "${choiceId}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `return-tone "${reason}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

async function readLineTextContent(page: Page): Promise<string | null> {
  return await page.locator("#line").textContent();
}

test.describe("AFTERSIGN Io job-accepted sibling paragraph (played)", () => {
  test("tapping the safe-default offer stamps exactly one canonical accepted-receipt line; the looped-return night-transfer offer restamps it — and neither overwrites #line", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `io-job-accepted-served-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    await waitForBeat(page, "packet-offered");
    const preTapLineText = await readLineTextContent(page);

    const safeOffer = page.locator("#job-offer-job-safe-delivery");
    await expect(
      safeOffer,
      "safe-default offered job should render on the first visit",
    ).toBeVisible({ timeout: WAIT_MS });
    const freshOffer = selectIoJobOffers(undefined).find(
      (o) => o.id === "job-safe-delivery",
    );
    if (!freshOffer) {
      throw new Error(
        "selectIoJobOffers(undefined) must include the safe-default offer",
      );
    }
    const safeLabel = freshOffer.label;
    await safeOffer.click();

    const acceptedLine = page.locator("#ioJobAcceptedLine");
    await expect(
      acceptedLine,
      "exactly one canonical accepted-receipt paragraph must be present inside #offeredJobs after the offer tap",
    ).toHaveCount(1);
    await expect(acceptedLine).toBeVisible({ timeout: WAIT_MS });
    await expect(acceptedLine).toHaveAttribute(
      "data-aftersign-io-job-accepted-line",
      "job-safe-delivery",
    );
    const expectedFirstRunText = ioJobAcceptedLine(safeLabel);
    await expect(acceptedLine).toHaveText(expectedFirstRunText);

    const acceptedInsideTray = page.locator(
      "#offeredJobs #ioJobAcceptedLine",
    );
    await expect(
      acceptedInsideTray,
      "canonical accepted-receipt line must be a descendant of #offeredJobs",
    ).toHaveCount(1);

    const postTapLineText = await readLineTextContent(page);
    expect(
      postTapLineText,
      "#line.textContent must not be overwritten with the accepted-receipt line — it belongs to ioRecognitionDialogue.RETURNING_LINES",
    ).not.toBe(expectedFirstRunText);
    expect(postTapLineText).toBe(preTapLineText);

    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await tapReturnReason(page, "blunt");
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    await waitForBeat(page, "packet-offered");
    const nightTransferOffer = page.locator("#job-offer-job-night-transfer");
    await expect(
      nightTransferOffer,
      "completed-set night-transfer offer should render after a sealed delivery",
    ).toBeVisible({ timeout: WAIT_MS });
    const loopedMemory: PlayerMemory = { priorOutcome: "completed" };
    const loopedOffer = selectIoJobOffers(loopedMemory).find(
      (o) => o.id === "job-night-transfer",
    );
    if (!loopedOffer) {
      throw new Error(
        "selectIoJobOffers(completed) must include the night-transfer offer",
      );
    }
    const nightTransferLabel = loopedOffer.label;
    await nightTransferOffer.click();

    await expect(acceptedLine).toHaveCount(1);
    await expect(acceptedLine).toHaveAttribute(
      "data-aftersign-io-job-accepted-line",
      "job-night-transfer",
    );
    const expectedLoopedText = ioJobAcceptedLine(nightTransferLabel);
    await expect(acceptedLine).toHaveText(expectedLoopedText);

    expect(
      expectedLoopedText,
      "visible accepted-receipt line must diverge between first visit and looped return",
    ).not.toBe(expectedFirstRunText);
    await expect(
      page.getByText(expectedFirstRunText, { exact: true }),
      "first-visit accepted-receipt line must NOT linger after the looped restamp",
    ).toHaveCount(0);
  });
});
