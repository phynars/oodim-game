import { expect, test, type Page } from "@playwright/test";

const WAIT = 15_000;

test.describe("Niko Thread shortcut (#2926)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const [route, routeText, answer, answerText] of [
    ["safe", "safe route", "take", "Take the shortcut"],
    ["risky", "risky route", "refuse", "Refuse the shortcut"],
  ] as const) {
    test(`names the ${route} route and durably ${answer}s the shortcut`, async ({ page }) => {
      test.setTimeout(240_000);
      const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      await page.goto(`/aftersign/?slot=niko-${route}-${token}&player=niko-${token}`, { waitUntil: "load" });
      await playToDoor(page, "keep-official-record");
      await tap(page, "#acceptEpisodeTwoJob:not([disabled])");
      const niko = page.locator("#nikoThread");
      await expect(niko).toBeVisible({ timeout: WAIT });
      await expect(niko).toHaveAttribute("data-npc", "niko-thread");
      await expect(niko.locator("[data-niko-route]")).toHaveAttribute("data-niko-route", route);
      await expect(niko).toContainText(routeText);
      const choice = page.locator(`[data-niko-shortcut-choice="${answer}"]`);
      await expect(choice).toHaveText(answerText);
      await choice.tap();
      await expect(page.locator("[data-niko-shortcut-answer]")).toHaveAttribute(
        "data-niko-shortcut-answer",
        answer,
      );
      await page.reload({ waitUntil: "load" });
      await expect(page.locator("[data-niko-shortcut-answer]")).toHaveAttribute(
        "data-niko-shortcut-answer",
        answer,
        { timeout: WAIT },
      );
      await expect(page.locator(`[data-niko-shortcut-choice="${answer}"]`)).toBeDisabled();
      await expect(page.locator("[data-niko-shortcut-choice]")).toHaveCount(2);
      await expect(page.locator("[data-niko-shortcut-choice]:not([disabled])")).toHaveCount(0);
    });
  }
});

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector);
  await expect(control).toBeVisible({ timeout: WAIT });
  await control.tap();
}

async function beat(page: Page, id: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${id}"]`)).toBeVisible({ timeout: WAIT });
}

async function deliverOffered(page: Page, jobId: string, route?: "safe" | "risky"): Promise<void> {
  await beat(page, "packet-offered");
  await tap(page, `#offeredJobs button[data-offered-job-id="${jobId}"]`);
  await tap(page, "#packetButton");
  await beat(page, "packet-choice");
  if (route === "safe") {
    await tap(page, 'button[data-aftersign-tap-choice="take-the-long-way"]');
  } else if (route === "risky") {
    // The fresh tray offers recovery/safe actions. The first visible tap
    // changes the offered set; the second is the visible fast-route action.
    await tap(page, 'button[data-aftersign-tap-choice="take-the-long-way"]');
    const shortcut = page.locator('button[data-aftersign-tap-choice="take-the-shortcut"]');
    await expect(shortcut).toBeVisible({ timeout: WAIT });
    await expect(shortcut).toBeEnabled({ timeout: WAIT });
    await shortcut.tap();
  }
  await tap(page, 'button[data-choice-id="acknowledge-kiosk"]');
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await beat(page, "io-return-recognition");
}

async function playToDoor(page: Page, door: string): Promise<void> {
  const route = page.url().includes("niko-safe-") ? "safe" : "risky";
  await deliverOffered(page, "job-safe-delivery", route);
  await tap(page, 'button[data-return-reason="blunt"]:not([disabled])');
  await beat(page, "return-tone-choice");
  await tap(page, 'button[data-choice-id="ask-for-next-job"]');
  await beat(page, "io-next-job");
  await tap(page, 'button[data-choice-id="accept-second-packet"]');
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await deliverOffered(page, "job-night-transfer");
  await tap(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]');
  await tap(page, 'button[data-maud-name-choice="archive-decoy"]');
  await tap(page, 'button[data-choice-id="open-unlit-door"]');
  await tap(page, `button[data-choice-id="${door}"]`);
  await tap(page, "#beginEpisodeTwo");
}
