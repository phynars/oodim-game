import { expect, test } from "@playwright/test";

/**
 * Player-facing contract for the second packet: the round-two offer must
 * remain red-tagged from the tray through delivery.
 *
 * The game exposes its board as real buttons; this test deliberately drives
 * those controls rather than mutating window.__game state.
 */
test("red-tag second packet carries its route through round-two delivery", async ({ page }) => {
  await page.goto("/aftersign/");

  // Round one: seal the first packet through the visible board controls.
  await page.getByRole("button", { name: /seal packet/i }).click();
  await page.getByRole("button", { name: /next packet/i }).click();

  // The round-two tray must offer the red-tag packet and its literal route.
  const redPacket = page.getByRole("button", { name: /red tag/i });
  await expect(redPacket).toBeVisible();
  await expect(page.getByText(/red tag/i)).toBeVisible();
  await expect(page.getByText(/blue tag/i)).toHaveCount(0);

  await redPacket.click();

  // Accepting it keeps the red tag on both the carried-packet control and
  // every player-visible route choice.
  const packetButton = page.getByRole("button", { name: /packet.*red tag|red tag.*packet/i });
  await expect(packetButton).toBeVisible();
  await expect(page.getByRole("button", { name: /red tag/i })).toHaveCount(1);

  const routeChoices = page.getByRole("button", { name: /route.*red tag|red tag.*route/i });
  await expect(routeChoices.first()).toBeVisible();
  await expect(page.getByRole("button", { name: /route.*blue tag|blue tag.*route/i })).toHaveCount(0);

  // A player chooses a visible route and completes delivery; the final beat
  // must still name the red tag, never the blue one.
  await routeChoices.first().click();
  await expect(page.getByText(/delivered.*red tag|red tag.*delivered/i)).toBeVisible();
  await expect(page.getByText(/delivered.*blue tag|blue tag.*delivered/i)).toHaveCount(0);
});
