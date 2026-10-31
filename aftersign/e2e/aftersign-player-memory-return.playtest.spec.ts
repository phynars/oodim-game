import { expect, test, type Page, type Locator } from "@playwright/test";

import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";

// #2612 — visible-control coverage for the served player-memory flow.
// Taps only (no window.__game state creation): play to io-return-recognition,
// assert the client POSTed recognition facts to /player-memory after the
// committed save, reload, assert the client GETs /player-memory on boot and
// Io's recognition dialogue reflects the persisted fact.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 180_000;
const WAIT_MS = 60_000;
const SEALED_RECOGNITION_LINE = expectedIoRecognitionLine("sealed", false);

async function waitForBeat(page: Page, beatId: string): Promise<Locator> {
  const beatNode = page.locator(`[data-beat-id="${beatId}"]`);
  await expect(beatNode, `story line should reach beat "${beatId}"`).toBeVisible({
    timeout: WAIT_MS,
  });
  return beatNode;
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice, `visible dialogue control for "${choiceId}"`).toBeVisible({
    timeout: WAIT_MS,
  });
  await choice.click();
}

test.describe("AFTERSIGN player-memory returning-player playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("persists Io's recognition fact to /player-memory and recognizes the player after reload", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const writes: unknown[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && new URL(req.url()).pathname === "/player-memory") {
        try {
          writes.push(req.postDataJSON());
        } catch {
          writes.push(null);
        }
      }
    });

    const slot = `player-memory-return-${Date.now()}`;
    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });

    await waitForBeat(page, "packet-offered");
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "skip-kiosk-acknowledge");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");
    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#line")).toHaveText(SEALED_RECOGNITION_LINE, { timeout: WAIT_MS });

    // The fact was replicated to the deployed player-memory endpoint.
    await expect
      .poll(
        () =>
          writes.some(
            (body) =>
              !!body &&
              typeof body === "object" &&
              Array.isArray((body as { ioMemory?: unknown }).ioMemory) &&
              ((body as { ioMemory: unknown[] }).ioMemory.length > 0),
          ),
        { timeout: WAIT_MS, message: "client should POST non-empty ioMemory to /player-memory" },
      )
      .toBe(true);

    const bootRead = page.waitForRequest(
      (req) => req.method() === "GET" && new URL(req.url()).pathname === "/player-memory",
      { timeout: WAIT_MS },
    );
    await page.reload({ waitUntil: "load" });
    await bootRead;

    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#line")).toHaveText(SEALED_RECOGNITION_LINE, { timeout: WAIT_MS });
  });
});
