import { expect, test, type Page } from "@playwright/test";
import { devices } from "@playwright/test";
import { performPacketGesture } from "./helpers/packetGesture";

type StorySnapshot = {
  scene?: { beat?: string };
  delivery?: { outcome?: string };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => StorySnapshot;
    };
    /**
     * RAF-tight log of every distinct `scene.beat` observed between the
     * delivery tap and the end of the test. Populated by an in-page
     * observer installed BEFORE the deliver click so the transient
     * `packet-delivered` state cannot slip through the 1180ms window
     * before `setBeat("io-return-recognition")` fires (aftersign/main.js
     * — same race the sibling `flagship-reload-beat-regression.spec.ts`
     * closes with its `__flagshipRecognitionSnapshot` observer).
     */
    __sealedDeliveryBeatLog?: string[];
  }
}

const WAIT_MS = 10_000;

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof window.__game?.getSnapshot === "function" &&
      window.__game?.version === 1,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function installBeatObserver(page: Page): Promise<void> {
  // Install the observer BEFORE the deliver tap. `deliverPacket()` in
  // aftersign/main.js publishes `packet-delivered` synchronously and
  // then schedules `setBeat("io-return-recognition")` ~1180ms later.
  // Any post-click `page.evaluate(getSnapshot)` is a cross-RPC round
  // trip — on a loaded CI runner it can straddle the 1180ms window and
  // read the later beat. The observer samples on every animation frame
  // (~16ms) and appends each distinct beat to a log, so the SEQUENCE
  // is observable even if `packet-delivered` has already transitioned
  // by the time Playwright asks for the log.
  await page.evaluate(() => {
    window.__sealedDeliveryBeatLog = [];
    const log = window.__sealedDeliveryBeatLog;
    const sample = () => {
      const beat = window.__game?.getSnapshot?.().scene?.beat;
      if (beat && log[log.length - 1] !== beat) {
        log.push(beat);
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

test.describe("AFTERSIGN sealed delivery story state", () => {
  test.use({ ...devices["iPhone 13"] });

  test("keeps packet-delivered observable at the delivery action boundary before Io recognition", async ({
    page,
  }) => {
    await page.goto(`/aftersign/?slot=sealed-delivery-story-beat-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForGame(page);

    // Real player path: short tap on #packetButton commits SEALED
    // (shared helper — see aftersign/e2e/helpers/packetGesture.ts).
    // Driving via `window.__game.input.choose` would bypass the
    // kiosk's input layer and defeat the point of a played spec.
    await performPacketGesture(page, "sealed", WAIT_MS);

    const deliverButton = page.locator("#deliverButton");
    await expect(deliverButton).toBeVisible({ timeout: WAIT_MS });

    // ARM the RAF observer BEFORE the tap that commits delivery.
    // After this point every beat the engine publishes is recorded on
    // `window.__sealedDeliveryBeatLog` without a cross-RPC gap.
    await installBeatObserver(page);

    await deliverButton.tap();

    // Wait for the later beat on an RAF-polled gate. By the time this
    // resolves the log already contains the full sequence we care
    // about, because the observer has been running since before the
    // delivery tap. If `packet-delivered` was ever durable it is in
    // the log; if the engine ever skipped it, this assertion is the
    // one that catches that regression (not a post-hoc snapshot read
    // that happens to land late).
    await page.waitForFunction(
      () =>
        window.__game?.getSnapshot?.().scene?.beat === "io-return-recognition",
      undefined,
      { timeout: WAIT_MS, polling: "raf" },
    );

    const beatLog = await page.evaluate(() => window.__sealedDeliveryBeatLog ?? []);
    const deliveredIdx = beatLog.indexOf("packet-delivered");
    const recognitionIdx = beatLog.indexOf("io-return-recognition");

    expect(
      deliveredIdx,
      `packet-delivered was never observed. Beat sequence: ${JSON.stringify(beatLog)}`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      recognitionIdx,
      `io-return-recognition was never observed. Beat sequence: ${JSON.stringify(beatLog)}`,
    ).toBeGreaterThanOrEqual(0);
    // Sequence pin: packet-delivered MUST precede io-return-recognition.
    expect(
      deliveredIdx,
      `packet-delivered must precede io-return-recognition. Beat sequence: ${JSON.stringify(beatLog)}`,
    ).toBeLessThan(recognitionIdx);

    const delivered = await page.evaluate(
      () => window.__game?.getSnapshot?.() ?? null,
    );
    expect(delivered?.delivery?.outcome).toBe("sealed");
  });
});
