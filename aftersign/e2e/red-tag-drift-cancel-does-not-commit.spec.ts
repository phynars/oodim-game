import { expect, test } from "@playwright/test";

// #2357 iter-3 (Soren blocking, AI007):
//
// WHAT THIS SPEC GUARDS. The fix added in `inputAdapters.js` is a
// `click` listener gated on `event.detail === 0` so it only fires for
// NON-POINTER activations (keyboard Enter/Space on the focused button,
// or a scripted `HTMLElement.click()`). A real mouse/touch click
// always carries `detail >= 1`, so the listener must be a strict
// no-op for pointer play — including the drift-cancel failure path,
// where a drag past `DRIFT_CANCEL_PX` is CANCELLED inside
// `packetMove` without committing (CANCELLED is deliberately NOT an
// `isCommittedOutcome` — `main.js:3380`) and the browser then still
// synthesises `click` on release.
//
// WHY A SPEC AT ALL. If the `detail === 0` guard regressed to the
// earlier `active + beat` guard, the synthesised `click` after a
// drift-cancelled drag would walk through, commit SEALED on top of
// the player's failed drag, and override the cancel path. This spec
// drives that exact gesture and asserts the beat stayed at
// `packet-offered` and the readout still says `packet opened`
// (= not sealed).
//
// IMPORTANT — base-branch behaviour. On main there is NO click
// listener at all, so the synthesised click is already a no-op and
// this spec passes. This is a FORWARD regression guard for the fix,
// not a base-branch failure proof. The base-branch failure proof for
// issue #2356 lives in `red-tag-packet-delivery-advances.spec.ts`
// (keyboard Enter path, which main cannot handle).
//
// ASSERTION FORMAT. The readout string in `main.js:3150` is plain
// text — `story: <beat> · packet <sealed|opened|delivered X> · …` —
// not JSON. The negative check asserts on `packet sealed`, which is
// the literal substring that would appear if the drift-cancel
// regressed to SEALED. A `"sealed":true` JSON probe (prior draft)
// could never fail because that substring never appears in the
// readout at all.
test("drift-cancelled pointer drag does not commit SEALED via synthesised click", async ({ page }) => {
  await page.goto(`/aftersign/?slot=red-tag-drift-cancel-${Date.now()}`, {
    waitUntil: "load",
  });

  // Wait for the game to boot and reach the first job-offer surface.
  // Without this the `getByRole` click can race the harness and the
  // whole spec stalls to the 30s global timeout (the symptom Soren
  // flagged — "Test timeout of 30000ms exceeded").
  await expect(page.getByRole("button", { name: "Safe delivery · low risk" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Safe delivery · low risk" }).click();

  // Wait for `#packetButton` to render in the packet-offered beat —
  // this is the surface the drift-cancel gesture targets.
  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#stateReadout")).toContainText("packet-offered", {
    timeout: 15000,
  });

  const box = await packetButton.boundingBox();
  if (!box) throw new Error("packetButton has no bounding box");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // Drive a pointer drag that drifts far past `DRIFT_CANCEL_PX`, then
  // release back on the original target so the browser synthesises
  // `click` (releasing outside normally suppresses the synthesised
  // click; returning first is the exact AI007 vector).
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 400, startY, { steps: 10 });
  await page.mouse.move(startX, startY, { steps: 10 });
  await page.mouse.up();

  // Readout format (main.js:3150) is plain text:
  //   `story: <beat> · packet <sealed|opened|delivered X> · route … · memory: … · player …`
  // So the beat stays at `packet-offered` and the packet-status
  // substring must remain `packet opened` (initial state), never
  // `packet sealed`. Both assertions are falsifiable: if the fix
  // regressed to the stale `active+beat` guard, the synthesised
  // click would commit SEALED → beat advances to `packet-choice`
  // and the readout would read `packet sealed`.
  await expect(page.locator("#stateReadout")).toContainText("packet-offered");
  await expect(page.locator("#stateReadout")).not.toContainText("packet sealed");
});
