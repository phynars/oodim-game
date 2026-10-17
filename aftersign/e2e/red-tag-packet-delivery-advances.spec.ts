import { expect, test } from "@playwright/test";

// #2356 iter-2 (Soren AI003): the red-tag round-2 bug is a NON-POINTER
// activation gap. The shipped pointerdown/pointerup funnel already
// commits SEALED for mouse + touch play; the dead affordance only
// manifests when activation arrives without a pointer stream —
// `HTMLElement.click()` and keyboard Enter/Space on the focused
// `<button>`. Playwright's `locator.click()` dispatches a full pointer
// sequence (pointerdown → pointerup → click), so the first draft of
// this spec would have passed on the base branch too — it never
// exercised the newly added `click` listener.
//
// We drive the real non-pointer path: focus `#packetButton`, press
// Enter, then assert the delivery beat advances. On the base branch
// no click listener exists and the beat stays at `packet-offered`,
// so this spec FAILS (the base-branch assertion for a bug-issue PR).
// After the fix the keyboard activation routes through
// `commitPacketOutcome(SEALED)` — same funnel as the pointer path —
// and the Deliver → Saint Orra line lands.
test("round-two red-tag commits via keyboard activation (no pointer stream)", async ({ page }) => {
  await page.goto("/aftersign/?slot=red-tag-delivery-advances");

  // Fixture: deliver the first (blue) packet via the shipped pointer
  // path so the player returns to Io for the red-tag handoff. These
  // steps don't need to be keyboard-driven — the regression is on the
  // round-two red-tag seal, not the first-packet funnel.
  await page.getByRole("button", { name: "Safe delivery · low risk" }).click();
  await page.locator("#packetButton").click();
  await page.getByRole("button", { name: "Deliver" }).click();
  await page.getByRole("button", { name: "Ask for next job" }).click();
  await page.getByRole("button", { name: "Deliver next packet" }).click();

  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toHaveText("Red tag — Saint Orra");

  // Keyboard-only activation: NO pointer events. This is the exact
  // seam the fix targets (the new `click` listener in inputAdapters.js
  // runs for Enter/Space on a focused button, bypassing the
  // pointerdown/up funnel the base branch relies on).
  await packetButton.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("#stateReadout")).toContainText("packet-choice");
  await page.getByRole("button", { name: "Deliver" }).click();
  await expect(page.locator("#line")).toContainText("Saint Orra");
});
