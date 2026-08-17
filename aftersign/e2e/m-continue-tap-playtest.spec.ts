import { expect, test, type Page } from "@playwright/test";

// M-CONTINUE played acceptance, driven by ACCESSIBLE NAMES.
//
// The sibling `m-continue-phone-tap-playtest.spec.ts` already proves
// the same journey via DOM ids (#deliverButton, #acknowledgeRouteButton,
// #skipRouteButton). Ids are the DEV contract; this spec covers the
// PLAYER-VISIBLE / SCREEN-READER contract — the accessible names the
// browser exposes to assistive tech and to Playwright's ARIA snapshot.
// If a future refactor keeps the ids stable but silently renames a
// button ("Kind return" → "Kind reply"), the sibling stays green and
// this spec reds — which is the point.
//
// Two other choices that make this spec add signal instead of noise:
//   1. This spec picks the EVASIVE branch (skipRouteButton →
//      "Evasive return"). The sibling picks the KIND branch. Between
//      the two specs the fork's kind + evasive arms are both proven;
//      the blunt arm is left to a future spec if it earns one.
//   2. Terminal assertion polls `window.__game.scene.beat` — the SAME
//      served-page surface that story-state-surface-contract.spec.ts
//      pins (main.js :: publishState). Reviewer PR #1250 confirmed this
//      is the correct read path; the earlier draft polled
//      `window.__game.state.story.currentBeat`, which exists on neither
//      the served page nor the harness snapshot, and silently returned
//      null — a perpetual-false gate rather than a test.
//
// ACCESSIBLE-NAME SOURCES (verified against aftersign/main.js at the
// session commit — the served DOM is the AUTHORITY, not index.html's
// initial markup: `renderText()` in main.js:1207-1273 rewrites every
// button's textContent on first render, so `#deliverButton`'s initial
// "Deliver at the blue kiosk" (index.html:562) is CLOBBERED to
// "Deliver packet" by the else-branch at main.js:1269 before the
// player ever sees the boot beat. The reviewer on PR #1250 verified
// main.js:1226 + 1247 correctly but cited index.html:562 for the boot
// label; the served accessible name at `packet-offered` is what
// main.js writes, not what the static HTML declares.):
//   - `#deliverButton` at `packet-offered`   → text "Deliver packet"
//     (main.js:1269, else branch — `packet-offered` isn't any of the
//     four named beats, so renderText falls through)
//   - `#acknowledgeRouteButton` at
//     `io-return-recognition`                → text "Kind return"
//     (main.js:1225)
//   - `#skipRouteButton` at
//     `io-return-recognition`                → text "Evasive return"
//     (main.js:1226)
//   - `#deliverButton` at `return-tone-choice` → text "Ask for next
//     job" (main.js:1247; NOT "Ask for THE next job")
//
// The regex assertions below are anchored (^...$) and pass through the
// getByRole exact-name check (`exact: true`). If any button copy drifts,
// the tapExact call fails at toHaveCount(1) — not at a downstream poll —
// so the error message points at the drifted string directly.

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

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function tapExactByName(page: Page, name: string): Promise<void> {
  // exact: true → getByRole matches the button whose accessible name
  // is EXACTLY this string, not a substring. This is stricter than a
  // regex partial match: if a future refactor renames "Kind return" to
  // "Kind reply" and we pass the old string, toHaveCount(1) fails
  // immediately rather than silently matching some other close button.
  const option = page.getByRole("button", { name, exact: true });
  await expect(option).toHaveCount(1);
  await expect(option).toBeVisible();
  await expect(option).toBeEnabled();
  await option.tap();
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const maybeGame = window.__game;
          const raw = maybeGame?.scene?.beat;
          return typeof raw === "string" ? raw : null;
        }),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

test.describe("M-CONTINUE played acceptance (accessible-name taps)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone player taps by accessible name from packet-offered through io-next-job on the evasive branch", async ({
    page,
  }) => {
    // ISOLATED SLOT (see PR #1238 + sibling spec at
    // m-continue-phone-tap-playtest.spec.ts:81). The default slot maps
    // to a shared server-authoritative key that outlives page loads on
    // the vite preview process; a parallel default-slot sibling could
    // leave a mid-story beat in the store and this spec would boot
    // past `packet-offered`, its first tap no-op'ing off-beat.
    await page.goto(`/aftersign/?slot=m-continue-tap-name-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForGame(page);

    // Boot: `packet-offered`. Only `#deliverButton` is enabled; its
    // rendered text (and therefore its accessible name) is "Deliver
    // packet" — main.js:1269 clobbers the initial index.html label at
    // first render (see ACCESSIBLE-NAME SOURCES above).
    await waitForBeat(page, "packet-offered");
    await tapExactByName(page, "Deliver packet");

    // The delivery tap advances to `io-return-recognition`, at which
    // point the three fork buttons re-label to their return-tone
    // options. We commit the EVASIVE branch — the sibling covers KIND;
    // between the two specs both arms are proven.
    await waitForBeat(page, "io-return-recognition");
    await tapExactByName(page, "Evasive return");

    // `return-tone-choice`: `#deliverButton` re-labels to "Ask for next
    // job" (NOT "Ask for THE next job" — the reviewer's PR #1250 catch;
    // the older draft invented the article and never landed a tap).
    await waitForBeat(page, "return-tone-choice");
    await tapExactByName(page, "Ask for next job");

    // Terminal assertion — same served-page surface pinned by
    // story-state-surface-contract.spec.ts. If a future refactor moves
    // `scene.beat`, both specs red together and the drift can't be
    // silent.
    await waitForBeat(page, "io-next-job");
  });
});
