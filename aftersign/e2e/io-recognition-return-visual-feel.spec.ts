import { test, expect, Page } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

// Bounded feel envelope for the Io return-recognition beat. Sourced from
// window.__game.story.memoryBeat (aftersign/index.html publishState) — the
// runtime's real recognition surface. There is no top-level `recognition`
// object on __game, and memoryBeat has no vignetteAlpha field, so this
// spec asserts only what the runtime actually publishes.
const RETURN_RECOGNITION_VISUAL_FEEL = {
  maxSettleMs: 1_180,
  minHoldMs: 720,
  // memoryBeat.cameraDeltaMeters is in METERS. 0.18 m == 18 cm — matches
  // the intended "small, tight dolly" feel budget from the plan doc.
  maxDollyMeters: 0.18,
  maxYawDeg: 4.5,
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
// until the recognition beat lands, then carries the measured envelope.
type StoryMemoryBeat = {
  startedAt?: number;
  endedAt?: number;
  cameraDeltaMeters?: number;
  cameraYawDegrees?: number;
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

async function createReturningSealedPacketSession(page: Page): Promise<void> {
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
  await page.evaluate(() => window.__game!.input.forceReload());
}

test("Io return recognition beat exposes bounded visual feel numbers", async ({ page }) => {
  test.setTimeout(COLD_START_MS);

  await createReturningSealedPacketSession(page);

  const result = await page.evaluate(async () => {
    await window.__game!.input.advance();
    const snapshot = window.__game!;
    const feel = snapshot.story.memoryBeat;
    return {
      beat: snapshot.scene.beat,
      lastLine: snapshot.npcs.io.lastLine,
      memoryRefs: snapshot.npcs.io.lastLineMemoryRefs,
      hasFeelSurface: Boolean(feel),
      settleMs:
        typeof feel?.startedAt === "number" && typeof feel?.endedAt === "number"
          ? feel.endedAt - feel.startedAt
          : null,
      cameraDeltaMeters: typeof feel?.cameraDeltaMeters === "number" ? feel.cameraDeltaMeters : null,
      cameraYawDegrees: typeof feel?.cameraYawDegrees === "number" ? feel.cameraYawDegrees : null,
    };
  });

  expect(result.beat).toBe("io-return-recognition");
  expect(result.lastLine).toContain("blue seal, unbroken");
  expect(result.memoryRefs.length).toBeGreaterThan(0);

  expect(result.hasFeelSurface).toBe(true);
  expect(result.settleMs).not.toBeNull();
  expect(result.settleMs!).toBeGreaterThanOrEqual(RETURN_RECOGNITION_VISUAL_FEEL.minHoldMs);
  expect(result.settleMs!).toBeLessThanOrEqual(RETURN_RECOGNITION_VISUAL_FEEL.maxSettleMs);

  expect(result.cameraDeltaMeters).not.toBeNull();
  expect(Math.abs(result.cameraDeltaMeters!)).toBeLessThanOrEqual(
    RETURN_RECOGNITION_VISUAL_FEEL.maxDollyMeters,
  );

  expect(result.cameraYawDegrees).not.toBeNull();
  expect(Math.abs(result.cameraYawDegrees!)).toBeLessThanOrEqual(
    RETURN_RECOGNITION_VISUAL_FEEL.maxYawDeg,
  );
});
