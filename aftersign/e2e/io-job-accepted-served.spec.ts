import { expect, test, type Page } from "@playwright/test";

import { ioJobAcceptedLine } from "../src/ioJobAcceptedCopy.js";
// The runtime consumer in `aftersign/main.js` reads `offer.label` from
// the offer object `selectIoJobOffers(memory)` returns and passes it
// to `ioJobAcceptedLine(...)`. Sourcing the label from the SAME
// selector here keeps the served stamp + this assertion on ONE table
// — no hard-coded duplicate, and no coupling to the rendered button's
// composite `${label} · ${risk} risk` textContent.
import {
  selectIoJobOffers,
  type PlayerMemory,
} from "../../packages/aftersign/src/computeOfferedJobs";

// AFTERSIGN — PR #1883 (Ivy's REQUEST_CHANGES). Tap-driven proof that
// Io's job-accepted receipt line reaches the served page as a
// player-visible sibling paragraph inside the `#offeredJobs` tray.
//
// Same shape as `io-loop-consequence-line-served.spec.ts` (sibling
// `#ioConsequenceLine` paragraph inside `#offeredJobs`) and
// `io-voice-served.spec.ts` (sibling `#ioReturnLine` next to `#line`):
// the shipped consumer stamps the selected copy module literal into
// ITS OWN paragraph, and this spec pins the visible textContent
// verbatim per offer branch.
//
// Second-source-of-truth guard: `#line.textContent` and
// `state.npcs.io.lastLine` at the recognition beat are OWNED by
// `aftersign/src/ioRecognitionDialogue.ts::RETURNING_LINES` (pinned by
// `flagship-surface-contract.spec.ts:514` on
// `returning.npcs.io.lastLine` and by
// `flagship-reload-beat-regression.spec.ts:128` on
// `afterReload.npcs.io.lastLine`). This spec therefore asserts the
// receipt literal against `#ioJobAcceptedLine` — the SIBLING paragraph
// the served renderer inserts inside `#offeredJobs` — and never
// touches `#line.textContent`.
//
// PLAYED-NOT-DRIVEN: input is a real click on the visible offer
// button (`#job-offer-<jobId>`), never `window.__game.input.choose(...)`.
// The tap script for the LOOPED-RETURN branch is the same one
// `mloop-job-copy-played.spec.ts` uses to reach the completed-set
// `job-night-transfer` offer.

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
  test("tapping the safe-default offer stamps the accepted-receipt line into #ioJobAcceptedLine; the looped-return night-transfer offer restamps it — and neither overwrites #line", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `io-job-accepted-served-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // ─────────────────────────────────────────────────────────────
    // FIRST VISIT — real tap on the safe-default offer stamps the
    // sibling paragraph with the safe-label receipt line, and does
    // NOT overwrite #line (recognition-dialogue owned).
    // ─────────────────────────────────────────────────────────────
    await waitForBeat(page, "packet-offered");
    const preTapLineText = await readLineTextContent(page);

    const safeOffer = page.locator("#job-offer-job-safe-delivery");
    await expect(
      safeOffer,
      "safe-default offered job should render on the first visit",
    ).toBeVisible({ timeout: WAIT_MS });
    // Resolve `offer.label` from the canonical selector — the SAME
    // source the runtime consumer in `aftersign/main.js` reads. The
    // rendered button textContent is `"${label} · ${risk} risk"`
    // (see `offeredJobsTapTargetFeel.consumer.test.ts` for the exact
    // stamp shape), so reading it off the DOM would corrupt the
    // acceptance literal — this way copy-only drift stays green and
    // a structural rename reds beside the sibling contract tests.
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
      "sibling #ioJobAcceptedLine paragraph must be present inside #offeredJobs after the offer tap",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(acceptedLine).toHaveAttribute(
      "data-aftersign-io-job-accepted-line",
      "job-safe-delivery",
    );
    const expectedFirstRunText = ioJobAcceptedLine(safeLabel);
    await expect(acceptedLine).toHaveText(expectedFirstRunText);

    // The sibling paragraph must live INSIDE the shipped #offeredJobs
    // tray — same container the sibling #ioConsequenceLine node uses,
    // not a stray body-level element.
    const acceptedInsideTray = page.locator(
      "#offeredJobs #ioJobAcceptedLine",
    );
    await expect(
      acceptedInsideTray,
      "sibling #ioJobAcceptedLine must be a descendant of #offeredJobs",
    ).toBeVisible({ timeout: WAIT_MS });

    // Contract preservation: `#line.textContent` at packet-offered is
    // owned by the recognition-dialogue module and MUST NOT be
    // overwritten by the offer tap. Its text may still be null/empty
    // at this beat, but it must NOT equal the accepted-receipt line.
    const postTapLineText = await readLineTextContent(page);
    expect(
      postTapLineText,
      "#line.textContent must not be overwritten with the accepted-receipt line — it belongs to ioRecognitionDialogue.RETURNING_LINES",
    ).not.toBe(expectedFirstRunText);
    // And it should not have been mutated at all by the offer tap.
    expect(postTapLineText).toBe(preTapLineText);

    // Play through one full loop to reach the completed-set night-
    // transfer offer, keeping the packet SEALED so the memory gate
    // flips to "returning".
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
    // LOOPED RETURN — night-transfer offer restamps the sibling
    // paragraph with the returning-branch label; the previous safe
    // literal is gone.
    // ─────────────────────────────────────────────────────────────
    await waitForBeat(page, "packet-offered");
    const nightTransferOffer = page.locator("#job-offer-job-night-transfer");
    await expect(
      nightTransferOffer,
      "completed-set night-transfer offer should render after a sealed delivery",
    ).toBeVisible({ timeout: WAIT_MS });
    // Same discipline as the first-run branch: resolve the label
    // from the canonical selector for the sealed-return memory
    // branch (`priorOutcome: "completed"` — see
    // `offeredJobsTapTargetFeel.consumer.test.ts`).
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

    await expect(acceptedLine).toHaveAttribute(
      "data-aftersign-io-job-accepted-line",
      "job-night-transfer",
    );
    const expectedLoopedText = ioJobAcceptedLine(nightTransferLabel);
    await expect(acceptedLine).toHaveText(expectedLoopedText);

    // Divergence proof: the two runs' visible literals differ, and
    // the first-run literal no longer lingers on the looped page.
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
