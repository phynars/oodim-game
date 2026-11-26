import { expect, test, type Page } from "@playwright/test";

const PHONE = { width: 390, height: 844 } as const;
const WAIT = 15_000;

async function beat(page: Page, id: string) {
  await expect(page.locator(`[data-beat-id="${id}"]`)).toBeVisible({ timeout: WAIT });
}

async function tap(page: Page, selector: string) {
  const control = page.locator(selector).first();
  await expect(control).toBeVisible({ timeout: WAIT });
  await control.tap();
}

async function tapChoice(page: Page, id: string) {
  await tap(page, `button[data-choice-id="${id}"]:not([disabled])`);
}

async function reachArchive(page: Page) {
  await beat(page, "packet-offered");
  await tap(page, '#offeredJobs button[data-offered-job-id="job-safe-delivery"]');
  await tap(page, "#packetButton");
  await beat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await beat(page, "io-return-recognition");
  await tap(page, 'button[data-return-reason="blunt"]:not([disabled])');
  await beat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await beat(page, "io-next-job");
  await tapChoice(page, "accept-second-packet");
  await tapChoice(page, "deliver-packet");
  await beat(page, "packet-offered");
  await tap(page, '#offeredJobs button[data-offered-job-id="job-night-transfer"]');
  const deliver = page.getByRole("button", { name: "Deliver packet" });
  await expect(deliver).toBeInViewport({ ratio: 1 });
  await tap(page, "#packetButton");
  await beat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await beat(page, "io-return-recognition");
}

test.describe("Bell Archive phone reachability (#3084)", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("tap-only reveals remain completely in the phone viewport", async ({ page }) => {
    test.setTimeout(120_000);
    const slot = `bell-phone-reach-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}&player=${slot}`, { waitUntil: "load" });
    await reachArchive(page);

    await tap(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])');
    const name = page.locator('button[data-maud-name-choice="remembered-name"]');
    await expect(name).toBeInViewport({ ratio: 1 });
    await name.tap();

    await expect(page.getByRole("button", { name: "Go to the Unlit Door" })).toBeInViewport({ ratio: 1 });
  });
});
