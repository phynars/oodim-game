import { expect, type Browser, type Page } from "@playwright/test";

export const WAIT = 15_000;
export const MOBILE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

export async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector);
  await expect(control).toBeVisible({ timeout: WAIT });
  await control.tap();
}

export async function tapAdvance(page: Page, selector: string): Promise<void> {
  const before = await visibleStory(page);
  await tap(page, selector);
  await expect.poll(() => visibleStory(page), { timeout: WAIT }).not.toBe(before);
}

async function visibleStory(page: Page): Promise<string> {
  return page
    .locator("#line, [data-beat-id], #episodeTwoJob, #nikoThread, [data-ending-id], button")
    .evaluateAll((elements) => elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => `${element.getAttribute("data-beat-id") ?? element.id}:${element.textContent}:${element.getAttribute("aria-pressed")}:${element.hasAttribute("disabled")}`)
      .join("\n"));
}

async function beat(page: Page, id: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${id}"]`)).toBeVisible({ timeout: WAIT });
}

async function deliverOffered(page: Page, jobId: string, route?: "safe" | "risky"): Promise<void> {
  await beat(page, "packet-offered");
  await tap(page, `#offeredJobs button[data-offered-job-id="${jobId}"]`);
  await tapAdvance(page, "#packetButton");
  await beat(page, "packet-choice");
  if (route) {
    await tapAdvance(page, 'button[data-aftersign-tap-choice="take-the-long-way"]');
    if (route === "risky") await tapAdvance(page, 'button[data-aftersign-tap-choice="take-the-shortcut"]');
  }
  await tapAdvance(page, 'button[data-choice-id="acknowledge-kiosk"]');
  await tapAdvance(page, 'button[data-choice-id="deliver-packet"]');
  await beat(page, "io-return-recognition");
}

export async function playToDoor(page: Page, door: string, route: "safe" | "risky"): Promise<void> {
  await deliverOffered(page, "job-safe-delivery", route);
  await tapAdvance(page, 'button[data-return-reason="blunt"]:not([disabled])');
  await beat(page, "return-tone-choice");
  await tapAdvance(page, 'button[data-choice-id="ask-for-next-job"]');
  await beat(page, "io-next-job");
  await tapAdvance(page, 'button[data-choice-id="accept-second-packet"]');
  await tapAdvance(page, 'button[data-choice-id="deliver-packet"]');
  await deliverOffered(page, "job-night-transfer");
  await tapAdvance(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]');
  await tapAdvance(page, 'button[data-maud-name-choice="archive-decoy"]');
  await tapAdvance(page, 'button[data-choice-id="open-unlit-door"]');
  await tapAdvance(page, `button[data-choice-id="${door}"]`);
  await tapAdvance(page, "#beginEpisodeTwo");
}

export async function assertEnding(page: Page, jobName: string, answer: "take" | "refuse"): Promise<void> {
  const ending = page.locator('[data-ending-id="episode-two-act-one"]');
  await expect(ending).toBeVisible({ timeout: WAIT });
  await expect(ending).toContainText("Episode 2 — Act I");
  await expect(ending).toContainText(jobName);
  await expect(ending).toHaveAttribute("data-niko-shortcut-answer", answer);
  const box = await ending.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
}

export async function assertFreshContext(browser: Browser, url: string, jobName: string, answer: "take" | "refuse"): Promise<void> {
  const context = await browser.newContext(MOBILE);
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    await assertEnding(page, jobName, answer);
  } finally {
    await context.close();
  }
}
