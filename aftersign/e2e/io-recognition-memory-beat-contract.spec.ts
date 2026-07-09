import { expect, test } from "@playwright/test";

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

test("io recognition publishes range-checked story.memoryBeat", async ({ page }) => {
  await page.goto("/aftersign/index.html?slot=io-memory-beat-contract");

  await page.evaluate(async () => {
    const game = (window as Window & {
      __game?: {
        input?: { choose?: (choiceId: string) => Promise<void>; advance?: () => Promise<void> };
      };
    }).__game;
    if (!game?.input?.choose || !game.input.advance) {
      throw new Error("window.__game.input is not available");
    }
    await game.input.choose("keep-packet-sealed");
    await game.input.choose("deliver-packet");
    await game.input.advance();
  });

  const sealedHandle = await page.waitForFunction(() => {
    const game = (window as Window & { __game?: { story?: { memoryBeat?: unknown } } }).__game;
    return game?.story?.memoryBeat ?? null;
  });
  const sealed = (await sealedHandle.jsonValue()) as MemoryBeat;

  await page.evaluate(async () => {
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
    // forceReload restores from persisted save; ensure memoryBeat is cleared
    // so waitForFunction below observes only the freshly published opened beat.
    if (game.story) {
      game.story.memoryBeat = null;
    }
    await game.input.choose("open-packet");
    await game.input.choose("deliver-packet");
    await game.input.advance();
  });

  const openedHandle = await page.waitForFunction(() => {
    const game = (window as Window & { __game?: { story?: { memoryBeat?: { outcome?: string } | null } } }).__game;
    const beat = game?.story?.memoryBeat ?? null;
    // Only accept the freshly-published opened beat (guards against a stale
    // sealed beat that survived forceReload's save restoration).
    return beat && beat.outcome === "opened" ? beat : null;
  });
  const opened = (await openedHandle.jsonValue()) as MemoryBeat;

  const beats: MemoryBeat[] = [sealed, opened];

  for (const beat of beats) {

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
  }

  expect(beats.map((beat) => beat.outcome).sort()).toEqual(["opened", "sealed"]);
});
