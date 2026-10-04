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

type DialogueEntry = { beat: string; speaker: string; line: string };

// Every beat the gate reaches is a visible dialogue transition the founder
// bar requires to be ASSERTED ("the standing phone PLAYTEST ... asserting
// every visible dialogue transition"), not just stamped. The HUD's
// #speaker/#line pair is what a phone player reads and aria-live announces.
const transcript: DialogueEntry[] = [];

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
  const speaker = page.locator("#speaker");
  const line = page.locator("#line");
  await expect(speaker).toBeVisible({ timeout: WAIT_MS });
  await expect(line).toBeVisible({ timeout: WAIT_MS });
  await expect(line, `dialogue line at ${beat}`).not.toHaveText(/^\s*$/, { timeout: WAIT_MS });
  transcript.push({
    beat,
    speaker: (await speaker.innerText()).trim(),
    line: (await line.innerText()).trim(),
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
      // Per-run player id (served-mode safe). On localhost `resolvePlayerId`
      // would return the fixed `local-slice-player`, but on game.oodim.com
      // it mints a random UUID — so the spec MUST pass `?player=` and seed
      // under the same id, or the boot reads an empty slot and the
      // divergence memory assertion fails. The id must match
      // PLAYER_ID_PATTERN (`^[A-Za-z0-9_-]{1,64}$`); the stamp is already
      // in that alphabet.
      const playerId = `m-loop-${stamp}`;
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
      // Seeds are written under the per-run `playerId`, not the shared
      // `local-slice-player` namespace, so served-mode runs don't pollute
      // prod's shared id.
      for (const cohort of cohorts) {
        const payload = {
          beat: "packet-offered",
          packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
          delivery: { outcome: "unknown" },
          player: { id: playerId, name: null, flags: { io_intro_seen: true } },
          memory: cohort.facts,
          save: { revision: cohort.revision },
        };
        const url = `/aftersign/save/${encodeURIComponent(playerId)}/${encodeURIComponent(cohort.slot)}`;
        const saved = await page.request.put(url, { data: { payload } });
        expect(saved.ok(), `seed ${cohort.memory}`).toBe(true);
        const verified = await page.request.get(url);
        expect(verified.ok(), `read back ${cohort.memory}`).toBe(true);
        expect((await verified.json()).payload).toEqual(payload);
      }

      const boot = async (slot: string) => {
        // `?player=` resolves BEFORE the local-dev hostname branch in
        // `resolvePlayerId`, so this works identically on localhost and
        // on game.oodim.com — no server-mode / localhost split.
        await page.goto(
          `/aftersign/?slot=${slot}&player=${encodeURIComponent(playerId)}`,
          { waitUntil: "load" },
        );
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

      // #2158: memory must show in Io's WORDS too, not only in the buttons —
      // the offer line differs per record and names the offered jobs by the
      // labels on the buttons the player can tap.
      const offerLines = new Map<string, string>();

      for (const cohort of cohorts) {
        await test.step(`${cohort.memory}: two consecutive played rounds`, async () => {
          await boot(cohort.slot);
          expect(await readOffers(page, cohort.memory)).toEqual(cohort.offers);
          expect((await readGame(page)).save.revision).toBe(cohort.revision);
          const roundOneLine = (await page.locator("#line").innerText()).trim();
          offerLines.set(cohort.memory, roundOneLine);
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
          const roundTwoLine = page.locator("#line");
          await expect(roundTwoLine, "round 2 offer line names the unlocked jobs").toContainText("Night transfer");
          await expect(roundTwoLine).toContainText("Signed receipt");
          expect(
            (await roundTwoLine.innerText()).trim(),
            `${cohort.memory}: round 2's offer line must differ from round 1's`,
          ).not.toBe(roundOneLine);

          // Complete round two; just exposing the returning offers is not enough.
          const secondRevision = await completeRound(page, "job-signed-receipt");
          expect(secondRevision).toBe(firstRevision + 1);
        });
      }

      const [freshLine, completedLine] = [offerLines.get("fresh"), offerLines.get("completed")];
      expect(completedLine, "Io's offer line differs by memory").not.toBe(freshLine);
      expect(completedLine).toContain("Night transfer");
      expect(completedLine).toContain("Signed receipt");

      // Each beat ADVANCE must change what the player reads; a re-read of
      // the same beat (initial offer comparison, reload restore) may repeat.
      for (let i = 1; i < transcript.length; i += 1) {
        const [prev, cur] = [transcript[i - 1], transcript[i]];
        if (prev.beat === cur.beat) continue;
        expect(cur.line, `dialogue must change ${prev.beat} → ${cur.beat}`).not.toBe(prev.line);
      }
    } finally {
      await testInfo.attach("dialogue-transcript", {
        body: JSON.stringify(transcript, null, 2),
        contentType: "application/json",
      });
      await testInfo.attach("page-errors", {
        body: JSON.stringify(pageErrors, null, 2),
        contentType: "application/json",
      });
    }
  });
});
