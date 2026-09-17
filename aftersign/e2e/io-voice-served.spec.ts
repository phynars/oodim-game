// #1812 — tap-driven proof that Io's return-recognition voice
// (`ioReturnLine(state.delivery.outcome)`) reaches the served page as
// a player-visible sibling paragraph next to `#line`. Same shape as
// `io-loop-consequence-line-served.spec.ts` (sibling `#ioConsequenceLine`
// paragraph inside `#offeredJobs`): the shipped consumer stamps the
// selected copy module literal into ITS OWN paragraph, and this spec
// pins the visible textContent verbatim per outcome branch.
//
// Second-source-of-truth guard (Soren's second REQUEST_CHANGES on
// PR #1813): `#line.textContent` at this beat is owned by
// `aftersign/src/ioRecognitionDialogue.ts::RETURNING_LINES` (pinned by
// `io-phone-ready-look-sound-contract.spec.ts:287` on `lineText`).
// This spec therefore asserts the voice literal against `#ioReturnLine`
// — the SIBLING paragraph the served renderer inserts alongside `#line`
// — and never touches `#line.textContent`. That keeps the voice module
// and the recognition-dialogue module on separate DOM nodes; the
// vocabulary contract for the branch key stays derived from `IO_VOICE`
// so the served stamp + the assertion live on ONE table.
//
// PLAYED-NOT-DRIVEN (Soren's third REQUEST_CHANGES on PR #1813): both
// branches drive the packet gesture through real DOM events on
// `#packetButton` — a plain Playwright `tap()` for SEALED, and a
// pointerdown/pointermove/pointerup sequence with a 12px pull past
// `OPEN_PULL_MIN_PX=10` for OPENED. Same shape as
// `performPacketGesture` in `io-recognition-return-visual-feel.spec.ts`
// and `holdChoiceViaDom` in `flagship-surface-contract.spec.ts`. No
// `window.__game.input.choose(...)` — every input is a rendered
// control the player can actually touch.

import { expect, test, type Page } from "@playwright/test";
// Vocabulary + literals contract for the packet-outcome axis. The
// keys of `IO_VOICE.returned` are the exact
// `"sealed" | "opened" | "unknown"` values the served stamp writes
// onto `data-aftersign-io-return-line`; its values are the exact
// strings the sibling paragraph's `textContent` must equal on each
// branch. Deriving both from the module — instead of duplicating —
// keeps the served stamp + the e2e assertion on ONE table.
import { IO_VOICE } from "../src/ioVoice.js";

const SEALED_OUTCOME_KEY = "sealed" as const;
const OPENED_OUTCOME_KEY = "opened" as const;

const WAIT_MS = 15_000;

// Phone context (Soren's fifth REQUEST_CHANGES on PR #1813). Every
// sibling phone-tap spec in `aftersign/e2e/` opts into touch via
// `test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true })`
// (see `io-second-packet-copy-served.spec.ts:70` and
// `aftersign-packet-offer-touch.playtest.spec.ts:38`). Without
// `hasTouch: true` Playwright throws
// `locator.tap: The page does not support tap.` on the very first
// `#packetButton.tap()` — both branches time out before ever reaching
// `#ioReturnLine`, and the tap-driven proof this PR exists to ship
// never actually runs.
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

// `#line` is stamped with the shipped `data-beat-id` attribute
// (see `AFTERSIGN_BEAT_ATTRIBUTE` in
// `aftersign/src/playerVisibleBeatDom.js`, and every sibling e2e in
// `aftersign/e2e/` — e.g. `io-loop-consequence-line-served.spec.ts`,
// `io-recognition-return-visual-feel.spec.ts`). Polling the served
// attribute name — not a made-up `data-aftersign-beat` — is what
// lets these gates actually resolve before the 15s timeout.
async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () => page.locator("#line").getAttribute("data-beat-id"),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function openAftersign(page: Page, slot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await expect
    .poll(() => page.locator("#line").getAttribute("data-beat-id"), {
      timeout: WAIT_MS,
    })
    .toBe("packet-offered");
}

async function tapDeliverToRecognition(page: Page): Promise<void> {
  await page.locator("#deliverButton").tap();
  await waitForBeat(page, "io-return-recognition");
}

// Hold `#packetButton` for `holdMs` and inject a 12px pull halfway
// through — same pointer sequence sibling specs use to commit OPENED
// via the shipped `PacketIntentController`, not a harness hook. The
// pull sits inside `(OPEN_PULL_MIN_PX=10, DRIFT_CANCEL_PX=14]`.
async function holdOpenPacketButton(
  page: Page,
  holdMs: number,
  pullPx = 12,
): Promise<void> {
  await page.evaluate(
    async ({ ms, pull }) => {
      const node = document.querySelector<HTMLElement>("#packetButton");
      if (!node) throw new Error("#packetButton not found");
      const rect = node.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;

      node.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 1,
          button: 0,
          buttons: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: startX,
          clientY: startY,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, Math.floor(ms / 2)));

      node.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          button: 0,
          buttons: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: startX + pull,
          clientY: startY,
        }),
      );

      await new Promise((resolve) =>
        setTimeout(resolve, ms - Math.floor(ms / 2)),
      );

      node.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerId: 1,
          button: 0,
          buttons: 0,
          pointerType: "touch",
          isPrimary: true,
          clientX: startX + pull,
          clientY: startY,
        }),
      );
      node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    },
    { ms: holdMs, pull: pullPx },
  );
}

test.describe("AFTERSIGN Io return-voice sibling paragraph (phone tap)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("sealed delivery serves Io's sealed return voice in the sibling #ioReturnLine paragraph", async ({
    page,
  }) => {
    await openAftersign(page, `io-voice-sealed-${Date.now()}`);

    // Plain tap on `#packetButton` commits SEALED (`PacketIntentController`
    // never crosses OPEN thresholds).
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    await tapDeliverToRecognition(page);

    const returnLine = page.locator("#ioReturnLine");
    await expect(
      returnLine,
      "sibling #ioReturnLine paragraph must be present at the recognition beat",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(returnLine).toHaveAttribute(
      "data-aftersign-io-return-line",
      SEALED_OUTCOME_KEY,
    );
    await expect(returnLine).toHaveText(IO_VOICE.returned.sealed);
  });

  test("opened delivery serves Io's opened return voice in the sibling #ioReturnLine paragraph", async ({
    page,
  }) => {
    await openAftersign(page, `io-voice-opened-${Date.now()}`);

    // Real hold+pull on `#packetButton` — the shipped seal-break gesture,
    // driven by pointer events on the rendered control. Same shape as
    // `performPacketGesture` in `io-recognition-return-visual-feel.spec.ts`.
    await holdOpenPacketButton(page, 900);
    await waitForBeat(page, "packet-choice");
    await tapDeliverToRecognition(page);

    const returnLine = page.locator("#ioReturnLine");
    await expect(
      returnLine,
      "sibling #ioReturnLine paragraph must be present at the recognition beat",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(returnLine).toHaveAttribute(
      "data-aftersign-io-return-line",
      OPENED_OUTCOME_KEY,
    );
    await expect(returnLine).toHaveText(IO_VOICE.returned.opened);
  });
});
