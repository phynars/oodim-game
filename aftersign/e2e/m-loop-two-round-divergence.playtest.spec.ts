import { expect, test, type Locator, type Page } from "@playwright/test";

const WAIT_MS = 10_000;

type GameReadout = {
  scene: { ready: boolean; beat: string };
  packet: { delivered: boolean };
  delivery: { outcome: string };
  save: { revision: number; authority: string; dirty: boolean };
  npcs: { io: { memory: Array<{ kind: string; object: string }> } };
};

type DivergenceMemory = "fresh" | "completed" | "debt-held";

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

async function readOffers(
  page: Page,
  memory: DivergenceMemory,
): Promise<string[]> {
  await waitForBeat(page, "packet-offered");
  const tray = page.locator("#offeredJobs");
  await expect(tray).toBeVisible({ timeout: WAIT_MS });
  await expect(tray).toHaveAttribute("data-mloop-divergence-memory", memory);

  const offers = tray.locator("button[data-offered-job-id]:visible");
  await expect(offers.first()).toBeVisible({ timeout: WAIT_MS });
  const fingerprints = await offers.evaluateAll((buttons) =>
    buttons.map((button) => {
      const jobId = button.getAttribute("data-offered-job-id");
      const fingerprint = button.getAttribute("data-offer-fingerprint");
      return `${jobId}#${fingerprint?.split("#")[1]}`;
    }),
  );
  for (const offer of await offers.all()) {
    await expect(offer).toBeEnabled();
  }
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
  await page.locator(`[data-offered-job-id="${jobId}"]`).tap();
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
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    try {
      const stamp = `${Date.now()}-${testInfo.workerIndex}-${testInfo.retry}`;
      const cohorts = [
        { memory: "fresh" as const, slot: `m-loop-fresh-${stamp}`, facts: [], revision: 0,
          offers: ["job-safe-delivery#low"], job: "job-safe-delivery" },
        { memory: "completed" as const, slot: `m-loop-completed-${stamp}`, facts: [
          { id: "fact-delivery-outcome-seeded", kind: "delivery-outcome", subject: "io",
            object: "sealed", sessionId: "session-seeded" },
          { id: "fact-route-attention-seeded", kind: "route-attention", subject: "io",
            object: "done", sessionId: "session-seeded" },
        ], revision: 1,
          offers: ["job-night-transfer#medium", "job-signed-receipt#low"], job: "job-signed-receipt" },
      ];
      // Seed and verify BOTH independent records before any page boots. Prior
      // delivery facts persist, but the current packet starts undelivered.
      for (const cohort of cohorts) {
        const payload = {
          beat: "packet-offered",
          packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
          delivery: { outcome: "unknown" },
          player: { id: "local-slice-player", name: null, flags: { io_intro_seen: true } },
          memory: cohort.facts,
          save: { revision: cohort.revision },
        };
        const url = `/aftersign/save/local-slice-player/${encodeURIComponent(cohort.slot)}`;
        const saved = await page.request.put(url, { data: { payload } });
        expect(saved.ok(), `seed ${cohort.memory}`).toBe(true);
        const verified = await page.request.get(url);
        expect(verified.ok(), `read back ${cohort.memory}`).toBe(true);
        expect((await verified.json()).payload).toEqual(payload);
      }

      const boot = async (slot: string) => {
        await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
        await page.waitForFunction(
          () => (window as unknown as { __game?: GameReadout }).__game?.scene.ready === true,
          undefined,
          { timeout: WAIT_MS },
        );
      };
      // Compare rendered, enabled action IDs BEFORE either record is played;
      // different copy, fingerprints, or an in-memory branch alone cannot pass.
      const initialActionSets: string[][] = [];
      for (const cohort of cohorts) {
        await boot(cohort.slot);
        const offers = await readOffers(page, cohort.memory);
        expect(offers).toEqual(cohort.offers);
        initialActionSets.push(offers.map((offer) => offer.split("#")[0]));
      }
      expect(initialActionSets[0]).not.toEqual(initialActionSets[1]);

      for (const cohort of cohorts) {
        await test.step(`${cohort.memory}: two consecutive played rounds`, async () => {
          await boot(cohort.slot);
          expect(await readOffers(page, cohort.memory)).toEqual(cohort.offers);
          expect((await readGame(page)).save.revision).toBe(cohort.revision);
          // Complete round one, then park at the durably saved next-job beat.
          const firstRevision = await completeRound(page, cohort.job);
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
          const secondOffers = await readOffers(page, "completed");
          expect(secondOffers).toEqual([
            "job-night-transfer#medium",
            "job-signed-receipt#low",
          ]);

          // Complete round two; just exposing the returning offers is not enough.
          const secondRevision = await completeRound(page, "job-signed-receipt");
          expect(secondRevision).toBe(firstRevision + 1);
        });
      }
    } finally {
      await testInfo.attach("page-errors", {
        body: JSON.stringify(pageErrors, null, 2),
        contentType: "application/json",
      });
    }
  });
});
