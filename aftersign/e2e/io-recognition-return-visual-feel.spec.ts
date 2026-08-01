import { test, expect, Page } from "@playwright/test";

// Cold-start budget matches the sibling e2e specs: SwiftShader + three.js
// context init can burn most of Playwright's default 30s on a cold CI runner
// before the first assertion even lands.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

// Bounded feel envelope for the Io return-recognition beat. Sourced from
// window.__game.story.memoryBeat (aftersign/index.html publishState) — the
// runtime's real recognition surface. There is no top-level `recognition`
// object on __game, and memoryBeat has no vignetteAlpha field, so this
// spec asserts only what the runtime actually publishes.
//
// Camera bounds come from the OWNING feel spec —
// docs/flagship/io-recognition-beat.md, mirrored in
// aftersign/e2e/io-recognition-memory-beat-contract.spec.ts:
//   cameraDeltaMeters ∈ [0.24m, 0.36m]  (authored dolly ≈ 0.32m)
//   cameraYawDegrees  ∈ [3°, 5°]        (authored yaw ≈ 4°)
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

type MemoryFact = {
  id: string;
  predicate: string;
  object: string;
  sessionId: string;
};

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
  story: {
    currentNpcId: string | null;
    memoryBeat: StoryMemoryBeat | null;
  };
  npcs: {
    io: {
      memory: MemoryFact[];
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: { revision: number; dirty: boolean };
  input: {
    choose(
      choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet",
    ): Promise<void>;
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

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      Boolean(
        window.__game?.input?.choose &&
          window.__game.input.advance &&
          window.__game.input.forceReload &&
          window.__game.input.forceSave,
      ),
    undefined,
    { timeout: WAIT_MS },
  );
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

  const slot = `io-recognition-return-visual-${Date.now()}`;
  await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });
  await waitForGame(page);

  // First pass — mint the sealed-delivery memory, persist it, hard reload.
  // This proves the beat can be triggered on a RETURNING session (the
  // returning-player memory shape is the whole point of this spec).
  await waitForBeat(page, "packet-offered");
  await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
  await waitForBeat(page, "packet-choice");
  await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
  await waitForBeat(page, "packet-delivered");

  await page.evaluate(() => window.__game!.input.forceSave());
  await page.waitForFunction(
    () => window.__game?.save.dirty === false,
    undefined,
    { timeout: WAIT_MS },
  );
  await page.evaluate(() => window.__game!.input.forceReload());
  await waitForGame(page);

  // The persisted payload has no `story` field (buildPersistPayload omits it
  // by design — the beat is derived, not stored), so memoryBeat is null
  // after reload. Re-drive the recognition flow so the 1,180ms setTimeout
  // inside deliverPacket re-arms and publishes a fresh memoryBeat. This is
  // the same pattern io-recognition-memory-beat-contract.spec.ts uses.
  await page.evaluate(async () => {
    await window.__game!.input.choose("keep-packet-sealed");
    await window.__game!.input.choose("deliver-packet");
    await window.__game!.input.advance();
  });

  // The beat is published from a setTimeout ~1,180ms after deliver-packet,
  // so poll story.memoryBeat until it lands. Timeout is generous enough for
  // SwiftShader tick jitter on cold CI.
  const beatHandle = await page.waitForFunction(
    () => {
      const beat = window.__game?.story?.memoryBeat ?? null;
      return beat && beat.kind === "io_packet_return" ? beat : null;
    },
    undefined,
    { timeout: WAIT_MS },
  );
  const beat = (await beatHandle.jsonValue()) as StoryMemoryBeat;

  // Scene + line surface: proves the returning-player copy fires against
  // the sealed-delivery memory that survived the reload.
  const returnSurface = await page.evaluate(() => ({
    beat: window.__game!.scene.beat,
    lastLine: window.__game!.npcs.io.lastLine,
    memoryRefs: window.__game!.npcs.io.lastLineMemoryRefs,
  }));
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
