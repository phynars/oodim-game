import { expect, test, type Page } from "@playwright/test";

// Cold-start budget matches other AFTERSIGN e2e specs: SwiftShader init +
// three.js first WebGL context can exceed Playwright's default 30s timeout
// in CI. Every sibling spec in aftersign/e2e/ opts into 90s — the missing
// override here is why this spec kept flaking green→red on cold CI runs
// even when the assertions were correct.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

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

// Camera bounds come from the owning feel spec
// (docs/flagship/io-recognition-beat.md — "cameraDeltaMeters is between
// 0.24m and 0.36m" / "cameraYawDegrees is between 3deg and 5deg" when
// reduced motion is off). The old 0.02-0.08m / 0.5-1.5deg band predated
// the 1,220ms recognition envelope and only covered the 220ms confirm
// kick, not the authored 0.32m dolly / 4deg yaw the beat now performs.
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

// Wait for the module script to boot the game surface. Without this, the
// first page.evaluate can race the deferred module import and throw
// "window.__game.input is not available" on cold CI runs before three.js
// has finished initializing.
const waitForGame = async (page: Page) => {
  await page.waitForFunction(
    () => Boolean(
      (window as Window & {
        __game?: { input?: { choose?: unknown; advance?: unknown; forceReload?: unknown } };
      }).__game?.input?.choose
        && (window as Window & {
          __game?: { input?: { advance?: unknown } };
        }).__game?.input?.advance
        && (window as Window & {
          __game?: { input?: { forceReload?: unknown } };
        }).__game?.input?.forceReload,
    ),
    undefined,
    { timeout: WAIT_MS },
  );
};

const collectBeat = async (page: Page, outcome: RecognitionOutcome) => {
  await waitForGame(page);
  await page.evaluate(async (nextOutcome) => {
    const game = (window as Window & {
      __game?: {
        input?: {
          choose?: (choiceId: string) => Promise<void>;
          advance?: () => Promise<void>;
          forceReload?: () => Promise<void>;
        };
        story?: { memoryBeat?: unknown };
      };
    }).__game;
    if (!game?.input?.choose || !game.input.advance || !game.input.forceReload) {
      throw new Error("window.__game.input is not available");
    }

    await game.input.forceReload();
    if (game.story) {
      game.story.memoryBeat = null;
    }
    await game.input.choose(nextOutcome === "sealed" ? "keep-packet-sealed" : "open-packet");
    await game.input.choose("deliver-packet");
    await game.input.advance();
  }, outcome);

  // The beat is published from a setTimeout ~1180ms after deliver-packet, so
  // waitForFunction needs enough runway to see the async transition, plus
  // slack for SwiftShader tick jitter on CI.
  const beatHandle = await page.waitForFunction(
    (expectedOutcome) => {
      const game = (window as Window & { __game?: { story?: { memoryBeat?: { outcome?: string } | null } } }).__game;
      const beat = game?.story?.memoryBeat ?? null;
      return beat && beat.outcome === expectedOutcome ? beat : null;
    },
    outcome,
    { timeout: WAIT_MS },
  );
  return (await beatHandle.jsonValue()) as MemoryBeat;
};

test("io recognition publishes range-checked story.memoryBeat", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/aftersign/index.html?slot=io-memory-beat-contract", { waitUntil: "load" });

  const sealed = await collectBeat(page, "sealed");
  const opened = await collectBeat(page, "opened");
  const beats: MemoryBeat[] = [sealed, opened];

  for (const beat of beats) {
    assertBeatContract(beat);
  }

  expect(beats.map((beat) => beat.outcome).sort()).toEqual(["opened", "sealed"]);
});

test("io recognition reports measured camera motion, not canned literals", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/aftersign/index.html?slot=io-memory-beat-measured-camera", { waitUntil: "load" });

  const normalBeat = await collectBeat(page, "sealed");
  assertBeatContract(normalBeat);

  // Zero BOTH camera-motion sources — the 220ms confirm kick AND the
  // 1,220ms recognition envelope. The probe measures the live camera pose,
  // so with both amplitudes flat the reported motion must collapse below
  // the contract minimums. If the runtime ever reverts to stamping canned
  // literals (e.g. a Math.max floor to the contract constants), this
  // assertion is the one that catches it.
  await page.evaluate(() => {
    const game = (window as Window & {
      __game?: {
        input?: {
          setConfirmCameraKick?: (kick: { worldX: number; yawDegrees: number }) => void;
          setRecognitionCameraEnvelope?: (envelope: { cameraDeltaMeters: number; cameraYawDegrees: number }) => void;
        };
      };
    }).__game;
    if (!game?.input?.setConfirmCameraKick || !game.input.setRecognitionCameraEnvelope) {
      throw new Error("window.__game.input camera overrides are not available");
    }
    game.input.setConfirmCameraKick({ worldX: 0, yawDegrees: 0 });
    game.input.setRecognitionCameraEnvelope({ cameraDeltaMeters: 0, cameraYawDegrees: 0 });
  });

  const flatBeat = await collectBeat(page, "opened");
  expect(flatBeat.cameraDeltaMeters).toBeLessThan(BEAT_LIMITS.cameraDeltaMeters.min);
  expect(flatBeat.cameraYawDegrees).toBeLessThan(BEAT_LIMITS.cameraYawDegrees.min);
});
