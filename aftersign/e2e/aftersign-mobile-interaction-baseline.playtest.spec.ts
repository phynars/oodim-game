import { expect, test, type Page } from "@playwright/test";

/**
 * Phone-viewport GEOMETRY baseline for the post-`packet-choice` control row.
 *
 * The sibling spec `aftersign-live-verify-controls.playtest.spec.ts`
 * proves that `#acknowledgeRouteButton`, `#soundButton`, and the
 * `.slice-save-controls #resetButton` all FIRE on a phone tap and that
 * Start fresh is structurally outside `.controls`. It does not prove
 * the three controls are thumb-safe: that each has a ≥44 CSS-px hit
 * target (WCAG 2.5.5 / Apple HIG) AND that their rendered boxes do not
 * overlap — the exact "mis-aimed thumb reaching for the sound tile
 * triggers a slice wipe" risk that spec's inline comment gestures at
 * but never measures.
 *
 * `packet-button-touch-target.contract.spec.ts` covers `#packetButton`
 * at the `packet-offered` beat. This spec covers the three later-beat
 * controls that only exist after `packet-choice`.
 */

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;
const MIN_TOUCH_PX = 44;

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
  await page.goto(`/aftersign/?slot=mobile-geometry-${Date.now()}`, {
    waitUntil: "load",
  });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");

  const offered = page.locator(
    'button[data-offered-job-id="job-safe-delivery"]',
  );
  await expect(offered).toBeVisible({ timeout: WAIT_MS });
  await offered.tap();

  const packet = page.locator("#packetButton");
  await expect(packet).toBeVisible({ timeout: WAIT_MS });
  await packet.tap();
  await waitForBeat(page, "packet-choice");
}

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

test.describe("AFTERSIGN post-choice control row phone geometry", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

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

    // Resolve bounding boxes once the three controls are all visible.
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

    // No pairwise overlap. If two of these three rects intersect, a
    // mis-aimed thumb can trigger the wrong control — specifically the
    // risk the live-verify spec warns about but never measures: Start
    // fresh overlapping sound or ack would turn a mode-toggle into a
    // slice wipe.
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
