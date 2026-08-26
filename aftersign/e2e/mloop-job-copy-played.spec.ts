import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN — M-LOOP per-jobId copy + memory-gated action id,
// real-tap played.  Sibling of `job-offers-played.spec.ts`; that spec
// pins the SELECTION axis (which jobIds render at packet-offered);
// this spec pins the AUTHORING axis added by PR #1422 — the
// `data-mloop-*` attributes each offered button carries, and the
// composed `lastAction` (`${mloopAction.id}:${jobId}`) each REAL tap
// commits.
//
// The played flow mirrors `job-offers-played.spec.ts`:
//
//   FIRST VISIT (packet.delivered === false — mloopMemory = {}, gate
//                = "fresh")
//     • `#job-offer-job-safe-delivery` renders.
//     • The button carries `data-mloop-job-id="job-safe-delivery"`,
//       `data-mloop-memory-gate="fresh"`, and a non-empty
//       `aria-label`.
//     • Tapping it stamps
//       `lastAction === "mloop-safe-delivery-take:job-safe-delivery"`.
//
//   LOOPED RETURN (packet.delivered === true — mloopMemory carries
//                  the delivery-outcome fact, gate = "returning" for
//                  a sealed delivery)
//     • `#job-offer-job-night-transfer` renders.
//     • The button carries `data-mloop-job-id="job-night-transfer"`,
//       `data-mloop-memory-gate="returning"`, and its own non-empty
//       `aria-label`.
//     • Tapping it stamps `lastAction ===
//       "mloop-night-transfer-take-again:job-night-transfer"`.
//
// All input is REAL taps against visible, non-disabled buttons — no
// harness overrides, no `__game.input.setPlayerMemory`, no
// `forceReload`.  `lastAction` is read off `window.__game.interaction`
// only to assert; nothing drives it directly.

const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

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

async function readLastAction(page: Page): Promise<string | null> {
  return await page.evaluate(
    () =>
      (window as unknown as GameWindow).__game?.interaction?.lastAction ??
      null,
  );
}

test.describe("AFTERSIGN M-LOOP job copy — real-tap played authoring", () => {
  test("first-visit safe-default carries fresh mloop attrs; looped-return night-transfer carries the returning gate", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `mloop-job-copy-played-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // ─────────────────────────────────────────────────────────────
    // FIRST VISIT — mloopMemory is {} (no packet-outcome fact), so
    // getMloopAvailableAction gates on "fresh".  The safe-default
    // button carries the fresh mloop attrs; tapping it stamps the
    // composed lastAction axis.
    // ─────────────────────────────────────────────────────────────
    await waitForBeat(page, "packet-offered");
    const safeOffer = page.locator("#job-offer-job-safe-delivery");
    await expect(
      safeOffer,
      "safe-default offered job should render on the first visit",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      safeOffer,
      "PR #1422: mloop-job-id attribute must land on the offered button",
    ).toHaveAttribute("data-mloop-job-id", "job-safe-delivery");
    await expect(
      safeOffer,
      "PR #1422: memory gate on a first visit (no delivery-outcome fact) must be `fresh`",
    ).toHaveAttribute("data-mloop-memory-gate", "fresh");
    const safeAriaLabel = await safeOffer.getAttribute("aria-label");
    expect(
      safeAriaLabel,
      "PR #1422: aria-label must be an authored non-empty string",
    ).toBeTruthy();

    await safeOffer.click();
    await expect
      .poll(
        () => readLastAction(page),
        {
          message:
            "PR #1422: tapping the safe-default offer stamps lastAction as `${mloopAction.id}:${jobId}`",
          timeout: WAIT_MS,
        },
      )
      .toBe("mloop-safe-delivery-take:job-safe-delivery");

    // Play through: packet tap → route ack → deliver → recognition →
    // blunt tone → ask-for-next-job → deliver.  After the second
    // deliver-packet the flow re-enters `packet-offered` with a
    // durable delivery-outcome fact, so mloopMemory's packetOutcome
    // is "sealed" (the played path keeps the packet sealed) and the
    // memory gate flips to "returning".
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

    // ─────────────────────────────────────────────────────────────
    // LOOPED RETURN — packet-outcome fact is `sealed`, gate flips to
    // "returning", and the completed-set button carries the returning
    // mloop attrs.  Tapping it stamps the composed lastAction with the
    // `-again` action id.
    // ─────────────────────────────────────────────────────────────
    await waitForBeat(page, "packet-offered");
    const nightTransferOffer = page.locator("#job-offer-job-night-transfer");
    await expect(
      nightTransferOffer,
      "completed-set night-transfer offer should render after a delivery",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      nightTransferOffer,
      "PR #1422: mloop-job-id attribute must land on the completed-set button",
    ).toHaveAttribute("data-mloop-job-id", "job-night-transfer");
    await expect(
      nightTransferOffer,
      "PR #1422: memory gate must flip to `returning` after a sealed delivery",
    ).toHaveAttribute("data-mloop-memory-gate", "returning");
    const nightAriaLabel = await nightTransferOffer.getAttribute("aria-label");
    expect(
      nightAriaLabel,
      "PR #1422: aria-label must be an authored non-empty string on the completed-set button",
    ).toBeTruthy();

    await nightTransferOffer.click();
    await expect
      .poll(
        () => readLastAction(page),
        {
          message:
            "PR #1422: tapping the night-transfer offer stamps lastAction with the returning-gate action id",
          timeout: WAIT_MS,
        },
      )
      .toBe("mloop-night-transfer-take-again:job-night-transfer");
  });
});
