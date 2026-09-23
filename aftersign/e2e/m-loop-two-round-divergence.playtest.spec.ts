import { expect, test, type Locator, type Page } from "@playwright/test";

const WAIT_MS = 10_000;

type GameReadout = {
  scene: { ready: boolean; beat: string };
  packet: { delivered: boolean };
  delivery: { outcome: string };
  save: { revision: number; authority: string; dirty: boolean };
  npcs: { io: { memory: Array<{ kind: string; object: string }> } };
};

async function readGame(page: Page): Promise<GameReadout> {
  return page.evaluate(() =>
    (window as unknown as { __game: GameReadout }).__game,
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, id: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${id}"]`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await expect(choice).toBeEnabled({ timeout: WAIT_MS });
  await choice.tap();
}

async function tapAndWaitForSave(
  page: Page,
  control: Locator,
  beat: string,
): Promise<void> {
  // A prior save can already report dirty=false. Wait for the response
  // belonging to THIS tap's payload before allowing another save or reload.
  const [response] = await Promise.all([
    page.waitForResponse((response) => {
      const request = response.request();
      return request.method() === "PUT"
        && new URL(response.url()).pathname.startsWith("/aftersign/save/")
        && request.postDataJSON()?.payload?.beat === beat;
    }, { timeout: WAIT_MS }),
    control.tap(),
  ]);
  expect(response.ok(), `save at ${beat} must succeed`).toBe(true);
}

async function readOffers(page: Page): Promise<string[]> {
  await waitForBeat(page, "packet-offered");
  const offers = page.locator('button[id^="job-offer-"]:visible');
  await expect(offers.first()).toBeVisible({ timeout: WAIT_MS });
  const fingerprints = await offers.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("data-offer-fingerprint")),
  );
  for (const fingerprint of fingerprints) {
    expect(fingerprint).toMatch(/^job-[a-z0-9-]+#(?:low|medium|high)$/);
  }
  expect(new Set(fingerprints).size).toBe(fingerprints.length);
  return (fingerprints as string[]).sort();
}

// Offer taps select a job; they do not deliver it or remove other offers.
// Complete each round through the packet and route controls instead.
async function completeRound(page: Page, jobId: string): Promise<number> {
  const before = await readGame(page);
  expect(before.packet.delivered).toBe(false);
  await page.locator(`#job-offer-${jobId}`).tap();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapAndWaitForSave(
    page,
    page.locator('button[data-choice-id="deliver-packet"]').first(),
    "packet-delivered",
  );
  await waitForBeat(page, "io-return-recognition");
  await expect.poll(async () => {
    const game = await readGame(page);
    return {
      delivered: game.packet.delivered,
      outcome: game.delivery.outcome,
      revision: game.save.revision,
      remembered: game.npcs.io.memory.some(
        (fact) => fact.kind === "delivery-outcome" && fact.object === "sealed",
      ),
    };
  }, { timeout: WAIT_MS }).toEqual({
    delivered: true,
    outcome: "sealed",
    revision: before.save.revision + 1,
    remembered: true,
  });
  return before.save.revision + 1;
}

test.describe("AFTERSIGN M-LOOP two-round divergence", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("two durable memory records expose different tappable actions across two played rounds", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    try {
      const slot = `m-loop-two-round-${Date.now()}-${testInfo.workerIndex}-${testInfo.retry}`;
      await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await page.waitForFunction(
        () => (window as unknown as { __game?: GameReadout }).__game?.scene.ready === true,
        undefined,
        { timeout: WAIT_MS },
      );
      const firstOffers = await readOffers(page);
      expect(firstOffers).toEqual(["job-safe-delivery#low"]);

      // Complete round one, then park at the durably saved next-job beat.
      const firstRevision = await completeRound(page, "job-safe-delivery");
      await tapAndWaitForSave(
        page,
        page.locator('button[data-return-reason="blunt"]'),
        "return-tone-choice",
      );
      await waitForBeat(page, "return-tone-choice");
      await tapAndWaitForSave(
        page,
        page.locator('button[data-choice-id="ask-for-next-job"]').first(),
        "io-next-job",
      );
      await waitForBeat(page, "io-next-job");
      await expect.poll(async () => {
        const game = await readGame(page);
        return { authority: game.save.authority, dirty: game.save.dirty };
      }, { timeout: WAIT_MS }).toEqual({ authority: "server", dirty: false });

      // Reload the SAME slot: memory must survive the server round-trip,
      // not merely remain in the previous page's in-memory state.
      await page.reload({ waitUntil: "load" });
      await waitForBeat(page, "io-next-job");
      const restored = await readGame(page);
      expect(restored.save.revision).toBe(firstRevision);
      expect(restored.npcs.io.memory).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "delivery-outcome", object: "sealed" }),
      ]));
      await tapChoice(page, "deliver-packet");
      const secondOffers = await readOffers(page);
      expect(secondOffers).toEqual([
        "job-night-transfer#medium",
        "job-signed-receipt#low",
      ]);
      expect(secondOffers).not.toEqual(firstOffers);

      // Complete round two; just exposing the returning offers is not enough.
      const secondRevision = await completeRound(page, "job-signed-receipt");
      expect(secondRevision).toBe(firstRevision + 1);
    } finally {
      await testInfo.attach("page-errors", {
        body: JSON.stringify(pageErrors, null, 2),
        contentType: "application/json",
      });
    }
  });
});
