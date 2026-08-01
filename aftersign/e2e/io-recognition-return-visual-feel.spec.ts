import { test, expect, type Page } from "@playwright/test";

// Cold-start budget matches the sibling e2e specs: SwiftShader + three.js
// context init can burn most of Playwright's default 30s on a cold CI runner
// before the first assertion even lands.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

// Bounded feel envelope for the Io return-recognition beat. Sourced from
// window.__game.story.memoryBeat (aftersign/index.html:1459-1474 — the
// runtime's real recognition surface). memoryBeat.kind is
// "io_packet_return" and its fields are startedAt/endedAt/
// cameraDeltaMeters/cameraYawDegrees/inputLockMs/lineId — this spec
// asserts only what the runtime actually publishes.
//
// Camera bounds match the OWNING feel spec —
// docs/flagship/io-recognition-beat.md, mirrored in
// aftersign/e2e/io-recognition-memory-beat-contract.spec.ts:
//   cameraDeltaMeters ∈ [0.24m, 0.36m]  (authored dolly ≈ 0.32m)
//   cameraYawDegrees  ∈ [3°, 5°]        (authored yaw  ≈ 4°)
// Duration mirrors the 1,180ms beat with slack for tick jitter.
const RETURN_RECOGNITION_VISUAL_FEEL = {
  minSettleMs: 1_100,
  maxSettleMs: 1_350,
  minDollyMeters: 0.24,
  maxDollyMeters: 0.36,
  minYawDeg: 3,
  maxYawDeg: 5,
} as const;

type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-choice"
  | "packet-delivered"
  | "io-return-recognition";

// Shape from aftersign/index.html publishState() — story.memoryBeat is null
// until the recognition beat lands (the 1,180ms setTimeout inside
// deliverPacket populates it), then carries the measured envelope.
type StoryMemoryBeat = {
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
  npcs: {
    io: {
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: { revision: number; dirty: boolean };
  story?: { memoryBeat?: StoryMemoryBeat | null };
  input: {
    choose(choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet"): Promise<void>;
    advance(): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

test("Io return recognition beat exposes bounded visual feel numbers", async ({
  page,
}) => {
  test.setTimeout(COLD_START_MS);

  // Returning-session fixture — matches the proven flow in
  // io-recognition-feedback-latency.spec.ts: run the packet-offered →
  // packet-choice → packet-delivered chain, forceSave, forceReload, then
  // advance() to trigger the recognition beat. This is the ONLY reliable
  // way to observe story.memoryBeat because buildPersistPayload
  // (aftersign/index.html:727-742) intentionally has no `story` field —
  // memoryBeat is derived from a re-armed 1,180ms setTimeout inside
  // deliverPacket, not restored from disk.
  const slot = `io-recognition-return-visual-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

  await waitForBeat(page, "packet-offered");
  await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
  await waitForBeat(page, "packet-choice");
  await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
  await waitForBeat(page, "packet-delivered");

  await page.evaluate(() => window.__game!.input.forceSave());
  await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
    timeout: WAIT_MS,
  });

  // Simulate the player returning: reload from save, then null the
  // memoryBeat surface so any value we later read was minted THIS cycle
  // (not left over pre-reload).
  await page.evaluate(() => window.__game!.input.forceReload());
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
  await waitForBeat(page, "packet-delivered");
  await page.evaluate(() => {
    if (window.__game?.story) {
      window.__game.story.memoryBeat = null;
    }
  });

  // advance() flips beat → "io-return-recognition" synchronously and arms
  // the 1,180ms setTimeout that populates story.memoryBeat.
  await page.evaluate(() => window.__game!.input.advance());
  await waitForBeat(page, "io-return-recognition");

  // Poll story.memoryBeat until the setTimeout lands. Timeout is generous
  // enough for SwiftShader tick jitter on cold CI.
  const beatHandle = await page.waitForFunction(
    () => {
      const beat = window.__game?.story?.memoryBeat ?? null;
      return beat && beat.kind === "io_packet_return" && beat.outcome === "sealed"
        ? beat
        : null;
    },
    undefined,
    { timeout: WAIT_MS },
  );
  const beat = (await beatHandle.jsonValue()) as StoryMemoryBeat;

  // Scene + line surface: proves the returning-player copy fires against
  // the sealed-delivery memory the beat represents.
  const returnSurface = await page.evaluate(() => {
    const game = window.__game;
    if (!game) throw new Error("window.__game is not available");
    return {
      beat: game.scene.beat,
      lastLine: game.npcs.io.lastLine,
      memoryRefs: game.npcs.io.lastLineMemoryRefs,
    };
  });
  expect(returnSurface.beat).toBe("io-return-recognition");
  expect(returnSurface.lastLine).toContain("blue seal, unbroken");
  expect(returnSurface.memoryRefs.length).toBeGreaterThan(0);

  // Feel envelope — this is the spec's whole point: bounded numbers, not
  // "it fired". Every assertion is against a real field the runtime
  // publishes at aftersign/index.html:1459-1474.
  expect(beat.outcome).toBe("sealed");

  const settleMs = beat.endedAt - beat.startedAt;
  expect(settleMs).toBeGreaterThanOrEqual(
    RETURN_RECOGNITION_VISUAL_FEEL.minSettleMs,
  );
  expect(settleMs).toBeLessThanOrEqual(
    RETURN_RECOGNITION_VISUAL_FEEL.maxSettleMs,
  );

  const dolly = Math.abs(beat.cameraDeltaMeters);
  expect(dolly).toBeGreaterThanOrEqual(
    RETURN_RECOGNITION_VISUAL_FEEL.minDollyMeters,
  );
  expect(dolly).toBeLessThanOrEqual(
    RETURN_RECOGNITION_VISUAL_FEEL.maxDollyMeters,
  );

  const yaw = Math.abs(beat.cameraYawDegrees);
  expect(yaw).toBeGreaterThanOrEqual(RETURN_RECOGNITION_VISUAL_FEEL.minYawDeg);
  expect(yaw).toBeLessThanOrEqual(RETURN_RECOGNITION_VISUAL_FEEL.maxYawDeg);
});
