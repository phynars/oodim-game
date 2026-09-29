import { expect, type Page } from "@playwright/test";

// Shared packet-gesture helper for AFTERSIGN played specs.
//
// Sealed vs. opened is chosen by the PACKET GESTURE on the visible
// `#packetButton`, NOT by a `data-choice-id` button — `open-packet` /
// `keep-packet-sealed` are dispatch-only ids inside `choose()` in
// aftersign/main.js and are NEVER stamped on a rendered control. The
// played surface is `#packetButton`:
//   - short tap → PacketIntentController never crosses OPEN thresholds
//     → `commitPacketOutcome(SEALED)` → `state.packet.sealed = true`.
//   - hold-and-pull → holdProgress + pullProgress cross the OPEN
//     window → `commitPacketOutcome(OPENED)` → `state.packet.sealed`
//     = false.
// Pull=12px sits inside (OPEN_PULL_MIN_PX=10, DRIFT_CANCEL_PX=14].
//
// Canonical source of this pattern:
//   aftersign/e2e/io-recognition-return-visual-feel.spec.ts — the
//   `performPacketGesture` originally lived there. This helper hoists
//   it so all played specs share ONE gesture implementation and stop
//   diverging on the same input.

export type PacketOutcome = "sealed" | "opened";

const DEFAULT_WAIT_MS = 60_000;

export async function performPacketGesture(
  page: Page,
  outcome: PacketOutcome,
  waitMs: number = DEFAULT_WAIT_MS,
): Promise<void> {
  const packet = page.locator("#packetButton");
  await expect(
    packet,
    "#packetButton should be visible at packet-offered",
  ).toBeVisible({ timeout: waitMs });

  if (outcome === "sealed") {
    await packet.click();
    return;
  }

  // OPENED — hold ~900ms with a 12px pull injected halfway through.
  // Same shape as `holdChoiceViaDom` in
  // aftersign/e2e/flagship-surface-contract.spec.ts:644.
  await page.evaluate(async () => {
    const node = document.querySelector<HTMLElement>("#packetButton");
    if (!node) throw new Error("#packetButton not found");
    const rect = node.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const pullPx = 12;
    const holdMs = 900;

    node.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 1,
        button: 0,
        buttons: 1,
        pointerType: "touch",
        isPrimary: true,
        clientX: startX,
        clientY: startY,
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, Math.floor(holdMs / 2)));

    node.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        button: 0,
        buttons: 1,
        pointerType: "touch",
        isPrimary: true,
        clientX: startX + pullPx,
        clientY: startY,
      }),
    );

    await new Promise((resolve) =>
      setTimeout(resolve, holdMs - Math.floor(holdMs / 2)),
    );

    node.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
        button: 0,
        buttons: 0,
        pointerType: "touch",
        isPrimary: true,
        clientX: startX + pullPx,
        clientY: startY,
      }),
    );
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
