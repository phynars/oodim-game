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

type GameInput = {
  choose(choiceId: string): Promise<void>;
  advance(): Promise<void>;
  forceReload(): Promise<void>;
};

type GameSurface = {
  version: 1;
  scene: { beat: string };
  npcs: {
    io: {
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  story?: { memoryBeat?: StoryMemoryBeat | null };
  input: GameInput;
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

// Wait for the module script to boot the game surface, mirroring the
// sibling io-recognition-memory-beat-contract.spec.ts. Without this, the
// first page.evaluate can race the deferred module import and throw
// "window.__game.input is not available" on cold CI before three.js has
// finished initializing.
async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      Boolean(
        window.__game?.input?.choose &&
          window.__game.input.advance &&
          window.__game.input.forceReload,
      ),
    undefined,
    { timeout: WAIT_MS },
  );
}

test("Io return recognition beat exposes bounded visual feel numbers", async ({
  page,
}) => {
  test.setTimeout(COLD_START_MS);

  // Mirror the proven recipe in io-recognition-memory-beat-contract.spec.ts:
  //   forceReload → clear story.memoryBeat → choose(keep-sealed) →
  //   choose(deliver-packet) → advance() → poll story.memoryBeat.
  //
  // Why we do NOT wait for intermediate beat transitions here:
  //   - After forceReload with no prior save, scene.beat is "packet-offered"
  //     (aftersign/index.html:293) and the game surface is idle.
  //   - choose("keep-packet-sealed") synchronously flips beat →
  //     "packet-choice" (index.html:887); choose("deliver-packet") calls
  //     deliverPacket() (index.html:891) which flips beat →
  //     "packet-delivered" AND arms the 1,180ms setTimeout that publishes
  //     story.memoryBeat AND flips beat → "io-return-recognition"
  //     (index.html:1451-1477).
  //   - advance() (index.html:960-965) is a no-op if the setTimeout has
  //     already flipped beat; if we call it before the setTimeout fires,
  //     it flips beat early — either way the story.memoryBeat poll below
  //     is what actually gates the assertions.
  //
  // Skipping intermediate waitForBeat() calls avoids the reviewer-flagged
  // hang: this spec previously waited for scene.beat === "packet-offered"
  // AFTER forceReload, but forceReload restores scene.beat from disk
  // (index.html:1106-1108) — never "packet-offered" if the pre-save flow
  // had already driven past it — and the wait timed out.
  const slot = `io-recognition-return-visual-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForGame(page);

  await page.evaluate(async () => {
    const game = window.__game;
    if (!game?.input?.choose || !game.input.advance || !game.input.forceReload) {
      throw new Error("window.__game.input is not available");
    }
    await game.input.forceReload();
    if (game.story) {
      game.story.memoryBeat = null;
    }
    await game.input.choose("keep-packet-sealed");
    await game.input.choose("deliver-packet");
    await game.input.advance();
  });

  // Poll story.memoryBeat until the 1,180ms setTimeout inside deliverPacket
  // (aftersign/index.html:1452-1477) publishes it. Timeout is generous
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
