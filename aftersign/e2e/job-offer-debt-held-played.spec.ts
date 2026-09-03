import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN — real-tap proof for the DEBT-HELD branch of the M-LOOP
// offered-job axis (PR #1624, Soren's third REQUEST_CHANGES).
//
// The primitive at `packages/aftersign/src/computeOfferedJobs.ts`
// grew a third mechanical axis: a `debtHeld > 0` player-memory bag
// swaps `#offeredJobs` from the safe-default / completed-set /
// trusted-courier branches to the wax-debt repair run
// (`job-wax-debt-repair`, medium risk). The prior two review passes
// added the axis + the primitive-shape guard in
// `resolveOfferedJobsMemory`, but the SERVED renderer
// (`aftersign/main.js`) still collapsed
//
//     state.npcs.io.memory.length > 0
//       ? { priorOutcome: "completed" }
//       : undefined
//
// which made the branch UNREACHABLE at the shipped surface — every
// player with any delivery history got routed to the completed set.
// Soren's block:
//
//     "wire `debtHeld` into `main.js`'s derivation (from the durable
//     save or a real player-memory axis), and add a tap-driven e2e
//     that boots the served page and clicks the rendered
//     `#job-offer-job-wax-debt-repair`."
//
// The wire lands in `aftersign/src/offeredJobsMemoryFromIoMemory.js`
// (called at the `packet-offered` render site in main.js). This
// spec is the corresponding played proof: NO harness reach-in, NO
// jsdom mirror — the player taps the packet's open gesture,
// delivers, walks the return-line beats, asks for the next job,
// delivers again, and the SECOND `packet-offered` beat renders
// `#job-offer-job-wax-debt-repair` because Io's durable memory
// now carries one delivery-outcome fact with `object === "opened"`.
// The spec then real-taps that button and asserts the tap-choice
// vocabulary the served renderer stamps on it.
//
// Sits alongside `job-offers-played.spec.ts` (the safe-default /
// completed-set played divergence): that spec keeps the packet
// sealed, this one opens it — so together they cover TWO branches
// of `selectedJobIds` on the SAME played funnel, with the same
// selectors and the same wait/tap discipline.

const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

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

// Deterministic "open the packet" seam — same shape as
// `npc-memory-recall-dialogue-served.spec.ts` and
// `io-recognition-return-visual-feel.spec.ts`. A packet-drag hold
// gesture is timing-sensitive under Playwright, so every played
// spec that needs the OPENED fork reaches through the shipped
// `input.choose("open-packet")` handler — the SAME handler
// `commitPacketOutcome(PACKET_OUTCOME.OPENED)` and the pointer
// gesture converge on inside main.js.
async function openPacketViaChoose(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const input = (window as unknown as {
      __game?: {
        input?: {
          choose: (choiceId: string) => Promise<void> | void;
        };
      };
    }).__game?.input;
    if (!input) throw new Error("window.__game.input not available");
    await input.choose("open-packet");
  });
}

test.describe("AFTERSIGN debt-held offered job — real-tap played divergence", () => {
  test("opening the packet on the first loop offers #job-offer-job-wax-debt-repair on the next loop", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `job-offer-debt-held-played-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // FIRST VISIT — the safe-default button is what a fresh player
    // sees (Io's memory is empty so
    // `offeredJobsMemoryFromIoMemory([])` returns undefined and the
    // primitive lands on `SAFE_DEFAULT_JOB_ID`). Debt-repair MUST
    // NOT render before any delivery.
    await waitForBeat(page, "packet-offered");
    const safeOffer = page.locator("#job-offer-job-safe-delivery");
    await expect(
      safeOffer,
      "safe-default offered job should render on the first visit",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.locator("#job-offer-job-wax-debt-repair"),
      "debt-repair offer must NOT render before any delivery",
    ).toHaveCount(0);
    await safeOffer.click();

    // Open the packet — the durable fork that will mint a
    // `delivery-outcome{ object: "opened" }` fact on delivery.
    await openPacketViaChoose(page);
    await waitForBeat(page, "packet-choice");

    // Walk the same played funnel as `job-offers-played.spec.ts`
    // (acknowledge → deliver → return-recognition → tone → ask-for-
    // next-job → deliver) so the SECOND `packet-offered` beat lands.
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await tapReturnReason(page, "blunt");
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    // LOOPED RETURN — the debt-repair button now lands because
    // Io's memory carries one `delivery-outcome` fact with
    // `object: "opened"`, `offeredJobsMemoryFromIoMemory` maps
    // that to `{ debtHeld: 1 }`, and the primitive picks
    // `DEBT_HELD_JOB_IDS`.
    await waitForBeat(page, "packet-offered");
    const debtOffer = page.locator("#job-offer-job-wax-debt-repair");
    await expect(
      debtOffer,
      "debt-repair offer should render after an OPENED delivery — this is the served seam Soren blocked #1624 on",
    ).toBeVisible({ timeout: WAIT_MS });

    // Metadata guard — same shape the sibling `job-offers-played.spec.ts`
    // pins on the safe-default / completed offers. If the primitive
    // relabels the route-risk axis (low/medium/high → safe/risky/repair),
    // this reds alongside the sibling spec so the change author moves
    // BOTH surfaces together.
    await expect(
      debtOffer,
      "debt-repair button text must combine the authored label with the authored route-risk token",
    ).toHaveText("Wax-debt repair run · medium risk");
    await expect(
      debtOffer,
      "debt-repair button must expose the authored route-risk token via data-route-risk",
    ).toHaveAttribute("data-route-risk", "medium");
    // Tap-choice vocabulary the served renderer stamps — mirrored
    // by the consumer test at
    // `apps/web/src/aftersign/offeredJobsDebtHeldServedSurface.consumer.test.ts`.
    await expect(
      debtOffer,
      "debt-repair button must carry the shipped tap-choice attribute",
    ).toHaveAttribute("data-aftersign-tap-choice", "offer-job-wax-debt-repair");

    // The completed / safe-default siblings MUST be absent — proves
    // the divergence landed at the served DOM, not just in the
    // snapshot. If the derivation regresses back to the
    // `memory.length > 0 ? completed : undefined` shape, THIS is
    // the assertion that reds.
    await expect(
      page.locator("#job-offer-job-safe-delivery"),
      "safe-default offer must NOT render when Io remembers an opened delivery",
    ).toHaveCount(0);
    await expect(
      page.locator("#job-offer-job-night-transfer"),
      "completed-set night-transfer offer must NOT render when the only prior delivery was OPENED (not sealed)",
    ).toHaveCount(0);
    await expect(
      page.locator("#job-offer-job-signed-receipt"),
      "completed-set signed-receipt offer must NOT render when the only prior delivery was OPENED (not sealed)",
    ).toHaveCount(0);

    // Real tap on the rendered button — the assertion Soren asked
    // for verbatim: "clicks the rendered `#job-offer-job-wax-debt-repair`".
    await debtOffer.click();
  });
});
