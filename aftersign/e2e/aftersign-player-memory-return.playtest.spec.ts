import { expect, test, type Page, type Locator, type Route } from "@playwright/test";

import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";

// #2612 — visible-control coverage for the player-memory flow.
// Taps only (no window.__game state creation): play to io-return-recognition,
// assert the client POSTs recognition facts to /player-memory after the
// committed save, then reload with the authoritative save's memory STRIPPED,
// so Io's recognition after reload can only come from the GET /player-memory
// payload (proves the fallback path is actually consumed, not just requested).
//
// /player-memory is route-mocked with an in-test store: preview deploys do not
// serve that route (404), and the mock lets us control the GET payload.

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

// Recursively remove every `memory` array so the save carries no recognition
// memory. Returns how many arrays were removed.
function stripMemory(node: unknown): number {
  if (!node || typeof node !== "object") return 0;
  let removed = 0;
  if (Array.isArray(node)) {
    for (const item of node) removed += stripMemory(item);
    return removed;
  }
  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key === "memory" && Array.isArray(obj[key])) {
      obj[key] = [];
      removed += 1;
    } else {
      removed += stripMemory(obj[key]);
    }
  }
  return removed;
}

test.describe("AFTERSIGN player-memory returning-player playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("persists Io's recognition fact to /player-memory and restores it from player-memory after reload", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    let storedFacts: Record<string, unknown> = {};
    const writes: unknown[] = [];
    let playerMemoryGets = 0;
    let servedIoMemoryLength = 0;

    await page.route(
      (url) => url.pathname === "/player-memory",
      async (route: Route) => {
        const req = route.request();
        if (req.method() === "POST") {
          let body: unknown = null;
          try {
            body = req.postDataJSON();
          } catch {
            body = null;
          }
          writes.push(body);
          if (body && typeof body === "object") storedFacts = body as Record<string, unknown>;
          await route.fulfill({ status: 200, json: { facts: storedFacts } });
          return;
        }
        playerMemoryGets += 1;
        const io = (storedFacts as { ioMemory?: unknown }).ioMemory;
        servedIoMemoryLength = Array.isArray(io) ? io.length : 0;
        await route.fulfill({ status: 200, json: { facts: storedFacts } });
      },
    );

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

    await expect
      .poll(
        () =>
          writes.some(
            (body) =>
              !!body &&
              typeof body === "object" &&
              Array.isArray((body as { ioMemory?: unknown }).ioMemory) &&
              (body as { ioMemory: unknown[] }).ioMemory.length > 0,
          ),
        { timeout: WAIT_MS, message: "client should POST non-empty ioMemory to /player-memory" },
      )
      .toBe(true);

    // From here on, the authoritative save is served WITHOUT any memory, so
    // the save-first precedence in main.js cannot satisfy recognition.
    let strippedArrays = 0;
    await page.route(
      (url) => url.pathname !== "/player-memory",
      async (route: Route) => {
        const req = route.request();
        const type = req.resourceType();
        if (req.method() !== "GET" || (type !== "fetch" && type !== "xhr")) {
          await route.fallback();
          return;
        }
        const response = await route.fetch();
        const text = await response.text();
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          await route.fulfill({ response, body: text });
          return;
        }
        strippedArrays += stripMemory(json);
        await route.fulfill({ response, json });
      },
    );

    await page.reload({ waitUntil: "load" });

    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#line")).toHaveText(SEALED_RECOGNITION_LINE, { timeout: WAIT_MS });

    expect(strippedArrays, "reload must strip memory out of the authoritative save").toBeGreaterThan(0);
    expect(playerMemoryGets, "boot must GET /player-memory").toBeGreaterThan(0);
    expect(servedIoMemoryLength, "GET /player-memory must serve the persisted ioMemory").toBeGreaterThan(0);
  });
});
