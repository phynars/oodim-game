import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP-E1 offer route/risk visibility playtest.
//
// Real-tap divergence contract on the SERVED `#offeredJobs` surface:
// after a full loop that lands a `delivery-outcome:"sealed"` memory
// fact on Io, the packet-offered beat's route/risk `<p>` must swap
// from the first-run copy (`AFTERSIGN_JOB_OFFER_COPY.firstRun`) to
// the trusted-branch copy (`AFTERSIGN_JOB_OFFER_COPY.trusted`).
//
// Cold-start / wait budgets match the sibling `m-loop-divergence.
// playtest.spec.ts` (which drives an equivalent full loop and passes
// this lane's SwiftShader boot on CI):
//
//   const WAIT_MS       = 10_000;
//   const COLD_START_MS = 90_000; // widened from 45s below — a
//                                 // second-loop assertion pass this
//                                 // spec runs after the sibling's
//                                 // stopping point needs the same
//                                 // per-spec bound `mobile-move-pad-
//                                 // served-feel.spec.ts` uses on the
//                                 // aftersign lane's known cold-start
//                                 // shape (#700/#506/#590/#766).
//
// Every visibility expect passes `{ timeout: WAIT_MS }` explicitly —
// the default `expect` timeout is 5_000ms (see Playwright docs), and
// the aftersign lane's cold-start regularly jitters past 5s even on
// healthy hosts. The prior draft omitted the timeout on `getByText`
// asserts and paid the flake tax on review 4.
const WAIT_MS = 10_000;
const COLD_START_MS = 90_000;

const firstRoute = "Take the lit stair. Do not stop under the bell rope.";
const firstRisk = "Low risk. Long route. Io can see most of it from the kiosk.";
const trustedRoute =
  "Cross behind the shuttered pharmacy before the bells count twice.";
const trustedRisk =
  "Short route. Unlit. Better pay because Io trusts your hands.";

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

test("renders divergent route and risk copy after a player-tapped loop", async ({
  page,
}) => {
  test.setTimeout(COLD_START_MS);
  const slot = `offer-route-risk-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);

  await waitForBeat(page, "packet-offered");
  await expect(
    page.getByText(firstRoute, { exact: false }),
    "first-run route copy must be visible on the served offer surface",
  ).toBeVisible({ timeout: WAIT_MS });
  await expect(
    page.getByText(firstRisk, { exact: false }),
    "first-run risk copy must be visible on the served offer surface",
  ).toBeVisible({ timeout: WAIT_MS });

  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]').click();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");

  await waitForBeat(page, "packet-offered");
  await expect(
    page.getByText(trustedRoute, { exact: false }),
    "second-run trusted route copy must replace the first-run copy",
  ).toBeVisible({ timeout: WAIT_MS });
  await expect(
    page.getByText(trustedRisk, { exact: false }),
    "second-run trusted risk copy must replace the first-run copy",
  ).toBeVisible({ timeout: WAIT_MS });
  await expect(
    page.getByText(firstRoute, { exact: false }),
    "first-run route copy must be cleared on the second offer render",
  ).toHaveCount(0, { timeout: WAIT_MS });
  await expect(
    page.getByText(firstRisk, { exact: false }),
    "first-run risk copy must be cleared on the second offer render",
  ).toHaveCount(0, { timeout: WAIT_MS });
});
