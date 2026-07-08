import { expect, test, type Page } from "@playwright/test";

// Io recognition beat — asserts the publish contract on window.__game.story.
// Lives under aftersign/e2e/ so playwright.config.ts (testDir: "e2e") runs it;
// a spec outside testDir gates nothing. See docs/flagship/io-recognition-beat.md.
//
// The recognition beat only fires on the RETURNING session (packet delivered
// + durable memory + advance()). Cold-boot has nothing to recognize, so this
// spec drives the full flow before observing story.memoryBeat.

// Cold-start budget: SwiftShader init + first WebGL context can exceed
// Playwright's default timeout in CI even when logic is correct.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-opened"
  | "packet-kept-sealed"
  | "packet-delivered"
  | "io-returning-recognition";

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

test("io recognition beat publishes memoryBeat contract on window.__game.story", async ({
  page,
}) => {
  test.setTimeout(COLD_START_MS);

  // Unique slot per run so localStorage from prior runs never bleeds in.
  const slot = `recognition-beat-${Date.now()}`;
  await page.goto(`./?slot=${slot}`, { waitUntil: "load" });

  await waitForBeat(page, "packet-offered");
  await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
  await waitForBeat(page, "packet-kept-sealed");
  await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
  await waitForBeat(page, "packet-delivered");

  await page.evaluate(() => window.__game!.input.forceSave());
  await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
    timeout: WAIT_MS,
  });

  await page.evaluate(() => window.__game!.input.forceReload());
  await page.evaluate(() => window.__game!.input.advance());
  await waitForBeat(page, "io-returning-recognition");

  await page.waitForFunction(
    () => {
      const memoryBeat = window.__game?.story?.memoryBeat;
      return !!memoryBeat && memoryBeat.kind === "io_packet_return";
    },
    undefined,
    { timeout: WAIT_MS },
  );

  const memoryBeat = await page.evaluate(() => window.__game?.story?.memoryBeat);

  expect(memoryBeat).toBeTruthy();
  expect(memoryBeat!.kind).toBe("io_packet_return");
  expect(["sealed", "opened"]).toContain(memoryBeat!.outcome);
  expect(memoryBeat!.outcome).toBe("sealed");
  expect(typeof memoryBeat!.startedAt).toBe("number");
  expect(typeof memoryBeat!.endedAt).toBe("number");
  expect(typeof memoryBeat!.inputLockMs).toBe("number");
  expect(memoryBeat!.inputLockMs).toBeLessThanOrEqual(1220);
  const duration = memoryBeat!.endedAt - memoryBeat!.startedAt;
  expect(duration).toBeGreaterThanOrEqual(1100);
  expect(duration).toBeLessThanOrEqual(1350);
  expect(memoryBeat!.cameraDeltaMeters).toBeGreaterThanOrEqual(0.24);
  expect(memoryBeat!.cameraDeltaMeters).toBeLessThanOrEqual(0.36);
  expect(memoryBeat!.cameraYawDegrees).toBeGreaterThanOrEqual(3);
  expect(memoryBeat!.cameraYawDegrees).toBeLessThanOrEqual(5);
  expect(memoryBeat!.lineId).toBe("io_return_packet_sealed");

  const currentNpcId = await page.evaluate(() => window.__game?.story?.currentNpcId);
  expect(currentNpcId).toBe("io");
});
