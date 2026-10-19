import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

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
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function reachPacketChoice(page: Page): Promise<void> {
  // Mirror the proven path from `aftersign-mloop-two-round.playtest.spec.ts`:
  // wait for the scene to be ready, wait for `packet-offered`, tap the
  // served offered-job button (NOT a `data-choice-id` selector — that
  // attribute isn't stamped on the offered-jobs tray), tap `#packetButton`,
  // and finally wait for the `packet-choice` beat before the caller asserts
  // on `#acknowledgeRouteButton` / `#soundButton`.
  await page.goto(`/aftersign/?slot=live-verify-${Date.now()}`, {
    waitUntil: "load",
  });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
  const offered = page.locator(
    'button[data-offered-job-id="job-safe-delivery"]',
  );
  await expect(offered).toBeVisible({ timeout: WAIT_MS });
  await offered.tap();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
}

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

const MIN_TOUCH_PX = 44;

test.describe("AFTERSIGN live-verify control and save path", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone player sees explicit selected labels and a separate reset control", async ({ page }) => {
    test.setTimeout(120_000);
    await reachPacketChoice(page);

    // Current main labels the route-memory fork "I listened" / "I ran
    // early" (the first-person stance Io is asking about). After the
    // tap the label flips to its past-tense receipt — the player sees
    // "You listened" over the warm selected tile. The TEXT is the
    // receipt; the inline bg/border + aria-pressed are the state.
    const acknowledge = page.locator("#acknowledgeRouteButton");
    await expect(acknowledge).toBeVisible({ timeout: WAIT_MS });
    await expect(acknowledge).toHaveText("I listened");
    await acknowledge.tap();
    await expect(acknowledge).toHaveAttribute("aria-pressed", "true");
    await expect(acknowledge).toHaveText(/you listened/i);

    const sound = page.locator("#soundButton");
    await expect(sound).toBeVisible({ timeout: WAIT_MS });
    await sound.tap();
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await expect(sound).toHaveText(/sound on/i);

    // The reset control is isolated into its own `.slice-save-controls`
    // row so a mis-aimed thumb reaching for the sound tile cannot
    // trigger a slice wipe. Absence from `.controls` + presence under
    // the save-controls selector pins the separation.
    await expect(page.locator(".controls #resetButton")).toHaveCount(0);
    const reset = page.locator(".slice-save-controls #resetButton");
    await expect(reset).toHaveText("Start fresh");

    // PR #2225 re-review (Soren): a structural assertion is not enough.
    // `.hud` sets `pointer-events: none`; only `.controls` re-enables
    // taps. The new `.slice-save-controls` row must opt in too, or the
    // Start fresh button is painted but dead. Tap it and wait for the
    // slice to wipe back to the fresh `packet-offered` beat — mirrors
    // the sibling `reset-route-risk-isolation.spec.ts:152` assertion.
    // If pointer-events isn't `auto` on `.slice-save-controls`, this
    // tap times out at 15s and the spec reds.
    await reset.tap();
    await expect(
      page.locator('[data-beat-id="packet-offered"]'),
      "Start fresh must be tappable — slice-save-controls row needs pointer-events: auto",
    ).toBeVisible({ timeout: WAIT_MS });
  });

  // GEOMETRY baseline for the same three controls the behavior test
  // above taps. The behavior test proves ack / sound / reset each FIRE
  // on a phone tap and that Start fresh is structurally outside
  // `.controls`. It does NOT prove the three controls are thumb-safe:
  //   - each ≥ 44 CSS-px (WCAG 2.5.5 / Apple HIG touch minimum), AND
  //   - no pairwise overlap in rendered boxes
  // The second point is the exact "mis-aimed thumb reaching for the
  // sound tile triggers a slice wipe" risk the behavior test's inline
  // comment gestures at but never measures. If Start fresh ever grew
  // into sound/ack, the structural `.controls #resetButton` count
  // would still be 0 and the behavior test would still pass — only
  // this geometry check catches that drift.
  // `packet-button-touch-target.contract.spec.ts` covers `#packetButton`
  // at the earlier `packet-offered` beat; this covers the three
  // post-choice controls.
  test("ack, sound, and Start fresh each meet the 44px touch minimum and never overlap", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await reachPacketChoice(page);

    const selectors = {
      acknowledge: "#acknowledgeRouteButton",
      sound: "#soundButton",
      reset: ".slice-save-controls #resetButton",
    } as const;

    for (const sel of Object.values(selectors)) {
      await expect(page.locator(sel)).toBeVisible({ timeout: WAIT_MS });
    }

    const boxes: Record<keyof typeof selectors, Rect | null> = {
      acknowledge: await page.locator(selectors.acknowledge).boundingBox(),
      sound: await page.locator(selectors.sound).boundingBox(),
      reset: await page.locator(selectors.reset).boundingBox(),
    } as Record<keyof typeof selectors, Rect | null>;

    for (const [name, box] of Object.entries(boxes) as Array<
      [keyof typeof selectors, Rect | null]
    >) {
      expect(box, `${name} must have a rendered hit area`).not.toBeNull();
      expect(
        box!.width,
        `${name} width must meet the ${MIN_TOUCH_PX}px touch minimum`,
      ).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
      expect(
        box!.height,
        `${name} height must meet the ${MIN_TOUCH_PX}px touch minimum`,
      ).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }

    const pairs: Array<[keyof typeof selectors, keyof typeof selectors]> = [
      ["acknowledge", "sound"],
      ["acknowledge", "reset"],
      ["sound", "reset"],
    ];
    for (const [a, b] of pairs) {
      expect(
        overlaps(boxes[a]!, boxes[b]!),
        `${a} (${JSON.stringify(boxes[a])}) must not overlap ${b} (${JSON.stringify(boxes[b])}) — mis-aimed thumb would hit the wrong control`,
      ).toBe(false);
    }
  });
});
