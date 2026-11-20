import { expect, test, type Page } from "@playwright/test";
import { aftersignJobAcceptedLine } from "../src/ioLoopCopy.js";

// AFTERSIGN — real-tap proof for the GUARDED and FAILED offer branches
// (#2889, PR #2890 review F1/F2).
//
// `offeredJobsMemoryFromIoMemory` only leaves the completed / debt-held
// routing when Io durably remembers an EXPLICIT skipped route (the
// player tapped "skip-kiosk-acknowledge" at packet-choice):
//
//   sealed + skipped → { trustPosture: "guarded" } → job-low-risk-errand
//   opened + skipped → { priorOutcome: "failed" }  → job-redemption-route
//
// The sibling specs (job-offers-played, io-job-accepted-served,
// aftersign-mloop-two-round) walk "I listened" and must keep landing on
// the completed set; this spec walks the skipped route instead and taps
// the rendered offer, then asserts Io's acknowledgement line.

const WAIT_MS = 10_000;
const COLD_START_MS = 60_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
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

// Same hold + 12px pull gesture as `openPacketByGesture` in
// job-offer-debt-held-played.spec.ts: PacketIntentController commits
// OPENED through the real intent path.
async function openPacketByGesture(page: Page): Promise<void> {
  const packet = page.locator("#packetButton");
  await expect(packet).toBeVisible({ timeout: WAIT_MS });
  await page.evaluate(async () => {
    const node = document.querySelector<HTMLElement>("#packetButton");
    if (!node) throw new Error("#packetButton not found");
    const rect = node.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const pullPx = 12;
    const holdMs = 900;
    const fire = (type: string, x: number, buttons: number) =>
      node.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          button: 0,
          buttons,
          pointerType: "touch",
          isPrimary: true,
          clientX: x,
          clientY: startY,
        }),
      );
    fire("pointerdown", startX, 1);
    await new Promise((resolve) => setTimeout(resolve, Math.floor(holdMs / 2)));
    fire("pointermove", startX + pullPx, 1);
    await new Promise((resolve) => setTimeout(resolve, holdMs - Math.floor(holdMs / 2)));
    fire("pointerup", startX + pullPx, 0);
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function skipRouteAndLoop(page: Page): Promise<void> {
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "skip-kiosk-acknowledge");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await tapReturnReason(page, "blunt");
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
}

async function startFirstLoop(page: Page, slot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
  const safeOffer = page.locator("#job-offer-job-safe-delivery");
  await expect(safeOffer).toBeVisible({ timeout: WAIT_MS });
  await safeOffer.click();
}

async function tapOfferAndExpectAck(page: Page, jobId: string): Promise<void> {
  const offer = page.locator(`#job-offer-${jobId}`);
  await expect(
    offer,
    `#job-offer-${jobId} should render on the looped return`,
  ).toBeVisible({ timeout: WAIT_MS });
  await offer.click();
  const ack = page.locator("#jobTakeAckLine");
  await expect(ack).toBeVisible({ timeout: WAIT_MS });
  await expect(ack).toHaveAttribute("data-aftersign-job-take-ack", jobId);
  await expect(ack).toHaveText(aftersignJobAcceptedLine(jobId));
}

test.describe("AFTERSIGN guarded / failed offered jobs — real-tap played divergence", () => {
  test("a sealed delivery with a skipped route offers the guarded low-risk errand", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await startFirstLoop(page, `job-offer-guarded-played-${Date.now()}`);
    await page.locator("#packetButton").click();
    await skipRouteAndLoop(page);

    await expect(
      page.locator("#job-offer-job-night-transfer"),
      "a skipped route must not reach the completed set",
    ).toHaveCount(0);
    await tapOfferAndExpectAck(page, "job-low-risk-errand");
  });

  test("an opened delivery with a skipped route offers the failed redemption route", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await startFirstLoop(page, `job-offer-failed-played-${Date.now()}`);
    await openPacketByGesture(page);
    await skipRouteAndLoop(page);

    await expect(
      page.locator("#job-offer-job-wax-debt-repair"),
      "an opened delivery with a skipped route is a failed run, not debt-held",
    ).toHaveCount(0);
    await tapOfferAndExpectAck(page, "job-redemption-route");
  });
});
