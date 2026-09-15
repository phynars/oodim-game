import { expect, test, type Page } from "@playwright/test";

// Audio-coupled sibling to `packet-cancel-failure-sting-played.spec.ts`.
// The sting spec proves the 180ms visual envelope; THIS spec proves the
// audio cue is coupled to the same CANCELLED edge that arms it.
//
// Historical blocker (Soren, PR #1773 iter-1): using `page.mouse.*`
// synthesizes `pointerType:'mouse'` PointerEvents.  In headless
// Chromium `packetButton.setPointerCapture(pointerId)` throws
// InvalidPointerId on the mouse path, so `packetPress()` never runs,
// `state.interaction.packetIntent.active` stays false, every
// `pointermove` is gated off by the input adapter, and no CANCELLED
// outcome ever fires — `failureFeedback.active` stays false, the poll
// times out, and the audio assertion is unobservable.
//
// Fix: mirror the working gesture in `packet-cancel-failure-sting-
// played.spec.ts` exactly — `pointerType:'touch'` PointerEvents
// dispatched via `page.evaluate` with awaited `setTimeout` gaps
// between pointerdown/move/up, on a fresh `?slot=` URL.

const WAIT_MS = 15_000;
const COLD_START_MS = 30_000;

async function waitForReady(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__game?.scene?.ready === true), {
      timeout: WAIT_MS,
    })
    .toBe(true);
}

// Same shape as the sting spec's `cancelPacketByGesture`.  See the
// header there for the full rationale on touch pointer + evaluate
// dispatch + setTimeout gaps.
async function cancelPacketByGesture(page: Page): Promise<void> {
  const packet = page.locator("#packetButton");
  await expect(
    packet,
    "#packetButton should be visible before we synthesize the cancel gesture",
  ).toBeVisible({ timeout: WAIT_MS });

  await page.evaluate(async () => {
    const node = document.querySelector<HTMLElement>("#packetButton");
    if (!node) throw new Error("#packetButton not found for cancel gesture");
    const rect = node.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    // 34px sweep sits well past DRIFT_CANCEL_PX=14 (strict `>`).
    const cancelPullPx = 34;

    node.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: startX,
        clientY: startY,
      }),
    );

    // Let the browser flush capture + `packetPress()` before we drag.
    await new Promise((resolve) => setTimeout(resolve, 32));

    for (let i = 1; i <= 5; i++) {
      const x = startX + (cancelPullPx * i) / 5;
      node.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: x,
          clientY: startY,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 8));
    }

    node.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
        clientX: startX + cancelPullPx,
        clientY: startY,
      }),
    );
  });
}

test("a real drag-cancel couples the 180ms visual sting to a failure audio cue", async ({
  page,
}) => {
  test.setTimeout(COLD_START_MS);
  await page.setViewportSize({ width: 390, height: 844 });

  // Fresh `?slot=` so we don't inherit a wedged controller from a
  // prior test run — same discipline as the sting sibling.
  const slot = `packet-cancel-failure-audio-played-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);

  await cancelPacketByGesture(page);

  // Gate on the CANCELLED edge landing.  Without this poll, the audio
  // assertion below would race the sting-arming render tick.
  await expect
    .poll(() => page.evaluate(() => window.__game?.interaction?.lastAction), {
      timeout: WAIT_MS,
    })
    .toBe("packet-cancelled");
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.__game?.interaction?.failureFeedback?.active === true,
        ),
      { timeout: WAIT_MS },
    )
    .toBe(true);

  // The coupled read: while the sting is live, audio.lastCue must
  // already be stamped — `playFailureStingAudio()` writes it BEFORE
  // the AudioContext unlock so a headless test can observe the
  // dispatch even when autoplay blocks real sound.
  const coupled = await page.evaluate(() => ({
    durationMs: window.__game?.interaction?.failureFeedback?.durationMs,
    flashOpacity: Number(
      (document.querySelector(".failure-sting") as HTMLElement | null)?.style
        .opacity ?? 0,
    ),
    audioCue: window.__game?._runtime?.audio?.lastCue,
    audioCueAt: window.__game?._runtime?.audio?.lastCueAt,
  }));

  expect(coupled.durationMs).toBe(180);
  expect(coupled.audioCue).toBe("packet-cancelled");
  expect(typeof coupled.audioCueAt).toBe("number");

  // Envelope decays back to inactive within the 180ms window.
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.__game?.interaction?.failureFeedback?.active === true,
        ),
      { timeout: WAIT_MS },
    )
    .toBe(false);
});

declare global {
  interface Window {
    __game?: {
      scene?: {
        ready?: boolean;
      };
      interaction?: {
        lastAction?: string;
        failureFeedback?: {
          active: boolean;
          durationMs: number;
        };
      };
      _runtime?: {
        audio?: {
          lastCue?: string;
          lastCueAt?: number;
        };
      };
    };
  }
}
