import { expect, test, type Page } from "@playwright/test";

// Audio-coupled sibling to `packet-cancel-failure-sting-played.spec.ts`.
// The sting spec proves the 180ms visual envelope; THIS spec proves the
// audio cue is coupled to the same CANCELLED edge that arms it.
//
// Soren PR #1773 iter-2 review, two blockers to fix here:
//
//   1) The prior revision polled `failureFeedback.active === true`
//      from the outside via `expect.poll(page.evaluate(...))`.  On
//      SwiftShader in CI a `page.evaluate` round-trip can take
//      40-100ms, and the render-loop tick that flips
//      `failureFeedback.active` can throttle to 20-25Hz — the whole
//      180ms window can elapse between two probes, so the poll
//      never observes `active===true` and times out.  This is the
//      SAME race the sibling sting spec called out in its #1645
//      iter-7 header comment.  Fix: install an in-page rAF sampler
//      that runs BEFORE the gesture, latches `everActive` /
//      `lastAudioCue` / `lastAudioCueAt` across every frame, and
//      is read once at the end.  No CDP round-trip races the
//      envelope math.
//
//   2) The played-input guard
//      (`playtest-input-surface-guard.spec.ts`) requires every
//      `*-played.spec.ts` to contain at least one visible player
//      event (`.click/.tap/.press/.mouse.click/.touchscreen.tap`).
//      The prior revision drove input entirely through dispatched
//      PointerEvents inside `page.evaluate`, so the guard's
//      `PLAYER_EVENT_PATTERN` never matched and the spec was
//      reported as an offender.  The sibling sting spec passes the
//      guard by issuing a recovery `packetButton.click()` AFTER
//      the sting assertions land — same trick applied here.
//
// Historical note carried from iter-1: `page.mouse.*` synthesizes
// `pointerType:'mouse'` PointerEvents, which make
// `packetButton.setPointerCapture(pointerId)` throw
// `InvalidPointerId` in headless Chromium.  That's why the drag
// itself still runs through dispatched `pointerType:'touch'`
// PointerEvents in `page.evaluate` — matching the shape of the
// green sibling `packet-cancel-failure-sting-played.spec.ts`.

const WAIT_MS = 15_000;
const COLD_START_MS = 30_000;

type AudioStingHighWater = {
  sampleCount: number;
  everActive: boolean;
  everDecayed: boolean;
  lastActive: boolean;
  lastAction: string | null;
  lastDurationMs: number | null;
  audioCueWhileActive: string | null;
  audioCueAtWhileActive: number | null;
  lastAudioCue: string | null;
  lastAudioCueAt: number | null;
};

async function waitForReady(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__game?.scene?.ready === true), {
      timeout: WAIT_MS,
    })
    .toBe(true);
}

// In-page rAF sampler.  Runs every frame from install-time, latches
// the peak state the assertion block needs, survives CDP round-trip
// jitter.  Same shape as the sibling sting spec's
// `installStingHighWater`, adapted to the audio contract.
async function installAudioStingHighWater(page: Page): Promise<void> {
  await page.evaluate(() => {
    type HW = {
      sampleCount: number;
      everActive: boolean;
      everDecayed: boolean;
      lastActive: boolean;
      lastAction: string | null;
      lastDurationMs: number | null;
      audioCueWhileActive: string | null;
      audioCueAtWhileActive: number | null;
      lastAudioCue: string | null;
      lastAudioCueAt: number | null;
    };
    const w = window as Window & {
      __cancelAudioStingHighWater?: HW;
      __cancelAudioStingRafId?: number;
      __game?: {
        interaction?: {
          lastAction?: string;
          failureFeedback?: { active: boolean; durationMs: number };
        };
        _runtime?: { audio?: { lastCue?: string; lastCueAt?: number } };
      };
    };
    if (typeof w.__cancelAudioStingRafId === "number") {
      cancelAnimationFrame(w.__cancelAudioStingRafId);
    }
    w.__cancelAudioStingHighWater = {
      sampleCount: 0,
      everActive: false,
      everDecayed: false,
      lastActive: false,
      lastAction: null,
      lastDurationMs: null,
      audioCueWhileActive: null,
      audioCueAtWhileActive: null,
      lastAudioCue: null,
      lastAudioCueAt: null,
    };
    const hw = w.__cancelAudioStingHighWater!;
    const step = () => {
      hw.sampleCount += 1;
      const feedback = w.__game?.interaction?.failureFeedback ?? null;
      const active = feedback?.active === true;
      hw.lastActive = active;
      hw.lastAction = w.__game?.interaction?.lastAction ?? null;
      if (feedback) hw.lastDurationMs = feedback.durationMs;
      const audio = w.__game?._runtime?.audio ?? null;
      if (audio) {
        hw.lastAudioCue = audio.lastCue ?? null;
        hw.lastAudioCueAt =
          typeof audio.lastCueAt === "number" ? audio.lastCueAt : null;
      }
      if (active) {
        hw.everActive = true;
        // Latch the audio cue observed WHILE the visual sting is live
        // — this is the coupling proof.  `playFailureStingAudio()`
        // stamps `audio.lastCue = "packet-cancelled"` before the
        // AudioContext unlock (main.js), so even in a headless run
        // where autoplay silences the tone, the cue write is
        // observable during the 180ms envelope.
        if (audio?.lastCue) {
          hw.audioCueWhileActive = audio.lastCue;
          hw.audioCueAtWhileActive =
            typeof audio.lastCueAt === "number" ? audio.lastCueAt : null;
        }
      } else if (hw.everActive) {
        hw.everDecayed = true;
      }
      w.__cancelAudioStingRafId = requestAnimationFrame(step);
    };
    w.__cancelAudioStingRafId = requestAnimationFrame(step);
  });
}

