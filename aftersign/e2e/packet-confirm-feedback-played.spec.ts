import { expect, test } from "@playwright/test";

/**
 * Served-page feel gate: a player pointer action must visibly wake the
 * interaction-confirm channel. This deliberately never drives __game input;
 * __game is read only after the rendered control receives the click.
 *
 * Constants are pinned against the shipped feel token
 * (`aftersign/src/interactionConfirmFeel.js` — `INTERACTION_CONFIRM_FEEL`,
 * consumed at `aftersign/main.js:653` as `CONFIRM_FEEDBACK` and spread onto
 * `state.interaction.confirmFeedback` at main.js:869-870 and :3823-3824):
 *   durationMs: 220
 *   easing:     "easeOutCubic"
 *
 * The `--confirm-shake-x` CSS custom property is written on
 * `document.documentElement` (main.js:3857, :4159) and inherits down to
 * `#hud`, where index.html:488 consumes it as `translate3d(var(...), ...)`.
 * Reading it via `getComputedStyle(#hud).getPropertyValue(...)` returns the
 * inherited value (e.g. `"10px"`); we strip `px` before numeric compare so
 * the non-zero check is real, not a NaN-passing bypass.
 */
test("a packet confirmation gives the player a visible 220ms confirm pulse", async ({ page }) => {
  // Absolute-relative path against the vite preview server. baseURL is
  // `http://localhost:4374/aftersign/` (aftersign/playwright.config.ts) but
  // relative `page.goto("/")` resolves to `http://localhost:4374/` — the
  // server root, which does NOT serve the aftersign app. Sibling specs
  // consistently `goto("/aftersign/…")`; match that shape.
  await page.goto("/aftersign/", { waitUntil: "load" });

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
        const feedback = game?.interaction?.confirmFeedback;
        return {
          active: feedback?.active === true,
          durationMs: feedback?.durationMs ?? 0,
          easing: feedback?.easing ?? "",
        };
      }),
    )
    .toMatchObject({
      active: true,
      durationMs: 220,
      easing: "easeOutCubic",
    });

  // Non-zero HUD shake — the CSS variable pushed by main.js:4159 during
  // the confirm envelope. Strip the `px` suffix before `Number()` so
  // `"10px"` parses to `10`, not `NaN`. Poll because the envelope only
  // wobbles for one frame after the click.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const hud = document.querySelector("#hud") as HTMLElement | null;
        const raw = hud
          ? getComputedStyle(hud).getPropertyValue("--confirm-shake-x")
          : "0";
        return Number(raw.replace("px", "").trim());
      }),
    )
    .not.toBe(0);
});
