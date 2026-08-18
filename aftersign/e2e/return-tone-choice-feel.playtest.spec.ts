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
// never as an input driver. Deliberately includes the M-CONTINUE
// continuation tokens (`io-return-recognition` + `return-tone` +
// `next-job`) plus the `playtest` filename discriminant so this file
// ALSO qualifies as a played-acceptance proof under
// `aftersignMilestoneAcceptanceSurface.test.ts` — one more line of
// defense if a refactor deletes the two named siblings.
//
// SERVED-DOM AUTHORITY. Button labels are asserted VERBATIM against
// what `aftersign/main.js:1406-1408` writes to the three fork-button
// text nodes at `io-return-recognition`:
//   #acknowledgeRouteButton → "Kind return"
//   #skipRouteButton        → "Evasive return"
//   #deliverButton          → "Blunt return"
// The Kind-return reply is the verbatim authored line from
// `apps/web/src/aftersign/story/ioContinueBeats.ts` (script §8).

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

// Verbatim kind-return authored reply (script §8, mirrored in
// apps/web/src/aftersign/story/ioContinueBeats.ts). Kept as a literal
// so a rewrite of the module string that forgets the script turns
// this trip-wire RED — a paraphrase of the same tone is NOT a pass.
const KIND_RETURN_REPLY =
  "Careful. Say that too often and people will start handing you breakable things.";

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  // Reads `scene.beat` — the SAME served-page surface pinned by
  // `story-state-surface-contract.spec.ts` and by the sibling
  // `m-continue-tap-playtest.spec.ts`. The prior draft read a
  // top-level `beat` field that exists on neither the served page
  // nor the harness snapshot, silently returning null (Soren PR
  // #1304 review).
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
    // ISOLATED SLOT — same rationale as `m-continue-phone-tap-playtest`:
    // the default slot maps to a server-authoritative key that can
    // outlive a page load on the vite preview process; a unique slot
    // per run guarantees a cold boot at `packet-offered`.
    await page.goto(`/aftersign/?slot=return-tone-feel-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForGame(page);

    // Boot: `packet-offered` — deliver is the only enabled affordance.
    await waitForBeat(page, "packet-offered");
    await tap(page, "#deliverButton");

    // The delivery advances to `io-return-recognition`, where the
    // three fork buttons re-label to the return-tone options. Assert
    // the served labels VERBATIM so a rename ("Kind return" → "Kind
    // reply") reds this spec at the label check, not at a downstream
    // poll.
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

    // Commit the kind return — `#acknowledgeRouteButton` is the served
    // element that carries the "Kind return" label at this beat.
    await tap(page, "#acknowledgeRouteButton");

    // The tap advances to `return-tone-choice`, where `#line` speaks
    // the authored kind-return reply (`buildIoContinueBeats("kind")[0].line`).
    // toHaveText is EQUAL (not contained) — the branch renders exactly
    // this string; anything else is drift.
    await waitForBeat(page, "return-tone-choice");
    await expect(page.locator("#line")).toHaveText(KIND_RETURN_REPLY, {
      timeout: WAIT_MS,
    });

    // Advance one more beat to prove the FEEL didn't dead-end the
    // route. `#deliverButton` re-labels to "Ask for next job" at
    // `return-tone-choice` (main.js:1247); tapping it must land on
    // `io-next-job`. This is what earns the `next-job` token above
    // for the M-CONTINUE played-acceptance guard.
    await expect(page.locator("#deliverButton")).toContainText(
      /ask for next job/i,
    );
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-next-job");
  });
});
