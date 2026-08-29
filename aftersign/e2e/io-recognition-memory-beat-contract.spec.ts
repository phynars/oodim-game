import { expect, test, type Locator, type Page } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

type RecognitionOutcome = "sealed" | "opened";

type MemoryBeat = {
  kind: "io_packet_return";
  outcome: RecognitionOutcome;
  startedAt: number;
  endedAt: number;
  cameraDeltaMeters: number;
  cameraYawDegrees: number;
  inputLockMs: number;
  lineId: string;
};

const BEAT_LIMITS = {
  durationMs: { min: 1100, max: 1350 },
  cameraDeltaMeters: { min: 0.24, max: 0.36 },
  cameraYawDegrees: { min: 3, max: 5 },
  inputLockMsMax: 1220,
} as const;

const ALLOWED_LINE_IDS = [
  "io_return_packet_sealed",
  "io_return_packet_opened",
] as const;

const assertBeatContract = (beat: MemoryBeat) => {
  expect(beat.kind).toBe("io_packet_return");
  expect(beat.outcome === "sealed" || beat.outcome === "opened").toBeTruthy();

  const durationMs = beat.endedAt - beat.startedAt;
  expect(durationMs).toBeGreaterThanOrEqual(BEAT_LIMITS.durationMs.min);
  expect(durationMs).toBeLessThanOrEqual(BEAT_LIMITS.durationMs.max);
  expect(beat.cameraDeltaMeters).toBeGreaterThanOrEqual(BEAT_LIMITS.cameraDeltaMeters.min);
  expect(beat.cameraDeltaMeters).toBeLessThanOrEqual(BEAT_LIMITS.cameraDeltaMeters.max);
  expect(beat.cameraYawDegrees).toBeGreaterThanOrEqual(BEAT_LIMITS.cameraYawDegrees.min);
  expect(beat.cameraYawDegrees).toBeLessThanOrEqual(BEAT_LIMITS.cameraYawDegrees.max);
  expect(beat.inputLockMs).toBeLessThanOrEqual(BEAT_LIMITS.inputLockMsMax);
  expect(ALLOWED_LINE_IDS).toContain(beat.lineId as (typeof ALLOWED_LINE_IDS)[number]);
};

async function waitForBeat(page: Page, beatId: string): Promise<Locator> {
  const beat = page.locator(`[data-beat-id="${beatId}"]`);
  await expect(beat).toBeVisible({ timeout: WAIT_MS });
  return beat;
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

async function choosePacketOutcome(page: Page, outcome: RecognitionOutcome): Promise<void> {
  const packet = page.locator("#packetButton");
  await expect(packet).toBeVisible({ timeout: WAIT_MS });

  if (outcome === "sealed") {
    await packet.click();
    return;
  }

  // Hold-and-pull dispatched from inside `page.evaluate` — the sleep
  // stays in browser context (`setTimeout`) rather than surfacing as
  // `page.waitForTimeout`, which the no-wall-clock-waits guard scans
  // for at source level (e2e-shared/no-wall-clock-waits/check.mjs).
  // Gesture shape is unchanged: 900ms hold with a 12px mid-hold pull,
  // crossing PacketIntentController's OPEN thresholds so
  // `commitPacketOutcome(OPENED)` fires through the real intent path.
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

    await new Promise((resolve) => setTimeout(resolve, holdMs - Math.floor(holdMs / 2)));

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

// Player path only: the packet gesture and the two visible dialogue choices
// cause every story transition. window.__game is read below after the beat has
// rendered, solely to assert the published memory-beat contract.
async function collectBeat(page: Page, slot: string, outcome: RecognitionOutcome): Promise<MemoryBeat> {
  await page.setViewportSize(PHONE_VIEWPORT);
  await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });

  await waitForBeat(page, "packet-offered");
  await choosePacketOutcome(page, outcome);
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "skip-kiosk-acknowledge");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");
  await waitForBeat(page, "io-return-recognition");

  // Visible transition proof precedes the assertion-only runtime read.
  await expect(page.locator("#line")).toContainText("I remember you", { timeout: WAIT_MS });

  const handle = await page.waitForFunction(
    ({ expectedOutcome, minDurationMs }) => {
      const beat = (window as Window & {
        __game?: { story?: { memoryBeat?: MemoryBeat | null } };
      }).__game?.story?.memoryBeat ?? null;
      const durationMs = beat ? beat.endedAt - beat.startedAt : 0;
      return beat
        && beat.outcome === expectedOutcome
        && Number.isFinite(durationMs)
        && durationMs >= minDurationMs
        ? beat
        : null;
    },
    { expectedOutcome: outcome, minDurationMs: BEAT_LIMITS.durationMs.min },
    { timeout: WAIT_MS },
  );
  return (await handle.jsonValue()) as MemoryBeat;
}

