import { expect, test } from "@playwright/test";

// #1723 — target-loss FEEL contract, played end-to-end on the served
// page. The player's press-and-release on `#packetButton` is the
// gesture that owns the "had a target → lost it" edge; the visible
// `#aimReticle` snaps to its neutral transform IN THE SAME FRAME as
// the release (no residue from a held target), while
// `#targetLossPrompt` fades linearly from 1 to 0 over the 100ms
// envelope authored in `targetLossFeedback.ts`.
//
// Selectors are the shipped ids in `aftersign/index.html`
// (`#aimReticle`, `#targetLossPrompt`) — NOT `#reticle`, which does
// not exist in the served markup. The prior draft of this spec used
// `#reticle` and the whole assertion chain was querying a null node.
test("packet target loss clears the aim reticle immediately and fades its prompt", async ({ page }) => {
  await page.goto("/aftersign/");

  const packet = page.locator("#packetButton");
  const aimReticle = page.locator("#aimReticle");
  const prompt = page.locator("#targetLossPrompt");
  await expect(packet).toBeVisible();

  const box = await packet.boundingBox();
  if (!box) throw new Error("packet button has no pointer target");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  // Press: the target-loss timer arms on the release, so we hold long
  // enough to matter, then let go. The release path in main.js
  // (`packetRelease`) stamps the first-loss frame (neutral transform,
  // opacity 1) synchronously — no rAF required.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(20);
  await page.mouse.up();

  // First-loss frame: reticle is neutral, prompt is fully visible.
  await expect(aimReticle).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(prompt).toHaveCSS("opacity", "1");

  // Past the 100ms envelope: the next tick's `syncTargetLossFeedback`
  // reads `feedback.active === false`, writes opacity 0, and nulls the
  // timer so a stale prompt cannot smear into the next beat.
  await expect(prompt).toHaveCSS("opacity", "0", { timeout: 400 });
});
