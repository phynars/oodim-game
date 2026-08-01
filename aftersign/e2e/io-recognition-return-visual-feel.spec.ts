import { test, expect, Page } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

const RETURN_RECOGNITION_VISUAL_FEEL = {
  maxSettleMs: 1_180,
  minHoldMs: 720,
  maxDollyCm: 18,
  maxYawDeg: 4.5,
  maxVignetteAlpha: 0.2,
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

type GameSurface = {
  version: 1;
  scene: { beat: Beat };
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

type OptionalRecognitionFeelSurface = {
  recognition?: {
    startedAtMs?: number;
    settledAtMs?: number;
    cameraDollyCm?: number;
    cameraYawDeg?: number;
    vignetteAlpha?: number;
  };
};

declare global {
  interface Window {
    __game?: GameSurface & OptionalRecognitionFeelSurface;
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
    const feel = snapshot.recognition;
    return {
      beat: snapshot.scene.beat,
      lastLine: snapshot.npcs.io.lastLine,
      memoryRefs: snapshot.npcs.io.lastLineMemoryRefs,
      hasFeelSurface: Boolean(feel),
      settleMs:
        typeof feel?.startedAtMs === "number" && typeof feel?.settledAtMs === "number"
          ? feel.settledAtMs - feel.startedAtMs
          : null,
      cameraDollyCm: feel?.cameraDollyCm ?? null,
      cameraYawDeg: feel?.cameraYawDeg ?? null,
      vignetteAlpha: feel?.vignetteAlpha ?? null,
    };
  });

  expect(result.beat).toBe("io-return-recognition");
  expect(result.lastLine).toContain("blue seal, unbroken");
  expect(result.memoryRefs.length).toBeGreaterThan(0);

  expect(result.hasFeelSurface).toBe(true);
  expect(result.settleMs).not.toBeNull();
  expect(result.settleMs!).toBeGreaterThanOrEqual(RETURN_RECOGNITION_VISUAL_FEEL.minHoldMs);
  expect(result.settleMs!).toBeLessThanOrEqual(RETURN_RECOGNITION_VISUAL_FEEL.maxSettleMs);

  expect(result.cameraDollyCm).not.toBeNull();
  expect(Math.abs(result.cameraDollyCm!)).toBeLessThanOrEqual(
    RETURN_RECOGNITION_VISUAL_FEEL.maxDollyCm,
  );

  expect(result.cameraYawDeg).not.toBeNull();
  expect(Math.abs(result.cameraYawDeg!)).toBeLessThanOrEqual(
    RETURN_RECOGNITION_VISUAL_FEEL.maxYawDeg,
  );

  expect(result.vignetteAlpha).not.toBeNull();
  expect(result.vignetteAlpha!).toBeGreaterThanOrEqual(0);
  expect(result.vignetteAlpha!).toBeLessThanOrEqual(
    RETURN_RECOGNITION_VISUAL_FEEL.maxVignetteAlpha,
  );
});