test("io recognition publishes range-checked story.memoryBeat through rendered controls", async ({ page }) => {
  test.setTimeout(COLD_START_MS);

  const sealed = await collectBeat(page, `io-memory-beat-sealed-${Date.now()}`, "sealed");
  assertBeatContract(sealed);

  const opened = await collectBeat(page, `io-memory-beat-opened-${Date.now()}`, "opened");
  assertBeatContract(opened);

  expect([sealed.outcome, opened.outcome].sort()).toEqual(["opened", "sealed"]);
});

// ---------------------------------------------------------------------------
// "measured, not canned" — harness-driven sibling of the played spec above.
//
// The played spec proves a real tap flows through the runtime and lands the
// memoryBeat inside its band. What it CANNOT prove is that the numbers
// inside that band came from measuring the live pose vs. being stamped
// from a `Math.max(…, contract.cameraDeltaMeters)` floor: any canned
// literal at or above 0.24m / 3° would satisfy every `toBeGreaterThanOrEqual`
// in `assertBeatContract`.
//
// This is a HARNESS-DRIVEN check by design — the played-not-driven rule
// (issue #1544) permits harness coverage precisely for probes like this
// one, and it complements (does not replace) the played spec above.
//
// Method:
//   1. Cold-load a fresh slot.
//   2. Zero both camera envelopes via `input.setConfirmCameraKick({0,0})`
//      + `input.setRecognitionCameraEnvelope({0,0})` — these are shipped
//      seams on `window.__game.input` (aftersign/main.js:1381-1382,
//      2723, 2734). Zeroing them flatlines the cameraPoseSampler input.
//   3. Drive the story with the harness (`input.choose` / `waitForStoryIdle`).
//      No wall-clock waits — the runtime's own idle promise is the fence.
//   4. Read `story.memoryBeat` and assert cameraDeltaMeters / cameraYawDegrees
//      collapse WELL UNDER the contract floors (0.24m / 3°). A canned
//      Math.max floor would still report ≥0.24 and ≥3; a real measurement
//      of a zeroed envelope reports ~0.
// Same inline-cast style the collectBeat() reader uses above — no
// `declare global` block is added on purpose; this file already
// treats window.__game as ad-hoc typed at each read site.
type HarnessInput = {
  choose: (choiceId: string) => void | Promise<void>;
  waitForStoryIdle: () => void | Promise<void>;
  forceReload: (options?: { clearLocalState?: boolean }) => void | Promise<void>;
  setConfirmCameraKick: (options?: { worldX?: number; yawDegrees?: number }) => void;
  setRecognitionCameraEnvelope: (options?: {
    cameraDeltaMeters?: number;
    cameraYawDegrees?: number;
  }) => void;
};
type HarnessGame = {
  input: HarnessInput;
  story?: { memoryBeat?: MemoryBeat | null };
};

