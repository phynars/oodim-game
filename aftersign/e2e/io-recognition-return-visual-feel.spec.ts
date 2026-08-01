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

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const game = (window as unknown as {
        __game?: {
          input?: {
            choose?: unknown;
            advance?: unknown;
            forceReload?: unknown;
          };
        };
      }).__game;
      return Boolean(
        game?.input?.choose && game.input.advance && game.input.forceReload,
      );
    },
    undefined,
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

  // Mirror the returning-player entry pattern from the sibling contract
  // spec (aftersign/e2e/io-recognition-memory-beat-contract.spec.ts): a
  // forceReload followed by choose+choose+advance re-arms the 1,180ms
  // recognition setTimeout that populates story.memoryBeat. Nulling the
  // beat first proves the value we later read was minted THIS cycle, not
  // left over from a previous run.
  //
  // buildPersistPayload (aftersign/index.html:727-742) has no `story`
  // field by design, so memoryBeat is intentionally derived (not stored) —
  // that's why re-driving the flow is the correct way to observe the beat
  // on a returning session, not restoring it from disk.
  await page.evaluate(async () => {
    const game = (window as unknown as {
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
    await game.input.choose("keep-packet-sealed");
    await game.input.choose("deliver-packet");
    await game.input.advance();
  });

  // The beat is published from a setTimeout ~1,180ms after deliver-packet,
  // so poll story.memoryBeat until it lands. Timeout is generous enough
  // for SwiftShader tick jitter on cold CI.
  const beatHandle = await page.waitForFunction(
    () => {
      const game = (window as unknown as {
        __game?: {
          story?: {
            memoryBeat?: {
              kind?: string;
              outcome?: string;
            } | null;
          };
        };
      }).__game;
      const beat = game?.story?.memoryBeat ?? null;
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
    const game = (window as unknown as {
      __game?: {
        scene: { beat: Beat };
        npcs: {
          io: {
            lastLine: string | null;
            lastLineMemoryRefs: string[];
          };
        };
      };
    }).__game;
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
