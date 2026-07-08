import { test, expect, Page } from "@playwright/test";

// Cold-start budget for SwiftShader + first WebGL context in CI.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

// Memory-beat ranges — measured against the current kiosk-slice camera:
//   CONFIRM_FEEDBACK.cameraKickWorldX = 0.055m, cameraKickDeg = 1.4°.
//   confirmWobble(p) = (1-p)^3 * sin(6π p), peaking around p≈0.083
//   with wobble ≈ 0.77 → peak camera x offset ≈ 0.042m, peak roll ≈ 1.08°.
//
// Ranges are wide enough for frame-timing jitter (60fps sampling) but tight
// enough that REMOVING the camera kick (setting cameraKickWorldX and
// cameraKickDeg to 0, or dropping the wobble term from tick) drops the
// peak to ~0 — well below the min — and this test goes red. That's the
// regression #536 asks us to catch.
const CAMERA_DELTA_METERS_MIN = 0.02;
const CAMERA_DELTA_METERS_MAX = 0.08;
const CAMERA_YAW_DEGREES_MIN = 0.5;
const CAMERA_YAW_DEGREES_MAX = 2.0;

// Beat timing contract from docs/flagship/io-recognition-beat.md:
//   duration 1100–1350ms, inputLockMs <= 1220. Implementation targets
//   1180ms; endedAt is finalized on the first tick past that boundary,
//   so allow a small overrun for frame quantization at ~16ms/frame.
const BEAT_DURATION_MIN_MS = 1100;
const BEAT_DURATION_MAX_MS = 1350;
const INPUT_LOCK_MAX_MS = 1220;

const KNOWN_LINE_IDS = new Set([
  "io.recognition.sealed",
  "io.recognition.opened",
]);

type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-opened"
  | "packet-kept-sealed"
  | "packet-delivered"
  | "io-returning-recognition";

type MemoryBeat = {
  kind: "io_packet_return";
  outcome: "sealed" | "opened";
  startedAt: number;
  endedAt: number;
  cameraDeltaMeters: number;
  cameraYawDegrees: number;
  inputLockMs: number;
  lineId: string;
};

type GameSurface = {
  version: 1;
  scene: { beat: Beat };
  story: { memoryBeat: MemoryBeat | null };
  save: { revision: number; dirty: boolean };
  input: {
    choose(
      choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet",
    ): Promise<void>;
    forceSave(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) =>
      window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

test("Io memory beat exposes camera metrics measured from the actual camera", async ({
  page,
}) => {
  test.setTimeout(COLD_START_MS);

  const slot = `io-memory-beat-contract-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

  await waitForBeat(page, "packet-offered");
  await page.evaluate(() =>
    window.__game!.input.choose("keep-packet-sealed"),
  );
  await waitForBeat(page, "packet-kept-sealed");
  await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
  await waitForBeat(page, "packet-delivered");

  // Wait for the beat window to close — endedAt is finalized on the first
  // tick past startedAt + MEMORY_BEAT_DURATION_MS. After that, cameraDelta
  // reflects the peak observed during the confirm-wobble decay.
  await page.waitForFunction(
    () => {
      const beat = window.__game?.story.memoryBeat;
      if (!beat) return false;
      // endedAt is set to now (>= startedAt + 1180) when the window closes;
      // before that it's still the projected end. Reading a stable peak
      // requires waiting for the tick loop to finalize.
      return beat.endedAt >= beat.startedAt + BEAT_DURATION_MIN_MS
        && beat.cameraDeltaMeters > 0;
    },
    undefined,
    { timeout: WAIT_MS },
  );

  const beat = await page.evaluate(() => window.__game!.story.memoryBeat);
  expect(beat).not.toBeNull();
  const b = beat!;

  expect(b.kind).toBe("io_packet_return");
  expect(b.outcome).toBe("sealed");

  const duration = b.endedAt - b.startedAt;
  expect(duration).toBeGreaterThanOrEqual(BEAT_DURATION_MIN_MS);
  expect(duration).toBeLessThanOrEqual(BEAT_DURATION_MAX_MS);

  expect(b.inputLockMs).toBeLessThanOrEqual(INPUT_LOCK_MAX_MS);
  expect(b.inputLockMs).toBeGreaterThan(0);

  expect(KNOWN_LINE_IDS.has(b.lineId)).toBe(true);
  expect(b.lineId).toBe("io.recognition.sealed");

  // The critical assertion: camera metrics are MEASURED from the real
  // camera during the beat, not hardcoded literals. If someone comments
  // out the CONFIRM_FEEDBACK camera kick in the tick loop, these both
  // read ~0 and the test goes red. That's the regression #536 catches.
  expect(b.cameraDeltaMeters).toBeGreaterThanOrEqual(CAMERA_DELTA_METERS_MIN);
  expect(b.cameraDeltaMeters).toBeLessThanOrEqual(CAMERA_DELTA_METERS_MAX);
  expect(b.cameraYawDegrees).toBeGreaterThanOrEqual(CAMERA_YAW_DEGREES_MIN);
  expect(b.cameraYawDegrees).toBeLessThanOrEqual(CAMERA_YAW_DEGREES_MAX);
});
