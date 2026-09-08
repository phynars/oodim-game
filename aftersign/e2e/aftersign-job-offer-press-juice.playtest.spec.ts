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

    // getBoundingClientRect reports LAYOUT dimensions, which deliberately
    // exclude CSS transforms — the compression envelope on ioJobOfferActionFeel
    // (`transform: translateY(0) scale(0.985)` at :154, with `will-change:
    // transform` at :139) shows up only in the rendered matrix. Parse the
    // computed transform in ALL shapes the browser may emit — `none`,
    // `matrix(a,b,c,d,e,f)`, `matrix3d(...)`, and the pre-normalized shorthand
    // strings — and capture the first-seen non-identity string so the diag
    // trail names the actual shape when CI reds. The prior anchored regex
    // `/^matrix\(([^)]+)\)$/` fell through to `scale=1` on `matrix3d(...)` (the
    // shape headless promotes to under `will-change: transform`), which is
    // exactly the "Received: 1" red on this branch.
    await jobButton.evaluate((element) => {
      const h = element as HTMLElement & {
        __pressJuiceRecorder?: {
          minScale: number;
          maxTravel: number;
          samples: number;
          firstNonIdentityTransform: string | null;
          lastTransform: string | null;
        };
      };
      const base = h.getBoundingClientRect();
      const rec = {
        minScale: 1,
        maxTravel: 0,
        samples: 0,
        firstNonIdentityTransform: null as string | null,
        lastTransform: null as string | null,
      };
      h.__pressJuiceRecorder = rec;
      const parseScale = (t: string): number => {
        // `none` (or empty) — identity.
        if (!t || t === "none") return 1;
        // 2D matrix — matrix(a, b, c, d, e, f). Scale = min(|col1|, |col2|).
        const m2 = t.match(/^matrix\(\s*([^)]+)\)\s*$/);
        if (m2) {
          const v = m2[1].split(",").map((s) => Number(s.trim()));
          if (v.length === 6 && v.every((n) => Number.isFinite(n))) {
            return Math.min(Math.hypot(v[0], v[1]), Math.hypot(v[2], v[3]));
          }
        }
        // 3D matrix — matrix3d(m11..m44). Scale is derived from the first two
        // basis columns (m11,m12,m13 and m21,m22,m23); for a pure 2D press
        // this collapses to |col1|/|col2| of the 3D form.
        const m3 = t.match(/^matrix3d\(\s*([^)]+)\)\s*$/);
        if (m3) {
          const v = m3[1].split(",").map((s) => Number(s.trim()));
          if (v.length === 16 && v.every((n) => Number.isFinite(n))) {
            const sx = Math.hypot(v[0], v[1], v[2]);
            const sy = Math.hypot(v[4], v[5], v[6]);
            return Math.min(sx, sy);
          }
        }
        // Shorthand `scale(x[,y])` / `scale3d(...)` — some engines leave the
        // author string un-normalized on very fast reads. Extract the smallest
        // scale factor present.
        const s2 = t.match(/scale(?:3d)?\(\s*([^)]+)\)/);
        if (s2) {
          const nums = s2[1].split(",").map((s) => Number(s.trim())).filter((n) =>
            Number.isFinite(n),
          );
          if (nums.length > 0) return Math.min(...nums);
        }
        // Unknown shape — return NaN so the caller doesn't silently pin to 1.
        return Number.NaN;
      };
      const sample = () => {
        const r = h.getBoundingClientRect();
        const transform = getComputedStyle(h).transform;
        rec.lastTransform = transform;
        const scale = parseScale(transform);
        if (Number.isFinite(scale)) {
          if (scale < rec.minScale) rec.minScale = scale;
          if (scale < 1 && rec.firstNonIdentityTransform === null) {
            rec.firstNonIdentityTransform = transform;
          }
        }
        const travel = Math.hypot(
          r.left + r.width / 2 - (base.left + base.width / 2),
          r.top + r.height / 2 - (base.top + base.height / 2),
        );
        if (travel > rec.maxTravel) rec.maxTravel = travel;
        rec.samples += 1;
      };
      const t0 = performance.now();
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
          __pressJuiceRecorder?: {
            minScale: number;
            maxTravel: number;
            samples: number;
            firstNonIdentityTransform: string | null;
            lastTransform: string | null;
          };
        }).__pressJuiceRecorder ?? {
          minScale: 1,
          maxTravel: 0,
          samples: 0,
          firstNonIdentityTransform: null,
          lastTransform: null,
        },
    );
    const scaleDrop = 1 - recorded.minScale;
    // If the recorder never observed a compressed frame, surface the actual
    // computed-transform shape it *did* see so a future red names the paint
    // it's missing (identity `none`, an un-promoted `matrix(...)`, the
    // 3D-promoted `matrix3d(...)`, or an unknown shorthand) instead of the
    // opaque `Received: 1` this branch red on.
    expect(
      scaleDrop,
      `no compressed frame observed — samples=${recorded.samples} ` +
        `lastTransform=${JSON.stringify(recorded.lastTransform)} ` +
        `firstNonIdentity=${JSON.stringify(recorded.firstNonIdentityTransform)}`,
    ).toBeGreaterThanOrEqual(PRESS_FEEL.minPressedScaleDrop);
    expect(scaleDrop).toBeLessThanOrEqual(PRESS_FEEL.maxPressedScaleDrop);
    expect(recorded.maxTravel).toBeLessThanOrEqual(PRESS_FEEL.maxTravelPx);

    await page.waitForTimeout(PRESS_FEEL.recoveryWindowMs); // pacing

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
