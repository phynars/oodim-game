import { expect, test, type Page } from "@playwright/test";

const WAIT_MS = 10_000;
const PHONE_VIEWPORT = { width: 390, height: 844 };

type PointerRenderSample = {
  pointerAtMs: number;
  renderedAtMs: number;
  deltaMs: number;
  frameBudgetMs: number;
  withinBudget: boolean;
};

type PointerRenderReport = {
  samples: PointerRenderSample[];
  latest?: PointerRenderSample;
};

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

const readPointerRenderReport = (page: Page): Promise<PointerRenderReport | null> =>
  page.evaluate(() => {
    const game = window as unknown as {
      __game?: {
        input?: { getPointerToRenderLatencyReport?: () => PointerRenderReport };
      };
    };
    return game.__game?.input?.getPointerToRenderLatencyReport?.() ?? null;
  });

test.describe("AFTERSIGN main.js pointer-to-render timing", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a visible served choice records and closes a bounded render sample", async ({ page }) => {
    const slot = `main-pointer-render-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    const offer = page.locator("#job-offer-job-safe-delivery");
    await expect(offer).toBeVisible({ timeout: WAIT_MS });
    await expect(offer).toBeEnabled({ timeout: WAIT_MS });

    // The player action is a phone tap on the rendered offer, never a
    // window.__game input hook. The report is assertion-only telemetry.
    await offer.tap();

    await expect
      .poll(async () => await readPointerRenderReport(page), { timeout: WAIT_MS })
      .toMatchObject({
        latest: {
          pointerAtMs: expect.any(Number),
          renderedAtMs: expect.any(Number),
          deltaMs: expect.any(Number),
          frameBudgetMs: 16.7,
        },
      });

    const report = await readPointerRenderReport(page);
    expect(report, "main.js must expose a served pointer-to-render report").not.toBeNull();
    expect(report?.samples.length, "the real tap must close a render sample").toBeGreaterThan(0);
    expect(report?.latest?.renderedAtMs).toBeGreaterThanOrEqual(
      report?.latest?.pointerAtMs ?? Number.POSITIVE_INFINITY,
    );
    expect(report?.latest?.deltaMs).toBeLessThanOrEqual(1_000);
  });
});