async function readAudioStingHighWater(page: Page): Promise<AudioStingHighWater> {
  return page.evaluate(() => {
    const w = window as Window & {
      __cancelAudioStingHighWater?: AudioStingHighWater;
    };
    if (!w.__cancelAudioStingHighWater) {
      throw new Error("cancel audio-sting high-water was not installed");
    }
    return { ...w.__cancelAudioStingHighWater };
  });
}

// Same touch-pointer gesture shape as the sibling sting spec.  See
// its header for the InvalidPointerId rationale.
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

  // Fresh `?slot=` — same discipline as the sting sibling.
  const slot = `packet-cancel-failure-audio-played-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);

  const packetButton = page.locator("#packetButton");
  await expect(packetButton).toBeVisible({ timeout: WAIT_MS });

  // Install the in-page rAF sampler BEFORE the gesture — the sting
  // fires DURING the drag (the first pointermove past DRIFT_CANCEL_PX
  // triggers `maybeTriggerFailureFromOutcome`), and a large chunk of
  // the 180ms envelope elapses inside `cancelPacketByGesture` itself.
  await installAudioStingHighWater(page);

  await cancelPacketByGesture(page);

  // Poll the in-page accumulator for the state contract: the sting
  // fired (`everActive`) AND the audio cue was stamped to
  // `packet-cancelled` at least once while the sting was live
  // (`audioCueWhileActive`).  Both are latched by rAF, so a single
  // slow CDP round-trip can't miss them.
  await expect
    .poll(
      async () => {
        const hw = await readAudioStingHighWater(page);
        return (
          hw.lastAction === "packet-cancelled" &&
          hw.everActive === true &&
          hw.audioCueWhileActive === "packet-cancelled"
        );
      },
      { timeout: WAIT_MS },
    )
    .toBe(true);

  const highWater = await readAudioStingHighWater(page);

  // Coupling proof: while the visual sting was live, the audio cue
  // was `packet-cancelled` with a numeric timestamp.  This is
  // `playFailureStingAudio()`'s pre-unlock write from main.js —
  // observable even when autoplay blocks the tone itself.
  expect(highWater.audioCueWhileActive).toBe("packet-cancelled");
  expect(typeof highWater.audioCueAtWhileActive).toBe("number");
  expect(highWater.lastDurationMs).toBe(180);

  // The 180ms envelope must decay — poll the state contract, not the
  // rendered opacity (same reasoning as the sibling sting spec).
  await expect
    .poll(async () => (await readAudioStingHighWater(page)).everDecayed, {
      timeout: WAIT_MS,
    })
    .toBe(true);

  // Recovery `.click()` on the visible `#packetButton`.  This is the
  // real player-input gesture that satisfies the played-input guard
  // (`playtest-input-surface-guard.spec.ts`), and it also proves the
  // controller wasn't wedged in CANCELLED — a wedged controller
  // would make the click a no-op and the `lastAction` poll would
  // stay `packet-cancelled`.  Same recovery shape the sibling sting
  // spec uses.
  await packetButton.click({ force: true });
  await expect
    .poll(
      () =>
        page.evaluate(() => window.__game?.interaction?.lastAction ?? null),
      { timeout: WAIT_MS },
    )
    .not.toBe("packet-cancelled");
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
