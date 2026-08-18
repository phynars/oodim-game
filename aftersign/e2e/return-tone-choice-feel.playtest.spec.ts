import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN return-tone choice FEEL trip-wire — phone-shaped playtest.
//
// SCOPE. Where the sibling `io-continue-beats-tap-playtest.spec.ts`
// pins ALL THREE authored replies + the durable-save proof, this spec
// is the JUICE-lane trip-wire: ONE fresh run through the fork,
// asserting that the visible tap on "Kind return" produces a tactile,
// on-screen response (the authored reply verbatim, at `#line`) at the
// `return-tone-choice` beat. If a future feel refactor drops the
// press-envelope wiring on `applyReturnToneFeel()` and silently
// clobbers the reply render, this trip-wire reds first because it
// runs in the phone tap lane (`hasTouch: true` synthesizes touch
// events; the click-only path would miss a touch-only wiring gap).
//
// LOCATION. Lives at `aftersign/e2e/` — the repo-root tree the
// `aftersign/playwright.config.ts` `testDir: "e2e"` config scans.
// A prior draft parked under `apps/web/src/aftersign/e2e/`, which no
// Playwright config scans — dead file (Soren PR #1304 review).
//
// PLAYED, NOT DRIVEN (BRIEF 2026-08-15). Every advance is a real tap
// on a visible, enabled DOM button; `window.__game` reads appear
// exclusively in ASSERTIONS (scene.beat + published state shape),
// never as an input driver.
//
// SERVED-DOM AUTHORITY. Button labels are asserted VERBATIM against
// what the served page writes to the three fork-button text nodes at
// `io-return-recognition`:
//   #acknowledgeRouteButton → "Kind return"
//   #skipRouteButton        → "Evasive return"
//   #deliverButton          → "Blunt return"

type FlagshipSnapshot = {
  scene?: {
    beat?: string;
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => FlagshipSnapshot;
      scene?: { beat?: unknown };
    };
  }
}

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

const KIND_RETURN_REPLY =
  "Careful. Say that too often and people will start handing you breakable things.";

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raw = window.__game?.scene?.beat;
          return typeof raw === "string" ? raw : null;
        }),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

const tap = async (page: Page, selector: string): Promise<void> => {
  const button = page.locator(selector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.tap();
};

test.describe("AFTERSIGN return-tone choice feel (phone tap)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("Kind return tap at io-return-recognition renders the authored reply at return-tone-choice", async ({
    page,
  }) => {
    await page.goto(`/aftersign/?slot=return-tone-feel-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForGame(page);

    await waitForBeat(page, "packet-offered");
    await tap(page, "#deliverButton");

    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#acknowledgeRouteButton")).toContainText(
      /^\s*Kind return\s*$/,
    );
    await expect(page.locator("#skipRouteButton")).toContainText(
      /^\s*Evasive return\s*$/,
    );
    await expect(page.locator("#deliverButton")).toContainText(
      /^\s*Blunt return\s*$/,
    );

    await tap(page, "#acknowledgeRouteButton");

    await waitForBeat(page, "return-tone-choice");
    await expect(page.locator("#line")).toHaveText(KIND_RETURN_REPLY, {
      timeout: WAIT_MS,
    });

    await expect(page.locator("#deliverButton")).toContainText(
      /ask for next job/i,
    );
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-next-job");
  });
});
