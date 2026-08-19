import { test, expect, type Page } from "@playwright/test";
import { selectIoSecondPacketCopy } from "../src/ioSecondPacketCopy.ts";

// "Played, not driven" proof for the `io-second-packet-copy` beat
// (closes #1322 — wire `aftersign/src/ioSecondPacketCopy.ts` into a
// served render site with a tap-driven e2e).
//
// ONE tone is played end-to-end here — the `kind` return posture, which
// bridges to the module's `gentle` tone via
// `mapReturnReasonToSecondPacketTone` in main.js. Testing that ONE tone
// covers the "the module contract is what the player reads" invariant
// a full 3-tone loop would, at 1/3 the SwiftShader vite-preview
// cold-boot cost. The exhaustive 3-tone × has-name / no-name matrix
// runs in the deterministic pure lane (see
// `aftersign/src/ioSecondPacketCopy.test.ts`, registered on
// `aftersign/pure-runner.ts` under `runIoSecondPacketCopyChecks`), so
// the flake-prone browser lane pays for ONE played traversal instead
// of three.
//
// Why the browser lane at all: the acceptance criterion on #1322 is
// that the beat is REACHABLE via taps AND the module's copy actually
// lands on the served DOM. A pure test can't prove reachability (the
// tap graph is served-page state), and a pure test can't prove the
// module output actually hits `#line` + `#speaker` (a renderer
// regression that stopped writing `#line` would leave the module
// output green but the player reading nothing). So: ONE played
// traversal here, exhaustive matrix in pure — belt-and-suspenders
// across the two lanes.

const SPEC_TIMEOUT_MS = 120_000;
const WAIT_MS = 60_000;
const PLAYED_RETURN_REASON = "kind" as const;

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const node = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(node).toBeVisible({ timeout: WAIT_MS });
  await node.click();
}

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const node = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(node).toBeVisible({ timeout: WAIT_MS });
  await node.click();
}

async function playToNextJob(page: Page, slot: string): Promise<void> {
  await page.goto(`?slot=${slot}`, { waitUntil: "load" });
  await waitForBeat(page, "packet-offered");

  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");

  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");
  await waitForBeat(page, "io-return-recognition");

  await tapReturnReason(page, PLAYED_RETURN_REASON);
  await waitForBeat(page, "return-tone-choice");

  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
}

test.describe("AFTERSIGN io second packet copy is rendered from module contract", () => {
  test(`return-reason ${PLAYED_RETURN_REASON} reaches io-second-packet-copy and renders module lines`, async ({
    page,
  }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);

    const slot = `io-second-packet-${PLAYED_RETURN_REASON}-${Date.now()}`;
    await playToNextJob(page, slot);

    // Tap "Deliver next packet" at io-next-job — this now transitions
    // to `io-second-packet-copy` (Closes #1322), NOT straight back to
    // packet-choice. The player MUST get to read Io's second-packet
    // offer copy before the packet-loop resets.
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-second-packet-copy");

    // The main.js render site maps `state.player.returnReason` ("kind")
    // onto the module's tone axis via
    // `mapReturnReasonToSecondPacketTone` — kind → gentle. The played
    // slot never entered a player name, so the module's fallback
    // (empty address prefix, per `checkPlayerNameFallback`) applies.
    // Assert against the SAME module call site the render uses, not
    // against a hand-typed copy — a rewrite of the module lands here
    // the moment `runIoSecondPacketCopyChecks` accepts it.
    const copy = selectIoSecondPacketCopy({
      returnTone: "gentle",
      playerName: null,
    });
    const expectedLine = copy.lines.join(" ");

    // "Played, not driven": assert the copy against the actual DOM
    // node the player reads (#line), not only the harness hook. The
    // hook assertion below stays as belt-and-suspenders — a drift
    // between `state.npcs.io.lastLine` and `#line.textContent` would
    // signal a renderer regression that neither assertion alone
    // would catch.
    await expect(page.locator("#line")).toHaveText(expectedLine, { timeout: WAIT_MS });
    await expect(page.locator("#speaker")).toHaveText(copy.speaker, { timeout: WAIT_MS });

    const observed = await page.evaluate(
      () =>
        (window as unknown as { __game?: { npcs?: { io?: { lastLine?: string | null } } } })
          .__game?.npcs?.io?.lastLine ?? null,
    );
    expect(observed).toBe(expectedLine);

    // The module's two authored choices are stamped onto the two
    // route buttons — assert both are visible + tappable by
    // `data-choice-id`, and their labels match the module verbatim
    // so a rewrite of a label reds this spec before it ships silently.
    const [acceptChoice, askChoice] = copy.choices;
    const acceptButton = page.locator(`button[data-choice-id="${acceptChoice.id}"]:not([disabled])`);
    const askButton = page.locator(`button[data-choice-id="${askChoice.id}"]:not([disabled])`);
    await expect(acceptButton).toBeVisible({ timeout: WAIT_MS });
    await expect(askButton).toBeVisible({ timeout: WAIT_MS });
    await expect(acceptButton).toHaveText(acceptChoice.label);
    await expect(askButton).toHaveText(askChoice.label);

    // Tap the "accept" affordance and prove the packet-loop actually
    // resets — the beat drops back to `packet-choice` with a fresh
    // sealed packet. This is the CLOSING invariant the deferred
    // reset earns: the player got to READ the copy before the state
    // collapsed.
    await acceptButton.click();
    await waitForBeat(page, "packet-choice");
    const resetPacket = await page.evaluate(
      () =>
        (window as unknown as { __game?: { packet?: { sealed?: boolean; delivered?: boolean } } })
          .__game?.packet ?? null,
    );
    expect(resetPacket).toMatchObject({ sealed: true, delivered: false });
  });
});
