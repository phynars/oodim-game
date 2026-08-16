import { expect, test, type Page } from "@playwright/test";

// M-CONTINUE PHONE TAP playtest — the same journey the sibling
// `m-continue-playtest.spec.ts` proves works, but driven by REAL touch
// events on a phone-shaped viewport. `hasTouch: true` + `isMobile: true`
// makes Playwright synthesize `touchstart`/`touchend` for `.tap()`, which
// exercises the served surface's touch listeners (mobile move-pad,
// button pointer/touch handlers) end-to-end — a code path `.click()`
// never touches.
//
// SCOPE — every assertion below targets ONE of THREE stable DOM ids the
// served page actually exposes (`aftersign/index.html:549,550,551`):
// `#deliverButton`, `#acknowledgeRouteButton`, `#skipRouteButton`. No
// `[data-beat-id]` / `[data-choice-id]` container selectors exist on the
// served page — this spec deliberately does NOT query for them.
//
// BOOT STATE — fresh boot lands on `packet-offered` (see
// `aftersign/main.js` state literal, `beat: canonicalFlagshipBeat(stored?.beat)
// ?? "packet-offered"`). At that beat, `renderText()` (main.js:1113-1117)
// falls into the ELSE branch: `#acknowledgeRouteButton` and
// `#skipRouteButton` are DISABLED with their default HTML text
// ("I listened" / "Not now"). Only `#deliverButton` is enabled and reads
// its default HTML text ("Deliver packet"). The player's first
// affordance is a single tap on `#deliverButton` — everything else on
// the button strip is inert until we advance.

type FlagshipSnapshot = {
  scene?: {
    beat?: string;
  };
  npcs?: {
    io?: {
      lastLine?: string;
    };
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => FlagshipSnapshot;
    };
  }
}

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function snapshot(page: Page): Promise<FlagshipSnapshot> {
  await waitForGame(page);
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function waitForBeat(page: Page, beat: string): Promise<FlagshipSnapshot> {
  await expect
    .poll(async () => (await snapshot(page)).scene?.beat, { timeout: WAIT_MS })
    .toBe(beat);
  return snapshot(page);
}

const tap = async (page: Page, selector: string): Promise<void> => {
  const button = page.locator(selector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.tap();
};

test.describe("M-CONTINUE phone tap playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone player taps from packet-offered through io-next-job using only visible affordances", async ({ page }) => {
    // ISOLATED SLOT (PR #1238): the old pattern (localStorage sweep +
    // default slot) only cleared the BROWSER copy of the save — the
    // default slot also maps to the SHARED server-authoritative key
    // local-slice-player::local on the vite preview process, which the
    // sweep never touched. Now that choose-return-tone forceSave()s
    // (#1234), a parallel default-slot sibling could leave a mid-story
    // beat in the server store and this spec would boot past
    // packet-offered, failing the boot assertion below. Unique slot per
    // run = cold server slot + cold localStorage key, no sweep needed.
    await page.goto(`/aftersign/?slot=m-continue-phone-tap-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForGame(page);

    // Boot beat is `packet-offered`: acknowledge/skip are disabled,
    // deliver is the ONLY enabled affordance. Tap it.
    const boot = await snapshot(page);
    expect(boot.scene?.beat).toBe("packet-offered");
    await expect(page.locator("#acknowledgeRouteButton")).toBeDisabled();
    await expect(page.locator("#skipRouteButton")).toBeDisabled();
    await tap(page, "#deliverButton");

    // `#deliverButton` mints the durable memory facts and advances to
    // `io-return-recognition`, where all three buttons flip to the
    // return-tone options (main.js:1091-1100).
    const recognition = await waitForBeat(page, "io-return-recognition");
    expect(recognition.scene?.beat).toBe("io-return-recognition");

    await expect(page.locator("#acknowledgeRouteButton")).toContainText(/kind return/i);
    await expect(page.locator("#skipRouteButton")).toContainText(/evasive return/i);
    await expect(page.locator("#deliverButton")).toContainText(/blunt return/i);

    // Tap "Kind return" — the choiceId on all three buttons at this
    // beat is `choose-return-tone`, so any of the three would advance;
    // Kind is the mainline phone player's choice.
    await tap(page, "#acknowledgeRouteButton");

    const returnTone = await waitForBeat(page, "return-tone-choice");
    expect(returnTone.scene?.beat).toBe("return-tone-choice");

    // At `return-tone-choice`, acknowledge/skip go disabled again and
    // `#deliverButton` re-labels to "Ask for next job"
    // (main.js:1101-1106).
    await expect(page.locator("#acknowledgeRouteButton")).toBeDisabled();
    await expect(page.locator("#skipRouteButton")).toBeDisabled();
    await expect(page.locator("#deliverButton")).toContainText(/ask for next job/i);
    await tap(page, "#deliverButton");

    // `io-next-job` — Io speaks the memory-reflection line (see
    // `lineForBeat()` `io-next-job` branch in main.js) and
    // `#deliverButton` re-labels to "Deliver next packet"
    // (main.js:1107-1112). The loop is proven open.
    const nextJob = await waitForBeat(page, "io-next-job");
    expect(nextJob.scene?.beat).toBe("io-next-job");
    await expect(page.locator("#deliverButton")).toContainText(/deliver next packet/i);

    const nextJobLine = nextJob.npcs?.io?.lastLine;
    expect(typeof nextJobLine).toBe("string");
    await expect(page.locator("#line")).toHaveText(nextJobLine!);
  });
});
