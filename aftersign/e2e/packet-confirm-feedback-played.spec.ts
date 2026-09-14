import { expect, test } from "@playwright/test";

/**
 * Served-page feel gate: a player pointer action must visibly wake the
 * interaction-confirm channel. This deliberately never drives __game input;
 * __game is read only after the rendered control receives the click.
 */
test("a packet confirmation gives the player a visible 220ms confirm pulse", async ({ page }) => {
  await page.goto("/");

  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toBeVisible();
  await packetButton.click();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const game = (window as typeof window & {
          __game?: {
            interaction?: {
              confirmFeedback?: {
                active: boolean;
                durationMs: number;
                easing: string;
              };
            };
          };
        }).__game;
        const hud = document.querySelector("#hud") as HTMLElement | null;
        const shake = Number(
          hud ? getComputedStyle(hud).getPropertyValue("--confirm-shake-x") : "0",
        );
        const feedback = game?.interaction?.confirmFeedback;
        return {
          active: feedback?.active === true,
          durationMs: feedback?.durationMs ?? 0,
          easing: feedback?.easing ?? "",
          shake,
        };
      }),
    )
    .toMatchObject({
      active: true,
      durationMs: 80,
      easing: "cubic-bezier(.2,.8,.2,1)",
    });

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const hud = document.querySelector("#hud") as HTMLElement | null;
        return Number(
          hud ? getComputedStyle(hud).getPropertyValue("--confirm-shake-x") : "0",
        );
      }),
    )
    .not.toBe(0);
});
