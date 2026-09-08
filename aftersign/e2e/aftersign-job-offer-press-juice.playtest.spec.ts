import { expect, test, type Locator, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const PRESS_FEEL = {
  recoveryWindowMs: 480,
  minPressedScaleDrop: 0.015,
  maxPressedScaleDrop: 0.08,
  maxTravelPx: 6,
};

const SAFE_DELIVERY_OFFER_ID = "job-offer-job-safe-delivery";

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
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

type Measurement = {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

async function measureButton(locator: Locator): Promise<Measurement> {
  return await locator.evaluate((element) => {
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

test.describe("AFTERSIGN job-offer press juice", () => {
  test.use({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });

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
    await expect(jobButton).toHaveAttribute(
      "data-aftersign-job-take",
      "ready",
      { timeout: WAIT_MS },
    );

    await page.evaluate(async () => {
      await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });

    const before = await measureButton(jobButton);
    expect(before.width).toBeGreaterThan(32);
    expect(before.height).toBeGreaterThan(24);

    const hitOwner = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? `${el.tagName.toLowerCase()}#${el.id || "?"}` : "nothing";
      },
      { x: before.left + before.width / 2, y: before.top + before.height / 2 },
    );
    const jobButtonDescriptor = await jobButton.evaluate(
      (el) => `${el.tagName.toLowerCase()}#${(el as HTMLElement).id || "?"}`,
    );
    expect(
      hitOwner,
      `tap point is owned by ${hitOwner}, not the job-offer button — a covering/reflowed element`,
    ).toBe(jobButtonDescriptor);

    // getBoundingClientRect reports layout dimensions, which deliberately
    // exclude CSS transforms. Record the rendered matrix instead so this
    // observes the scale the player sees during the real touch envelope.
    await jobButton.evaluate((element) => {
      const h = element as HTMLElement & {
        __pressJuiceRecorder?: { minScale: number; maxTravel: number; samples: number };
      };
      const base = h.getBoundingClientRect();
      const rec = { minScale: 1, maxTravel: 0, samples: 0 };
      h.__pressJuiceRecorder = rec;
      const t0 = performance.now();
      const sample = () => {
        const r = h.getBoundingClientRect();
        const transform = getComputedStyle(h).transform;
        const matrix = transform.match(/^matrix\(([^)]+)\)$/);
        const values = matrix?.[1].split(",").map(Number);
        const scale = values && values.length === 6
          ? Math.min(Math.hypot(values[0], values[1]), Math.hypot(values[2], values[3]))
          : 1;
        if (scale < rec.minScale) rec.minScale = scale;
        const travel = Math.hypot(
          r.left + r.width / 2 - (base.left + base.width / 2),
          r.top + r.height / 2 - (base.top + base.height / 2),
        );
        if (travel > rec.maxTravel) rec.maxTravel = travel;
        rec.samples += 1;
      };
      const interval = setInterval(() => {
        sample();
        if (performance.now() - t0 > 600) clearInterval(interval);
      }, 8);
      const raf = () => {
        sample();
        if (performance.now() - t0 <= 600) requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    });

    // Real phone tap on the visible shipped job-offer button.
    await jobButton.tap();

    await expect
      .poll(
        () =>
          jobButton.evaluate(
            (element) =>
              (element as HTMLElement & { __pressJuiceRecorder?: { minScale: number } })
                .__pressJuiceRecorder?.minScale ?? 1,
          ),
        { timeout: 2_000 },
      )
      .toBeLessThanOrEqual(1 - PRESS_FEEL.minPressedScaleDrop);

    const recorded = await jobButton.evaluate(
      (element) =>
        (element as HTMLElement & {
          __pressJuiceRecorder?: { minScale: number; maxTravel: number; samples: number };
        }).__pressJuiceRecorder ?? { minScale: 1, maxTravel: 0, samples: 0 },
    );
    const scaleDrop = 1 - recorded.minScale;
    expect(scaleDrop).toBeGreaterThanOrEqual(PRESS_FEEL.minPressedScaleDrop);
    expect(scaleDrop).toBeLessThanOrEqual(PRESS_FEEL.maxPressedScaleDrop);
    expect(recorded.maxTravel).toBeLessThanOrEqual(PRESS_FEEL.maxTravelPx);

    await page.waitForTimeout(PRESS_FEEL.recoveryWindowMs);

    const recoveryLocator = page.locator(`#${SAFE_DELIVERY_OFFER_ID}`);
    const recoveredCount = await recoveryLocator.count();
    if (recoveredCount === 0) return;

    const recovered = await measureButton(recoveryLocator);
    const recoveredScaleX = recovered.width / before.width;
    const recoveredScaleY = recovered.height / before.height;
    const recoveredTravel = Math.hypot(
      recovered.centerX - before.centerX,
      recovered.centerY - before.centerY,
    );

    expect(Math.abs(1 - recoveredScaleX)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(1 - recoveredScaleY)).toBeLessThanOrEqual(0.03);
    expect(recoveredTravel).toBeLessThanOrEqual(1.5);
  });
});
