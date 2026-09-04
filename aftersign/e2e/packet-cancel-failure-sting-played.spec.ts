import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN — real-tap proof for the CANCELLED branch of the packet
// intent gesture. A hold + >14px lateral pull past `DRIFT_CANCEL_PX`
// routes through `PacketIntentController.move()` and lands
// `PACKET_OUTCOME.CANCELLED`, which fires
// `maybeTriggerFailureFromOutcome(snapshot.outcome, "packet-cancelled")`
// in `aftersign/main.js` and stamps the served failure-sting envelope
// (kind + non-decaying feel numbers) onto `state.interaction.failureFeedback`.
//
// Prior review pass (Soren, 2026-09-04): `page.mouse.down/move/up` did
// NOT reach the packet intent controller on the CI runner — the poll
// timed out with `lastAction: null`, meaning the gesture never
// produced a CANCELLED outcome. The sibling
// `job-offer-debt-held-played.spec.ts` (openPacketByGesture) proves the
// CI-green path: dispatch real PointerEvents inside a single
// `page.evaluate` so they land on `#packetButton` synchronously and
// are captured by the button's own pointer-capture listener before
// the second event fires. Same shape used here — press at the button
// center, mid-hold move to `center + 34px` (>DRIFT_CANCEL_PX=14),
// release. Both events go through the PacketIntentController via the
// runtime input adapters (`aftersign/src/runtime/inputAdapters.js`
// registers pointerdown/pointermove/pointerup on `#packetButton`), so
// `commitPacketOutcome(PACKET_OUTCOME.CANCELLED)` fires via the real
// intent-recognition path — no `input.choose()` reach-in, no synthetic
// state mutation.

const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

type FailureSnapshot = {
  lastAction: string | null;
  failureFeedback: Record<string, unknown> | null;
  shakeX: number;
  shakeY: number;
  stingOpacity: number;
};

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

// Perform the CANCELLED packet gesture on the visible `#packetButton`.
// Mirrors `openPacketByGesture` in
// `aftersign/e2e/job-offer-debt-held-played.spec.ts` — the CI-green
// pattern for driving `PacketIntentController` via real PointerEvents.
// A 34px lateral move exceeds `DRIFT_CANCEL_PX=14` (see
// `aftersign/src/packetIntent.ts`), landing `PACKET_OUTCOME.CANCELLED`
// on the SAME frame as `pointermove` — the release event just closes
// the gesture; the outcome is already committed.
async function cancelPacketByGesture(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const node = document.querySelector<HTMLElement>("#packetButton");
    if (!node) throw new Error("#packetButton not found");
    const rect = node.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const pullPx = 34;

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

    // Brief hold — enough for the press to register in the controller
    // before the drift-cancel move lands. Small budget on purpose:
    // this spec exercises DRIFT_CANCEL_PX, not HOLD_TO_OPEN_MS.
    await new Promise((resolve) => setTimeout(resolve, 40));

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

    await new Promise((resolve) => setTimeout(resolve, 20));

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
  });
}

// Atomic poll: capture `lastAction` and the failure-sting envelope inside a
// SINGLE page.evaluate so the 180ms rAF decay can't race between the "cancel
// confirmed" check and the state read. Playwright's own expect.poll would
// require two round-trips (one to confirm, one to snapshot) — that gap is the
// race the reviewer flagged earlier on this PR.
async function pollForCancelSnapshot(
  page: Page,
  { timeoutMs = 5000, intervalMs = 25 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<FailureSnapshot> {
  const deadline = Date.now() + timeoutMs;
  let last: FailureSnapshot | null = null;
  while (Date.now() < deadline) {
    const snapshot = await page.evaluate(() => {
      const game = (window as unknown as {
        __game?: {
          interaction?: {
            lastAction?: string | null;
            failureFeedback?: Record<string, unknown> | null;
          };
        };
      }).__game;
      const lastAction = game?.interaction?.lastAction ?? null;
      const failureFeedback = game?.interaction?.failureFeedback ?? null;
      const rootStyle = getComputedStyle(document.documentElement);
      const sting = document.querySelector<HTMLElement>(".failure-sting");
      const stingStyle = sting ? getComputedStyle(sting) : null;
      return {
        lastAction,
        failureFeedback,
        shakeX:
          Number.parseFloat(rootStyle.getPropertyValue("--confirm-shake-x")) || 0,
        shakeY:
          Number.parseFloat(rootStyle.getPropertyValue("--confirm-shake-y")) || 0,
        stingOpacity: stingStyle ? Number.parseFloat(stingStyle.opacity) || 0 : 0,
      } as FailureSnapshot;
    });
    last = snapshot;
    if (snapshot.lastAction === "packet-cancelled") return snapshot;
    // pacing
    await page.waitForTimeout(intervalMs);
  }
  throw new Error(
    `Timed out waiting for packet-cancelled; last snapshot: ${JSON.stringify(last)}`,
  );
}

test("packet cancel plays the served failure sting from a real pointer gesture", async ({ page }) => {
  test.setTimeout(COLD_START_MS);

  const slot = `packet-cancel-failure-sting-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);

  const packetButton = page.locator("#packetButton");
  await expect(
    packetButton,
    "#packetButton should be visible at packet-offered",
  ).toBeVisible({ timeout: WAIT_MS });

  await cancelPacketByGesture(page);

  const failureSnapshot = await pollForCancelSnapshot(page);

  // Pin the non-decaying feel constants — these are spread from
  // FAILURE_FEEDBACK at trigger time and never mutate during the envelope.
  // We deliberately do NOT assert `active: true` because the 180ms rAF fold
  // can flip it to false on a slow runner before the assertion executes,
  // even though the snapshot was captured atomically with the cancel confirm.
  expect(failureSnapshot.failureFeedback).toMatchObject({
    kind: "packet-cancelled",
    durationMs: 180,
    hudShakePx: 8,
    hudDropPx: 2,
    flashAlpha: 0.34,
    easing: "easeOutQuad",
  });

  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (window as unknown as {
              __game?: { interaction?: { failureFeedback?: { active?: boolean } } };
            }).__game?.interaction?.failureFeedback?.active ?? false,
        ),
      { timeout: 1200 },
    )
    .toBe(false);
});
