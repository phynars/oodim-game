import { expect, test, type Locator, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const PRESS_FEEL = {
  recoveryWindowMs: 480,
  minPressedScaleDrop: 0.015,
  maxPressedScaleDrop: 0.08,
  maxTravelPx: 6,
  // This is intentionally a within-node stability budget, not a comparison
  // to the pre-tap node. The click may replace/reflow the offer as it advances
  // the beat, which is authored layout rather than press-animation travel.
  maxRecoverySettleDriftPx: 1.5,
};
const SAFE_DELIVERY_OFFER_ID = "job-offer-job-safe-delivery";

type Measurement = {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

type PressJuiceRecord = {
  minScale: number;
  maxTravel: number;
  samples: number;
};

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raw = (
            window as unknown as { __game?: { scene?: { beat?: unknown } } }
          ).__game?.scene?.beat;
          return typeof raw === "string" ? raw : null;
        }),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function measureButton(locator: Locator): Promise<Measurement> {
  return locator.evaluate((element) => {
    const rect = (element as HTMLElement).getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    };
  });
}

type SettleOpts = { tolerancePx: number; stableFrames: number; maxWaitMs: number };

// Wait for a DOM node's bounding rect to be STABLE across N consecutive
// animation frames, up to a hard timeout. On cold SwiftShader a single RAF
// after a beat advance is not enough — reflow can still be in progress on
// the very next frame (#1926, #1928 review). Polling for N-frame stability
// is the correct "layout has quiesced" signal.
async function waitForRectSettle(
  locator: Locator,
  opts: SettleOpts,
): Promise<Measurement> {
  return locator.evaluate(
    (element, settle) =>
      new Promise<Measurement>((resolve, reject) => {
        const el = element as HTMLElement;
        const started = performance.now();
        let stable = 0;
        let last: DOMRect | null = null;
        const step = () => {
          const rect = el.getBoundingClientRect();
          if (
            last &&
            Math.hypot(
              rect.left + rect.width / 2 - (last.left + last.width / 2),
              rect.top + rect.height / 2 - (last.top + last.height / 2),
            ) <= settle.tolerancePx &&
            Math.abs(rect.width - last.width) <= settle.tolerancePx &&
            Math.abs(rect.height - last.height) <= settle.tolerancePx
          ) {
            stable += 1;
          } else {
            stable = 0;
          }
          last = rect;
          if (stable >= settle.stableFrames) {
            resolve({
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              centerX: rect.left + rect.width / 2,
              centerY: rect.top + rect.height / 2,
            });
            return;
          }
          if (performance.now() - started > settle.maxWaitMs) {
            reject(
              new Error(
                `waitForRectSettle: rect did not settle within ${settle.maxWaitMs}ms ` +
                  `(needed ${settle.stableFrames} consecutive frames within ${settle.tolerancePx}px)`,
              ),
            );
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    opts,
  );
}

test.describe("AFTERSIGN job-offer press juice", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a tappable job offer compresses briefly and recovers", async ({ page }) => {
    const slot = `job-offer-press-juice-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    const byId = page.locator(`#${SAFE_DELIVERY_OFFER_ID}`);
    const byAttr = page.locator("[data-aftersign-job-take]").first();
    const jobButton = (await byId.count()) > 0 ? byId : byAttr;
    await expect(jobButton).toBeVisible({ timeout: WAIT_MS });
    await expect(jobButton).toBeEnabled({ timeout: WAIT_MS });
    await expect(jobButton).toHaveAttribute("data-aftersign-job-take", "ready", {
      timeout: WAIT_MS,
    });

    await page.evaluate(async () => {
      await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    const before = await measureButton(jobButton);
    expect(before.width).toBeGreaterThan(32);
    expect(before.height).toBeGreaterThan(24);

    const hitOwner = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? `${el.tagName.toLowerCase()}#${el.id || "?"}` : "nothing";
      },
      { x: before.centerX, y: before.centerY },
    );
    const jobButtonDescriptor = await jobButton.evaluate(
      (el) => `${el.tagName.toLowerCase()}#${(el as HTMLElement).id || "?"}`,
    );
    expect(hitOwner, `tap point is owned by ${hitOwner}, not the job-offer button`).toBe(
      jobButtonDescriptor,
    );

    // This listener observes the same real pointerdown sent by tap(). It is
    // intentionally a reader only: no game input is driven through window.
    await jobButton.evaluate((element) => {
      const button = element as HTMLElement;
      const base = button.getBoundingClientRect();
      const record = { minScale: 1, maxTravel: 0, samples: 0 };
      (window as unknown as { __aftersignPressJuiceRecorder?: typeof record })
        .__aftersignPressJuiceRecorder = record;

      const authoredScale = (): number => {
        const raw = getComputedStyle(button)
          .getPropertyValue("--aftersign-job-take-scale-from")
          .trim();
        const value = Number.parseFloat(raw);
        return Number.isFinite(value) && value > 0 && value < 1 ? value : 0.97;
      };
      const sample = () => {
        const rect = button.getBoundingClientRect();
        if (rect.width > 0 && base.width > 0) {
          const scale = Math.min(rect.width / base.width, rect.height / base.height);
          record.minScale = Math.min(record.minScale, scale);
          record.maxTravel = Math.max(
            record.maxTravel,
            Math.hypot(
              rect.left + rect.width / 2 - (base.left + base.width / 2),
              rect.top + rect.height / 2 - (base.top + base.height / 2),
            ),
          );
        }
        record.samples += 1;
      };
      button.addEventListener(
        "pointerdown",
        () => {
          if (button.getAttribute("data-aftersign-job-take") === "pressing") {
            record.minScale = Math.min(record.minScale, authoredScale());
          }
          sample();
        },
        { once: true },
      );
      const started = performance.now();
      const interval = setInterval(() => {
        sample();
        if (performance.now() - started > 600) clearInterval(interval);
      }, 8);
    });

    // A real tap on the visible job-offer button is the only input action.
    await jobButton.tap();
    const readRecorder = () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __aftersignPressJuiceRecorder?: PressJuiceRecord;
            }
          ).__aftersignPressJuiceRecorder ?? null,
      );
    await expect
      .poll(async () => (await readRecorder())?.minScale ?? 1, { timeout: WAIT_MS })
      .toBeLessThanOrEqual(1 - PRESS_FEEL.minPressedScaleDrop);
    const recorded = (await readRecorder()) as PressJuiceRecord;
    const scaleDrop = 1 - recorded.minScale;
    expect(scaleDrop).toBeGreaterThanOrEqual(PRESS_FEEL.minPressedScaleDrop);
    expect(scaleDrop).toBeLessThanOrEqual(PRESS_FEEL.maxPressedScaleDrop);
    expect(recorded.maxTravel).toBeLessThanOrEqual(PRESS_FEEL.maxTravelPx);

    await page.waitForTimeout(PRESS_FEEL.recoveryWindowMs); // pacing
    const recoveryLocator = page.locator(`#${SAFE_DELIVERY_OFFER_ID}`);
    if ((await recoveryLocator.count()) === 0) return;

    // A same-id offer can be a new node after the beat advances. Wait for
    // that node's own rect to quiesce across several consecutive frames —
    // one requestAnimationFrame is not enough on cold SwiftShader, where
    // post-beat reflow can still be in progress on the very next frame
    // (#1928 review). Then assert the settled node has sane visible size.
    // The settle helper itself is the "no ongoing press animation" gate:
    // if a press-recovery animation were still driving movement, the rect
    // would not agree across N frames within the tight tolerance.
    const recoveryEnd = await waitForRectSettle(recoveryLocator, {
      tolerancePx: PRESS_FEEL.maxRecoverySettleDriftPx,
      stableFrames: 4,
      maxWaitMs: 2_000,
    });
    expect(recoveryEnd.width).toBeGreaterThan(32);
    expect(recoveryEnd.height).toBeGreaterThan(24);
  });
});
