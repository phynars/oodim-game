import { expect, test, type Page } from "@playwright/test";

const PHONE = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, id: string): Promise<void> {
  const control = page.locator(`button[data-choice-id="${id}"]:not([disabled])`).first();
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await control.tap();
}

async function reachNextJob(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await page.locator("#packetButton").tap();
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
}

test.describe("AFTERSIGN titled intro, readable jobs, and Io dialogue (#3020)", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("shows AFTERSIGN and orientation before the first job control at 390x844", async ({ page }) => {
    await page.goto(`/aftersign/?start=1&slot=titled-intro-${Date.now()}`, { waitUntil: "load" });
    const title = page.getByRole("heading", { name: "AFTERSIGN" });
    const orientation = page.locator("#startScreenMessage");
    const start = page.getByRole("button", { name: "Start the shift" });
    await expect(title).toBeVisible();
    await expect(orientation).toBeVisible();
    expect((await orientation.boundingBox())!.y).toBeLessThan((await start.boundingBox())!.y);
  });

  test("reaches every second-job control by page scrolling at 390x844", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/aftersign/?slot=page-scroll-${Date.now()}`, { waitUntil: "load" });
    await reachNextJob(page);
    const controls = page.locator(
      "#offeredJobs button:not([disabled]), #deliverButton:not([disabled]), #acknowledgeRouteButton:not([disabled]), #skipRouteButton:not([disabled])",
    );
    await expect(controls).toHaveCount(3);
    await page.mouse.wheel(0, 2_000);
    for (const control of await controls.all()) await expect(control).toBeInViewport();
    await expect(page.locator(".panel")).toHaveCSS("overflow-y", "visible");
  });

  test("renders each Io remark separately after tapping Ask for next job", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/aftersign/?slot=io-remarks-${Date.now()}`, { waitUntil: "load" });
    await reachNextJob(page);
    const remarks = page.locator("#line > .io-remark");
    await expect(remarks).toHaveCount(4);
    for (const remark of await remarks.all()) await expect(remark).toBeVisible();
  });

  test("does not expose a non-transitioning Red tag — Saint Orra button", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/aftersign/?slot=red-tag-transition-${Date.now()}`, { waitUntil: "load" });
    await reachNextJob(page);
    await tapChoice(page, "accept-second-packet");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-offered");
    const redTag = page.locator("#packetButton");
    await expect(redTag).toHaveText("Red tag — Saint Orra");
    await redTag.tap();
    await waitForBeat(page, "packet-choice");
  });
});
