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

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

const KIND_RETURN_REPLY =
  "Careful. Say that too often and people will start handing you breakable things.";

const KIND_RETURN_FEEL = {
  toneHz: "440",
  attackMs: "12ms",
  releaseMs: "180ms",
  gain: "0.11",
  pressScale: "0.982",
  liftPx: "-2px",
  shakePx: "1.5px",
  glowPx: "18px",
  durationMs: "240ms",
  easing: "cubic-bezier(.2,.8,.2,1)",
};

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

const expectKindReturnFeelStamped = async (page: Page): Promise<void> => {
  const feel = await page.locator("#aftersignReturnSurface").evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      tone: node.getAttribute("data-aftersign-return-tone"),
      toneHz: style.getPropertyValue("--aftersign-return-tone-hz").trim(),
      attackMs: style.getPropertyValue("--aftersign-return-tone-attack-ms").trim(),
      releaseMs: style.getPropertyValue("--aftersign-return-tone-release-ms").trim(),
      gain: style.getPropertyValue("--aftersign-return-tone-gain").trim(),
      pressScale: style.getPropertyValue("--aftersign-return-press-scale").trim(),
      liftPx: style.getPropertyValue("--aftersign-return-lift-px").trim(),
      shakePx: style.getPropertyValue("--aftersign-return-shake-px").trim(),
      glowPx: style.getPropertyValue("--aftersign-return-glow-px").trim(),
      durationMs: style.getPropertyValue("--aftersign-return-duration-ms").trim(),
      easing: style.getPropertyValue("--aftersign-return-easing").trim(),
    };
  });

  expect(feel).toEqual({
    tone: "kind",
    ...KIND_RETURN_FEEL,
  });
};

test.describe("AFTERSIGN return-tone choice feel (phone tap)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("Kind return tap at io-return-recognition renders the authored reply and stamps the tuned feel surface", async ({
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
    await expectKindReturnFeelStamped(page);

    await tap(page, "#acknowledgeRouteButton");

    await waitForBeat(page, "return-tone-choice");
    await expect(page.locator("#line")).toHaveText(KIND_RETURN_REPLY, {
      timeout: WAIT_MS,
    });
    await expect(page.locator("#acknowledgeRouteButton")).toHaveAttribute(
      "data-aftersign-tap-confirm",
      "armed",
    );

    await expect(page.locator("#deliverButton")).toContainText(
      /ask for next job/i,
    );
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-next-job");
  });
});