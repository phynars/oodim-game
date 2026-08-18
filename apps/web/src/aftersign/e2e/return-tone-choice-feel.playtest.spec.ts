import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };

async function tapVisibleContinue(page: import("@playwright/test").Page) {
  const visibleControls = page.getByRole("button").filter({ hasText: /continue|next|begin|start|ok|deliver|return|again/i });
  const count = await visibleControls.count();
  if (count > 0) {
    await visibleControls.first().tap();
    return;
  }

  await page.locator("body").tap({ position: { x: PHONE_VIEWPORT.width / 2, y: PHONE_VIEWPORT.height * 0.82 } });
}

test.describe("AFTERSIGN return-tone choice feel", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("confirms a visible return-tone choice with a tactile on-screen response", async ({ page }) => {
    await page.goto("/aftersign/");

    const game = page.locator("body");
    await expect(game).toBeVisible();

    for (let i = 0; i < 14; i += 1) {
      const returnToneChoice = page.getByRole("button", { name: /quiet|honest|bright|steady|defiant|gentle|tone/i }).first();
      if (await returnToneChoice.isVisible().catch(() => false)) {
        await expect(returnToneChoice).toBeVisible();
        await returnToneChoice.tap();

        await expect(
          page.getByText(/choice|chosen|tone|heard|remember|next job|packet|io/i).first(),
        ).toBeVisible({ timeout: 1200 });

        const assertionSurface = await page.evaluate(() => {
          const maybeGame = (window as unknown as { __game?: { beat?: string; scene?: string; input?: unknown } }).__game;
          return {
            beat: maybeGame?.beat ?? maybeGame?.scene ?? null,
            hasHarnessInput: Boolean(maybeGame?.input),
          };
        });

        expect(String(assertionSurface.beat ?? "")).toMatch(/return-tone|next-job|tone|job/i);
        return;
      }

      await tapVisibleContinue(page);
    }

    throw new Error("Return-tone choice was not reachable by visible taps on the phone viewport.");
  });
});
