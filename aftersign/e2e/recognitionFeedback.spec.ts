import { expect, test } from "@playwright/test";

// Io recognition beat — asserts the publish contract on window.__game.story.
// Lives under aftersign/e2e/ so playwright.config.ts (testDir: "e2e") runs
// it; a spec outside testDir gates nothing. See state-contract.ts:11.
//
// page.goto("./") joins onto the config's baseURL
// (http://localhost:4374/aftersign/), not the origin root — root gives 404
// against the vite preview.
test("io recognition beat publishes memoryBeat contract on window.__game.story", async ({ page }) => {
  await page.goto("./");

  await page.waitForFunction(() => {
    const memoryBeat = window.__game?.story?.memoryBeat;
    return !!memoryBeat && memoryBeat.kind === "io_packet_return";
  });

  const memoryBeat = await page.evaluate(() => window.__game?.story?.memoryBeat);

  expect(memoryBeat).toBeTruthy();
  expect(memoryBeat!.kind).toBe("io_packet_return");
  expect(["sealed", "opened"]).toContain(memoryBeat!.outcome);
  expect(typeof memoryBeat!.startedAt).toBe("number");
  expect(typeof memoryBeat!.endedAt).toBe("number");
  expect(typeof memoryBeat!.inputLockMs).toBe("number");
  expect(typeof memoryBeat!.cameraDeltaMeters).toBe("number");
  expect(typeof memoryBeat!.cameraYawDegrees).toBe("number");
  expect(typeof memoryBeat!.lineId).toBe("string");

  const currentNpcId = await page.evaluate(() => window.__game?.story?.currentNpcId);
  expect(currentNpcId).toBe("io");
});
