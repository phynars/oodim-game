import { expect, test } from "@playwright/test";

// This is intentionally a served-page test: it never manufactures the job
// button and it never causes input through window.__game.input.*.
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

test.describe("two durable saves render divergent tappable job copy", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  async function bootWithSave(
    page: import("@playwright/test").Page,
    save: Record<string, unknown>,
  ) {
    await page.addInitScript((durableSave) => {
      localStorage.setItem("aftersign-durable-save", JSON.stringify(durableSave));
    }, save);
    await page.goto("/aftersign/index.html");

    const takeJob = page.locator("button[data-aftersign-job-take]");
    await expect(takeJob).toBeVisible();
    return {
      route: await takeJob.getAttribute("data-route-copy"),
      risk: await takeJob.getAttribute("data-risk-copy"),
    };
  }

  test("firstRun and sealed-delivered trusted saves expose different rendered route and risk actions", async ({ page }) => {
    const firstRun = await bootWithSave(page, { state: "firstRun" });
    const trusted = await bootWithSave(page, {
      state: "trusted",
      priorOutcome: "packet.delivered",
      sealedDelivered: true,
    });

    expect(firstRun.route).toBeTruthy();
    expect(firstRun.risk).toBeTruthy();
    expect(trusted.route).toBeTruthy();
    expect(trusted.risk).toBeTruthy();
    expect([trusted.route, trusted.risk]).not.toEqual([firstRun.route, firstRun.risk]);

    // Reloading the same durable save must preserve its visible offer.
    const trustedAgain = await bootWithSave(page, {
      state: "trusted",
      priorOutcome: "packet.delivered",
      sealedDelivered: true,
    });
    expect(trustedAgain).toEqual(trusted);
  });
});
