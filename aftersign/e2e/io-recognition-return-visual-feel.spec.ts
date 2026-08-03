import { expect, test, type Page } from "@playwright/test";

// Visual-feel spec for Io's returning-session recognition beat.
//
// This spec is deliberately anchored to the SAME surface the runtime
// actually publishes from aftersign/main.js `publishState`:
//   - scene.beat                            (top-level)
//   - story.memoryBeat.{kind,outcome,startedAt,endedAt,
//                       cameraDeltaMeters,cameraYawDegrees,inputLockMs,lineId}
//   - npcs.io.lastLine / npcs.io.lastLineMemoryRefs
//   - interaction.recognitionFeedback.{durationMs,cameraDeltaMeters,cameraYawDegrees}
//
// It does NOT read a `recognition` object, a `debug` object, or a
// top-level `lastNpcLine` — none of those exist on window.__game.
// It drives the beat the way the sibling
// io-recognition-memory-beat-contract.spec.ts does: navigate with
// ?slot=…, wait for window.__game.input, then
// choose('keep-packet-sealed') → choose('deliver-packet') → advance().
// The seeded-save mechanism keys off ?slot= (localStorage key
// `aftersign:kiosk-slice:${slot}`), not ?player=/?seed=.

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

// Bounds mirror the sibling io-recognition-memory-beat-contract spec so
// this "visual feel" surface stays consistent with the durable memory
// beat contract. Any drift here means one of the two specs is wrong
// about the runtime — not that the runtime has two contracts.
const BEAT_LIMITS = {
  durationMs: { min: 1100, max: 1350 },
  cameraDeltaMeters: { min: 0.24, max: 0.36 },
  cameraYawDegrees: { min: 3, max: 5 },
  inputLockMsMax: 1220,
} as const;

// The two verbatim lines Io speaks at io-return-recognition (see
// aftersign/main.js `lineForBeat`).
const SEALED_RECOGNITION_LINE =
  "I remember you: blue seal, unbroken. The kiosk kept the route; I kept your name beside it.";
const OPENED_RECOGNITION_LINE =
  "I remember you: blue route delivered. The seal did not survive. The kiosk kept the route; I kept the risk beside your name.";

const EXPECTED_LINE: Record<RecognitionOutcome, string> = {
  sealed: SEALED_RECOGNITION_LINE,
  opened: OPENED_RECOGNITION_LINE,
};

const EXPECTED_LINE_ID: Record<RecognitionOutcome, string> = {
  sealed: "io_return_packet_sealed",
  opened: "io_return_packet_opened",
};

