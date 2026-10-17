import { expect, test } from "@playwright/test";

// #2357 iter-3 (Soren blocking): the earlier draft's `click` listener
// only guarded on `packetIntent.active` + beat. A pointer drag that
// drifts past `DRIFT_CANCEL_PX` is CANCELLED inside `packetMove`
// WITHOUT committing (CANCELLED is deliberately not an
// `isCommittedOutcome` — main.js:3380). On release the beat is still
// `packet-offered` and `packetIntent.active` is false, so the browser's
// synthesised `click` event would walk right through the old guard and
// commit SEALED, overriding the failure path. The fix narrows the
// listener to `event.detail === 0` (keyboard / scripted activations
// only); a real pointer click has `detail >= 1`, so this spec drags
// past the cancel threshold, releases, and asserts the beat stayed
// at `packet-offered` and the packet never sealed.
//
// Base-branch behaviour (this spec FAILS on main): after the drift
// release the stale guard commits SEALED → beat advances to
// `packet-choice`, `state.packet.sealed === true`. With the fix
// (`detail !== 0 → return`) the pointer-synthesised click is ignored
// and the cancel path is preserved.
test("drift-cancelled pointer drag does not commit SEALED via synthesised click", async ({ page }) => {
  await page.goto("/aftersign/?slot=red-tag-drift-cancel");

  await page.getByRole("button", { name: "Safe delivery · low risk" }).click();

  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toBeVisible();

  const box = await packetButton.boundingBox();
  if (!box) throw new Error("packetButton has no bounding box");

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // Drive a pointer drag that drifts far past DRIFT_CANCEL_PX, then
  // release OUTSIDE the button. The `click` is synthesised by the
  // browser when press+release land on the same target — releasing
  // outside normally suppresses `click`, so we release back on top
  // to force the synthesised event (the exact AI007 vector Soren
  // flagged: a cancelled drag whose release still triggers `click`).
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Drift horizontally beyond DRIFT_CANCEL_PX (default 24px in the
  // controller; 400px is comfortably past any plausible threshold).
  await page.mouse.move(startX + 400, startY, { steps: 10 });
  // Return to the button so the browser synthesises `click` on the
  // original target — this is the regression surface.
  await page.mouse.move(startX, startY, { steps: 10 });
  await page.mouse.up();

  // The cancelled drag must NOT advance the beat and must NOT seal
  // the packet. On the base branch the stale `click` listener commits
  // SEALED and both assertions fail.
  await expect(page.locator("#stateReadout")).toContainText("packet-offered");
  await expect(page.locator("#stateReadout")).not.toContainText('"sealed":true');
});
