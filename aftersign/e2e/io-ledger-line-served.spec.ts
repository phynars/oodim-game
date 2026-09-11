import { test, expect, type Page } from "@playwright/test";

// AFTERSIGN Io ledger-line served-surface tap-driven playtest
// (PR #1715 / #1714).
//
// Proves that `chooseIoLedgerLine(fact)` — the pinned copy contract in
// `aftersign/src/ioLedgerLine.ts` — is the SHIPPED source of the three
// ledger-facing lines Io speaks:
//
//   fact       beat                     line (verbatim from ioLedgerLine.ts)
//   sealed     io-return-recognition    "The seal held. That buys you the longer route."
//   opened     io-return-recognition    "The seal broke. Take the route with fewer witnesses."
//   returned   io-next-job              "You came back. I kept the work that remembers that."
//
// Played, not driven (BRIEF 2026-08-15): every run reaches its beat by
// visible-DOM taps (`#packetButton`, `#deliverButton`,
// `#acknowledgeRouteButton`). The one departure — `open-packet` — uses
// `window.__game.input.choose("open-packet")` because the OPEN fork is
// a hold-gesture that clicks alone can't reliably simulate on
// SwiftShader CI; the SAME compromise the sibling debt-held / npc-
// memory-recall specs make, and the SAME entry point the shipped
// runtime exposes on `window.__game.input`.
//
// Element-level pin: we assert BOTH `#ioLedgerLine` textContent AND
// `data-io-ledger-fact` — two axes so a regression that keeps the
// text but drops the stamp (or vice versa) reds this spec.
//
// Verbatim copy: the three literals below are duplicated from
// `aftersign/src/ioLedgerLine.ts` deliberately — a rewrite of the
// module strings that forgets the ledger contract turns THIS spec red,
// which is the whole point of a consumer test.

const SPEC_TIMEOUT_MS = 120_000;
const WAIT_MS = 60_000;

const LEDGER_LINE_BY_FACT = {
  sealed: "The seal held. That buys you the longer route.",
  opened: "The seal broke. Take the route with fewer witnesses.",
  returned: "You came back. I kept the work that remembers that.",
} as const;

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

// Boot a FRESH save on `slot` and tap (visible DOM only) up to the
// packet-choice fork.
async function playToPacketChoice(page: Page, slot: string): Promise<void> {
  await page.goto(`?slot=${slot}`, { waitUntil: "load" });
  await waitForBeat(page, "packet-offered");

  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");
}

// Drive from packet-choice → packet-delivered → auto-advance into
// `io-return-recognition`. `acknowledge-kiosk` is a tap on the real
// `#acknowledgeRouteButton`; `deliver-packet` is a tap on the real
// `#deliverButton`.
async function playToReturnRecognition(page: Page): Promise<void> {
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");
  // Auto-advance to recognition (~1180ms setTimeout in deliverPacket()).
  await waitForBeat(page, "io-return-recognition");
}

test.describe("AFTERSIGN Io ledger-line served-surface contract (#1714)", () => {
  test("sealed packet renders the sealed ledger line at io-return-recognition", async ({
    page,
  }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);
    const slot = `io-ledger-sealed-${Date.now()}`;
    await playToPacketChoice(page, slot);
    // Fresh save opens sealed; tapping the packet again just keeps it
    // sealed — we're already on the sealed fork. Advance to delivery.
    await playToReturnRecognition(page);

    const ledger = page.locator("#ioLedgerLine");
    await expect(ledger).toHaveText(LEDGER_LINE_BY_FACT.sealed, {
      timeout: WAIT_MS,
    });
    await expect(ledger).toHaveAttribute("data-io-ledger-fact", "sealed", {
      timeout: WAIT_MS,
    });
  });

  test("opened packet renders the opened ledger line at io-return-recognition", async ({
    page,
  }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);
    const slot = `io-ledger-opened-${Date.now()}`;
    await playToPacketChoice(page, slot);
    // OPEN fork: the shipped runtime seam that many sibling specs use
    // for the hold gesture. `window.__game.input.choose("open-packet")`
    // flips `state.packet.sealed = false` on the SAME state graph the
    // recognition beat reads.
    await page.evaluate(() =>
      (
        window as unknown as {
          __game?: {
            input?: { choose?: (id: string) => Promise<void> };
          };
        }
      ).__game?.input?.choose?.("open-packet"),
    );
    await playToReturnRecognition(page);

    const ledger = page.locator("#ioLedgerLine");
    await expect(ledger).toHaveText(LEDGER_LINE_BY_FACT.opened, {
      timeout: WAIT_MS,
    });
    await expect(ledger).toHaveAttribute("data-io-ledger-fact", "opened", {
      timeout: WAIT_MS,
    });
  });

  test("advancing to io-next-job renders the returned ledger line", async ({
    page,
  }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);
    const slot = `io-ledger-returned-${Date.now()}`;
    await playToPacketChoice(page, slot);
    await playToReturnRecognition(page);

    // Tap a return-tone (any of the three; the ledger fact for
    // io-next-job is invariant "returned"). `#deliverButton` at the
    // recognition beat is stamped as `choose-return-tone` with
    // `data-return-reason="blunt"` — see main.js:renderText().
    await tapChoice(page, "choose-return-tone");
    await waitForBeat(page, "return-tone-choice");

    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");

    const ledger = page.locator("#ioLedgerLine");
    await expect(ledger).toHaveText(LEDGER_LINE_BY_FACT.returned, {
      timeout: WAIT_MS,
    });
    await expect(ledger).toHaveAttribute(
      "data-io-ledger-fact",
      "returned",
      { timeout: WAIT_MS },
    );
  });

  test("off-beat the ledger stamp clears — no stale ledger fact smears", async ({
    page,
  }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);
    const slot = `io-ledger-offbeat-${Date.now()}`;
    await playToPacketChoice(page, slot);
    // At `packet-choice` — one of the many beats where the ledger
    // stamp must NOT be set. renderText() has already run at least
    // once (we waited for the beat's data-beat-id).
    const ledger = page.locator("#ioLedgerLine");
    await expect(ledger).toHaveAttribute("data-io-ledger-fact", "", {
      timeout: WAIT_MS,
    });
    await expect(ledger).toHaveText("", { timeout: WAIT_MS });
  });
});
