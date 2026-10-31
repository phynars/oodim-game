import { expect, test, type Locator, type Page } from "@playwright/test";

import { performPacketGesture } from "./helpers/packetGesture";

// Verbatim from `aftersign/src/packetChoiceAffordance.js` (same literal as
// packet-choice-affordance-served.spec.ts AFFORDANCE_LINE).
const STALE_PROMPT = "Choose before you leave: Io will remember whether the seal stayed whole.";
// Verbatim `returned` line from `aftersign/src/ioLedgerLine.ts` (same literal
// as io-ledger-line-served.spec.ts LEDGER_LINE_BY_FACT.returned).
const STALE_LEDGER_LINE = "You came back. I kept the work that remembers that.";

const WAIT_MS = 60_000;
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const button: Locator = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(button).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

async function runOpenedPacketToEnding(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await performPacketGesture(page, "opened");
  await waitForBeat(page, "packet-choice");
  // Positive precondition (review AI003): the affordance prompt renders on
  // packet-choice, so the post-ending absence check proves the ending clears it.
  await expect(page.locator("body")).toContainText(STALE_PROMPT, { timeout: WAIT_MS });
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  const returnTone = page.locator('button[data-return-reason="kind"]:not([disabled])').first();
  await expect(returnTone).toBeVisible({ timeout: WAIT_MS });
  await returnTone.click();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  // Positive precondition (review AI003): Io's `returned` ledger line renders
  // on io-next-job, before the ending commits.
  await expect(page.locator("body")).toContainText(STALE_LEDGER_LINE, { timeout: WAIT_MS });
  await tapChoice(page, "accept-second-packet");
  await tapChoice(page, "light-vigil");
  await expect(page.locator("#episodeOneEnding [data-ending-id]").first()).toBeVisible({ timeout: WAIT_MS });
}

test("opened-packet ending removes stale prompt and returning-session ledger copy from the visible page", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize(PHONE_VIEWPORT);
  await page.goto(`/aftersign/?slot=ending-no-stale-copy-${Date.now()}`, { waitUntil: "load" });
  await waitForBeat(page, "packet-offered");

  await runOpenedPacketToEnding(page);

  await expect(page.locator("body")).not.toContainText(STALE_PROMPT);
  await expect(page.locator("body")).not.toContainText(STALE_LEDGER_LINE);
});
