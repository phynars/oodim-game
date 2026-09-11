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

  // Press-and-release: the `syncTargetLossFeedback` wiring only flips
  // `data-target-loss-active` to `"true"` on the RELEASE edge — while
  // the pointer is held, `hasTarget === true` writes the attribute to
  // `"false"` every tick and merely stamps `lastHadTargetMs`. The
  // loss envelope arms when the release path calls
  // `syncTargetLossFeedback(timeMs, false)` and `targetLossFeedbackAt(0)`
  // returns `active === true`. So the observable first-loss edge lives
  // AFTER `mouse.up()`, not before — polling for `"true"` between
  // `down()` and `up()` would deadlock against the hold-path writer
  // (Soren, PR #1726 review). No wall-clock waits: every `expect(...)`
  // below is a Playwright state poll, so `e2e-shared/no-wall-clock-waits`
  // stays green.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();

  // First-loss frame: release stamps `"true"` and the sync writes the
  // envelope's `elapsed=0` sample — reticle at neutral transform, prompt
  // at full opacity.
  await expect(aimReticle).toHaveAttribute("data-target-loss-active", "true");
  await expect(aimReticle).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(prompt).toHaveCSS("opacity", "1");

  // Past the 100ms envelope: the next tick's `syncTargetLossFeedback`
  // reads `feedback.active === false`, writes opacity 0, and nulls the
  // timer so a stale prompt cannot smear into the next beat.
  await expect(prompt).toHaveCSS("opacity", "0", { timeout: 400 });
});
