import { expect, test, type Page } from "@playwright/test";

// Served gameplay coverage; `aftersign/playwright.config.ts` runs this file
// against the Worker-backed page and `check:served` recognizes the marker.
// @served
const PHONE = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;
type Ending = { choice: "remembered-name" | "archive-decoy"; id: string };
const endings: Ending[] = [
  { choice: "remembered-name", id: "maud-bell-archive-lit" },
  { choice: "archive-decoy", id: "maud-bell-archive-dark" },
];
const unique = (tag: string) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function tap(page: Page, selector: string) {
  const target = page.locator(selector).first();
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await target.tap();
}

async function endingByVisibleTaps(page: Page, ending: Ending) {
  await tap(page, '#offeredJobs button[data-offered-job-id="job-safe-delivery"]');
  await tap(page, "#packetButton");
  await tap(page, 'button[data-choice-id="acknowledge-kiosk"]');
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await tap(page, 'button[data-return-reason="blunt"]');
  await tap(page, 'button[data-choice-id="ask-for-next-job"]');
  await tap(page, 'button[data-choice-id="accept-second-packet"]');
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await tap(page, '#offeredJobs button[data-offered-job-id="job-night-transfer"]');
  await tap(page, "#packetButton");
  await tap(page, 'button[data-choice-id="acknowledge-kiosk"]');
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await tap(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]');
  await tap(page, `button[data-maud-name-choice="${ending.choice}"]`);
  const card = page.locator(`[data-ending-id="${ending.id}"]`);
  await expect(card).toBeVisible({ timeout: WAIT_MS });
  return card;
}

test.describe("Act II bell ending containment (#2870)", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("shows each Act II bell ending through its final line at 390x844 without a swipe", async ({ page }) => {
    test.setTimeout(240_000);
    for (const ending of endings) {
      await page.goto(`/aftersign/?slot=${unique("bell")}&player=${unique("player")}`, { waitUntil: "load" });
      const card = await endingByVisibleTaps(page, ending);
      const finalLine = card.locator(".episode-one-ending__light");
      await expect(finalLine).toBeVisible();
      // PR #2942 F2: the same panel-clip contract as the Episode 2 spec —
      // no inner scrollport between the line and `.panel`, inside the
      // panel and viewport, and not covered at its centre.
      await expect.poll(async () => finalLine.evaluate((node) => {
        const panel = node.closest(".panel");
        if (!panel) return false;
        for (let ancestor = node.parentElement; ancestor && ancestor !== panel; ancestor = ancestor.parentElement) {
          if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(ancestor).overflowY)) return false;
        }
        const rect = node.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return rect.top >= 0
          && rect.bottom <= window.innerHeight
          && rect.top >= panelRect.top
          && rect.bottom <= panelRect.bottom
          && Boolean(hit && (hit === node || node.contains(hit)));
      }), { timeout: WAIT_MS }).toBe(true);
    }
  });

  test("keeps a completed bell ending after taps on every visible earlier-stage control, and Ask for next job never returns", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`/aftersign/?slot=${unique("bell-stale")}&player=${unique("player")}`, { waitUntil: "load" });
    const card = await endingByVisibleTaps(page, endings[0]);
    const endingId = await card.getAttribute("data-ending-id");
    const outcome = await card.locator(".episode-one-ending__outcome").textContent();
    const askForNextJob = page.locator('button[data-choice-id="ask-for-next-job"]:visible');
    // These earlier-stage controls stay on screen beside Maud's card at
    // 390x844. Ask for next job is gone once the ending commits, so the
    // check is that tapping the stale controls can't bring it (or a new
    // beat) back.
    await expect(askForNextJob).toHaveCount(0);
    for (const selector of ["#deliverButton", "#acknowledgeRouteButton", "#skipRouteButton", "#packetButton"]) {
      const stale = page.locator(`${selector}:visible`);
      await expect(stale).toBeVisible();
      await stale.tap();
      await expect(card).toBeVisible();
      await expect(askForNextJob).toHaveCount(0);
    }
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-ending-id", endingId ?? "");
    await expect(card.locator(".episode-one-ending__outcome")).toHaveText(outcome ?? "");
  });
});