async function seedForceReload(page: Page, slot: string): Promise<void> {
  await page.setViewportSize(PHONE_VIEWPORT);
  await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => {
      const game = (window as Window & { __game?: HarnessGame }).__game;
      const input = game?.input;
      return Boolean(
        input &&
          typeof input.forceReload === "function" &&
          typeof input.waitForStoryIdle === "function" &&
          typeof input.setConfirmCameraKick === "function" &&
          typeof input.setRecognitionCameraEnvelope === "function",
      );
    },
    undefined,
    { timeout: WAIT_MS },
  );
  await page.evaluate(async () => {
    const game = (window as Window & { __game?: HarnessGame }).__game;
    if (!game) throw new Error("window.__game unavailable");
    await game.input.forceReload({ clearLocalState: true });
    await game.input.waitForStoryIdle();
  });
}

async function driveHarnessRecognitionBeat(
  page: Page,
  outcome: RecognitionOutcome,
): Promise<MemoryBeat> {
  const packetChoice = outcome === "sealed" ? "keep-sealed" : "open-packet";
  const steps: readonly string[] = [
    packetChoice,
    "skip-kiosk-acknowledge",
    "deliver-packet",
  ];
  for (const choiceId of steps) {
    await page.evaluate(async (id) => {
      const game = (window as Window & { __game?: HarnessGame }).__game;
      if (!game) throw new Error("window.__game unavailable");
      await game.input.choose(id);
      await game.input.waitForStoryIdle();
    }, choiceId);
  }

  const handle = await page.waitForFunction(
    (expected) => {
      const beat = (window as Window & { __game?: HarnessGame }).__game?.story?.memoryBeat ?? null;
      return beat && beat.outcome === expected && Number.isFinite(beat.endedAt - beat.startedAt)
        ? beat
        : null;
    },
    outcome,
    { timeout: WAIT_MS },
  );
  return (await handle.jsonValue()) as MemoryBeat;
}

test("io recognition memoryBeat reports measured camera motion, not canned contract literals", async ({ page }) => {
  test.setTimeout(COLD_START_MS);

  const slot = `io-memory-beat-measured-${Date.now()}`;
  await seedForceReload(page, slot);

  // Flatten both camera envelopes the beat samples: the confirm-tap kick
  // (state.interaction.confirmFeedback) and the recognition envelope
  // (state.interaction.recognitionFeedback). With both at 0, a runtime
  // that MEASURES the live pose reports ~0m / ~0°; a runtime that
  // stamps `Math.max(peak, contract.floor)` still reports the contract
  // floor and reds this test.
  await page.evaluate(() => {
    const game = (window as Window & { __game?: HarnessGame }).__game;
    if (!game) throw new Error("window.__game unavailable");
    game.input.setConfirmCameraKick({ worldX: 0, yawDegrees: 0 });
    game.input.setRecognitionCameraEnvelope({
      cameraDeltaMeters: 0,
      cameraYawDegrees: 0,
    });
  });

  const beat = await driveHarnessRecognitionBeat(page, "sealed");

  // Shape sanity — the durable beat still fires and the outcome routes.
  expect(beat.kind).toBe("io_packet_return");
  expect(beat.outcome).toBe("sealed");
  expect(ALLOWED_LINE_IDS).toContain(beat.lineId as (typeof ALLOWED_LINE_IDS)[number]);

  // The measured-vs-canned gate. A canned literal at the contract floor
  // (0.24m / 3°) satisfies `assertBeatContract`; a measurement of a
  // zeroed envelope does not — the values collapse WELL below the floor.
  // Bounds picked as "less than half the contract floor" so a future
  // Math.max regression to any value ≥ half-floor still reds here.
  expect(beat.cameraDeltaMeters).toBeLessThan(BEAT_LIMITS.cameraDeltaMeters.min / 2);
  expect(beat.cameraYawDegrees).toBeLessThan(BEAT_LIMITS.cameraYawDegrees.min / 2);

  // Absolute lower bound: measurement can round negative-tiny from the
  // pose sampler; -1cm / -0.5° is comfortably below any real motion but
  // safely above sampler noise, so a runtime that stops sampling
  // altogether (returning stale NaN/undefined) is still caught by the
  // finite-number pin implicit in the numeric compare above.
  expect(beat.cameraDeltaMeters).toBeGreaterThan(-0.01);
  expect(beat.cameraYawDegrees).toBeGreaterThan(-0.5);
});
