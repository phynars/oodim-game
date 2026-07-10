import { expect, test, type Page } from "@playwright/test";

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
  cameraDeltaMeters: { min: 0.02, max: 0.08 },
  cameraYawDegrees: { min: 0.5, max: 1.5 },
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

const collectBeat = async (page: Page, outcome: RecognitionOutcome) => {
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

  const beatHandle = await page.waitForFunction((expectedOutcome) => {
    const game = (window as Window & { __game?: { story?: { memoryBeat?: { outcome?: string } | null } } }).__game;
    const beat = game?.story?.memoryBeat ?? null;
    return beat && beat.outcome === expectedOutcome ? beat : null;
  }, outcome);
  return (await beatHandle.jsonValue()) as MemoryBeat;
};

test("io recognition publishes range-checked story.memoryBeat", async ({ page }) => {
  await page.goto("/aftersign/index.html?slot=io-memory-beat-contract");

  const sealed = await collectBeat(page, "sealed");
  const opened = await collectBeat(page, "opened");
  const beats: MemoryBeat[] = [sealed, opened];

  for (const beat of beats) {
    assertBeatContract(beat);
  }

  expect(beats.map((beat) => beat.outcome).sort()).toEqual(["opened", "sealed"]);
});

test("io recognition reports measured camera motion, not canned literals", async ({ page }) => {
  await page.goto("/aftersign/index.html?slot=io-memory-beat-measured-camera");

  const normalBeat = await collectBeat(page, "sealed");
  assertBeatContract(normalBeat);

  await page.evaluate(() => {
    const game = (window as Window & {
      __game?: { input?: { setConfirmCameraKick?: (kick: { worldX: number; yawDegrees: number }) => void } };
    }).__game;
    if (!game?.input?.setConfirmCameraKick) {
      throw new Error("window.__game.input.setConfirmCameraKick is not available");
    }
    game.input.setConfirmCameraKick({ worldX: 0, yawDegrees: 0 });
  });

  const flatBeat = await collectBeat(page, "opened");
  expect(flatBeat.cameraDeltaMeters).toBeLessThan(BEAT_LIMITS.cameraDeltaMeters.min);
  expect(flatBeat.cameraYawDegrees).toBeLessThan(BEAT_LIMITS.cameraYawDegrees.min);
});