const waitForGame = async (page: Page) => {
  await page.waitForFunction(
    () =>
      Boolean(
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

const driveRecognition = async (page: Page, outcome: RecognitionOutcome) => {
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
};

// Wait until state.story.memoryBeat has been populated with the expected
// outcome. deliverPacket() arms a ~1180ms setTimeout that publishes the
// beat, so we poll rather than assume any single frame.
const waitForMemoryBeat = async (page: Page, outcome: RecognitionOutcome) => {
  const handle = await page.waitForFunction(
    (expected) => {
      const beat =
        (window as Window & {
          __game?: { story?: { memoryBeat?: { outcome?: string } | null } };
        }).__game?.story?.memoryBeat ?? null;
      return beat && beat.outcome === expected ? beat : null;
    },
    outcome,
    { timeout: WAIT_MS },
  );
  return (await handle.jsonValue()) as MemoryBeat;
};

type FeelSnapshot = {
  sceneBeat: string;
  storyCurrentNpcId: string | null;
  memoryBeat: MemoryBeat;
  ioLastLine: string;
  ioLastLineMemoryRefs: string[];
  recognitionFeedback: {
    durationMs?: number;
    cameraDeltaMeters?: number;
    cameraYawDegrees?: number;
  };
};

const readFeelSnapshot = async (page: Page): Promise<FeelSnapshot> => {
  return page.evaluate(() => {
    const game = (window as Window & {
      __game?: {
        scene?: { beat?: string };
        story?: { currentNpcId?: string | null; memoryBeat?: unknown };
        npcs?: { io?: { lastLine?: string | null; lastLineMemoryRefs?: string[] } };
        interaction?: {
          recognitionFeedback?: {
            durationMs?: number;
            cameraDeltaMeters?: number;
            cameraYawDegrees?: number;
          };
        };
      };
    }).__game;
    if (!game) throw new Error("window.__game is not available");
    return {
      sceneBeat: game.scene?.beat ?? "",
      storyCurrentNpcId: game.story?.currentNpcId ?? null,
      memoryBeat: (game.story?.memoryBeat ?? null) as MemoryBeat,
      ioLastLine: game.npcs?.io?.lastLine ?? "",
      ioLastLineMemoryRefs: game.npcs?.io?.lastLineMemoryRefs ?? [],
      recognitionFeedback: game.interaction?.recognitionFeedback ?? {},
    };
  });
};

const assertVisualFeel = (snapshot: FeelSnapshot, outcome: RecognitionOutcome) => {
  // Scene has actually transitioned into the recognition beat, and the
  // story lane knows Io is the current speaker.
  expect(snapshot.sceneBeat).toBe("io-return-recognition");
  expect(snapshot.storyCurrentNpcId).toBe("io");

  // Durable memory beat shape (matches the sibling contract spec).
  const beat = snapshot.memoryBeat;
  expect(beat).toBeTruthy();
  expect(beat.kind).toBe("io_packet_return");
  expect(beat.outcome).toBe(outcome);
  expect(beat.lineId).toBe(EXPECTED_LINE_ID[outcome]);

  const durationMs = beat.endedAt - beat.startedAt;
  expect(durationMs).toBeGreaterThanOrEqual(BEAT_LIMITS.durationMs.min);
  expect(durationMs).toBeLessThanOrEqual(BEAT_LIMITS.durationMs.max);

  expect(beat.cameraDeltaMeters).toBeGreaterThanOrEqual(BEAT_LIMITS.cameraDeltaMeters.min);
  expect(beat.cameraDeltaMeters).toBeLessThanOrEqual(BEAT_LIMITS.cameraDeltaMeters.max);
  expect(beat.cameraYawDegrees).toBeGreaterThanOrEqual(BEAT_LIMITS.cameraYawDegrees.min);
  expect(beat.cameraYawDegrees).toBeLessThanOrEqual(BEAT_LIMITS.cameraYawDegrees.max);
  expect(beat.inputLockMs).toBeLessThanOrEqual(BEAT_LIMITS.inputLockMsMax);

  // Spoken line matches the outcome verbatim, and lastLineMemoryRefs
  // is populated (io-return-recognition is the beat that references
  // the delivery-outcome memory fact).
  expect(snapshot.ioLastLine).toBe(EXPECTED_LINE[outcome]);
  expect(snapshot.ioLastLineMemoryRefs.length).toBeGreaterThan(0);

  // The LIVE recognition feedback envelope (interaction.recognitionFeedback)
  // is the surface the visual layer reads to drive camera + glow amplitudes
  // during the beat. It's populated from IO_RECOGNITION_BEAT_FEEDBACK at
  // module init and can be zeroed by the harness — assert it is present
  // and inside the same camera-motion band as the durable beat.
  const feel = snapshot.recognitionFeedback;
  expect(typeof feel.durationMs).toBe("number");
  expect(feel.durationMs!).toBeGreaterThan(0);
  expect(feel.durationMs!).toBeLessThanOrEqual(BEAT_LIMITS.inputLockMsMax);
  expect(typeof feel.cameraDeltaMeters).toBe("number");
  expect(feel.cameraDeltaMeters!).toBeGreaterThanOrEqual(BEAT_LIMITS.cameraDeltaMeters.min);
  expect(feel.cameraDeltaMeters!).toBeLessThanOrEqual(BEAT_LIMITS.cameraDeltaMeters.max);
  expect(typeof feel.cameraYawDegrees).toBe("number");
  expect(feel.cameraYawDegrees!).toBeGreaterThanOrEqual(BEAT_LIMITS.cameraYawDegrees.min);
  expect(feel.cameraYawDegrees!).toBeLessThanOrEqual(BEAT_LIMITS.cameraYawDegrees.max);
};

test("io return recognition publishes readable visual-feel numbers (sealed)", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/aftersign/index.html?slot=io-return-visual-feel-sealed", { waitUntil: "load" });

  await driveRecognition(page, "sealed");
  await waitForMemoryBeat(page, "sealed");
  const snapshot = await readFeelSnapshot(page);
  assertVisualFeel(snapshot, "sealed");
});

test("io return recognition publishes readable visual-feel numbers (opened)", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/aftersign/index.html?slot=io-return-visual-feel-opened", { waitUntil: "load" });

  await driveRecognition(page, "opened");
  await waitForMemoryBeat(page, "opened");
  const snapshot = await readFeelSnapshot(page);
  assertVisualFeel(snapshot, "opened");
});
