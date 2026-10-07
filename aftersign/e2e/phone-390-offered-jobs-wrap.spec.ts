import { expect, test, type Page } from "@playwright/test";

// Symptom 2 of #2193, split out and tracked separately as #2208.
// The sibling spec `phone-390-layout-regression.spec.ts` guards
// symptom 1 (dialogue double-render) and its header explicitly
// warns against adding symptom 2 there without a confirmed source
// fix — this file IS that fix's spec, kept in its own module so
// the two symptoms stay cleanly separated.
//
// Fail-on-main: on a 390×844 viewport the shipped offer-render
// path stamped the `#offeredJobs` tray with no `flex-direction`
// override, so the row-direction flex container compressed each
// pill until Latin labels broke mid-word ("delive/ry", "Mark/ed").
// The source fix in `applyPhoneOfferLayout` stamps
// `flex-direction: column` + `align-items: stretch` at phone
// widths, which lets each pill occupy a full row. We assert the
// RENDERED width of the real `#job-offer-job-safe-delivery`
// button (≥300px, no horizontal overflow, one text line) — a
// geometry assertion, not a property echo of the CSS the PR
// itself wrote (Soren AI003 on #2196).

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;

async function waitForReady(page: Page): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => Boolean((window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready)),
      { timeout: WAIT_MS },
    )
    .toBe(true);
}

test.describe("AFTERSIGN phone 390×844 offered-jobs wrap (#2208)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("390px phone keeps the safe-delivery offer in one usable tray row", async ({ page }) => {
    await page.goto("/aftersign/?slot=phone-390-offered-jobs-wrap", {
      waitUntil: "load",
    });
    await waitForReady(page);

    const offer = page.locator("#job-offer-job-safe-delivery");
    await expect(offer).toBeVisible({ timeout: WAIT_MS });

    const layout = await offer.evaluate((button) => {
      const range = document.createRange();
      range.selectNodeContents(button);
      const lines = Array.from(range.getClientRects());
      const rect = button.getBoundingClientRect();
      return {
        label: button.textContent?.replace(/\s+/g, " ").trim(),
        lineCount: lines.length,
        width: rect.width,
        clientWidth: button.clientWidth,
        scrollWidth: button.scrollWidth,
      };
    });

    expect(layout.label).toContain("Safe delivery");
    // At 390px viewport width, column stacking has to give the pill
    // enough room for its label to render on one line. 300px is the
    // floor Diego called out — anything narrower reproduces the
    // mid-word break.
    expect(layout.width).toBeGreaterThanOrEqual(300);
    // No horizontal overflow — the label fits inside its pill.
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    // One text line. Two or more lines means the browser broke the
    // word to fit the squeeze.
    expect(layout.lineCount).toBe(1);
  });
});
