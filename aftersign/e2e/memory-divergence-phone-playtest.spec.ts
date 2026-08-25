import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN — memory-divergence phone playtest (#1384).
//
// Two save slots with DIVERGENT durable memory, played tap-only on a
// phone viewport (375×812), must offer DIFFERENT job sets at the
// `packet-offered` beat:
//
//   SLOT A (empty memory, no prior delivery)
//     `computeOfferedJobs(undefined)` → `["job-safe-delivery"]`
//     → only `#job-offer-job-safe-delivery` renders.
//
//   SLOT B (completed prior delivery: `packet.delivered === true`,
//     durable delivery-outcome + route-attention facts in memory)
//     `computeOfferedJobs({ priorOutcome: "completed" })` →
//     `["job-night-transfer", "job-signed-receipt"]`
//     → both completed-set buttons render; the safe default is absent.
//
// Divergence is seeded through the REAL persistence lane: each slot's
// payload is written into `localStorage` under the exact key
// `aftersign/main.js` reads at boot (`aftersign:kiosk-slice:<slot>`),
// via `page.addInitScript` BEFORE navigation — no harness setters, no
// `forceReload`. The offered-set signal is the career-level
// `state.npcs.io.memory.length > 0` check in renderText() (Soren's
// review on PR #1396), which boot hydrates from the payload's
// top-level `memory` array.
//
// Each slot then plays a tap-only interaction on the phone viewport
// (packet tap → the offer surface clears off-beat), and slot A plays
// a full first round through delivery to the recognition beat —
// proving the divergent surfaces are PLAYABLE at phone size, not just
// rendered.
//
// Selectors match the shipped surface (`aftersign/main.js` renderText's
// computeOfferedJobs block + `playerVisibleBeatDom.js`):
//   - `[data-beat-id="<id>"]`         story-beat arrival gate
//   - `#packetButton`                 packet tap at packet-offered
//   - `button[data-choice-id="<id>"]` choice buttons
//   - `#job-offer-<jobId>` / `[data-job-id]` the offered-job buttons

const WAIT_MS = 10_000;
const COLD_START_MS = 60_000;

const STORAGE_PREFIX = "aftersign:kiosk-slice:";

// Phone playtest: iPhone-class portrait viewport. Every interaction in
// this spec is a tap on the served DOM at this size.
test.use({ viewport: { width: 375, height: 812 } });

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should visibly reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(
    choice,
    `choice "${choiceId}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `return-tone "${reason}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

/** Read the offered-job id set stamped on the served #offeredJobs tray. */
async function offeredJobIds(page: Page): Promise<string[]> {
  return page
    .locator("#offeredJobs [data-job-id]")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute("data-job-id") ?? "")
        .filter((id) => id.length > 0)
        .sort(),
    );
}

/** Durable memory-fact count as the served snapshot reports it. */
async function snapshotMemoryCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const game = (window as unknown as {
      __game?: { getSnapshot?: () => { npcs?: { io?: { memories?: unknown[] } } } };
    }).__game;
    return game?.getSnapshot?.().npcs?.io?.memories?.length ?? -1;
  });
}

// Payload shapes mirror what `buildPersistPayload` writes and boot in
// `aftersign/main.js` reads back: top-level `beat`, `packet`,
// `delivery`, `player`, `memory` (Io's durable facts), `save`.
const EMPTY_MEMORY_SAVE = {
  beat: "packet-offered",
  packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
  delivery: { outcome: "unknown" },
  player: { id: "local-slice-player", name: null, flags: { io_intro_seen: true } },
  memory: [],
  save: { revision: 0 },
};

const COMPLETED_MEMORY_SAVE = {
  beat: "packet-offered",
  packet: {
    delivered: true,
    route: "blue rainline",
    sealed: true,
    deliveredAt: "2026-01-01T00:00:00.000Z",
  },
  delivery: { outcome: "sealed" },
  player: { id: "local-slice-player", name: null, flags: { io_intro_seen: true } },
  memory: [
    {
      id: "fact-delivery-outcome-seeded",
      kind: "delivery-outcome",
      subject: "io",
      object: "sealed",
      sessionId: "session-seeded",
    },
    {
      id: "fact-route-attention-seeded",
      kind: "route-attention",
      subject: "io",
      object: "done",
      sessionId: "session-seeded",
    },
  ],
  save: { revision: 1 },
};

test.describe("AFTERSIGN memory divergence — phone playtest", () => {
  test("divergent saved memories offer divergent job sets, tap-playable at phone size", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const stamp = Date.now();
    const slotA = `memdiv-empty-${stamp}`;
    const slotB = `memdiv-completed-${stamp}`;

    // Seed BOTH divergent saves before any navigation — the keys are
    // slot-scoped so the two payloads cannot interfere.
    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
      },
      { key: `${STORAGE_PREFIX}${slotA}`, value: JSON.stringify(EMPTY_MEMORY_SAVE) },
    );
    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
      },
      { key: `${STORAGE_PREFIX}${slotB}`, value: JSON.stringify(COMPLETED_MEMORY_SAVE) },
    );

    // ─────────────────────────────────────────────────────────────
    // SLOT A — empty memory. The safe-default job is the only offer.
    // ─────────────────────────────────────────────────────────────
    await page.goto(`/aftersign/?slot=${slotA}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    await expect(
      page.locator("#job-offer-job-safe-delivery"),
      "empty-memory slot should offer the safe default",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.locator("#job-offer-job-night-transfer"),
      "completed-set offer must NOT render for an empty-memory save",
    ).toHaveCount(0);
    await expect(
      page.locator("#job-offer-job-signed-receipt"),
      "completed-set offer must NOT render for an empty-memory save",
    ).toHaveCount(0);

    const idsA = await offeredJobIds(page);
    expect(idsA, "empty-memory offer set").toEqual(["job-safe-delivery"]);
    expect(
      await snapshotMemoryCount(page),
      "snapshot should mirror the seeded EMPTY memory",
    ).toBe(0);

    // Tap-only round at phone size: packet tap → route ack → deliver
    // → recognition beat. Proves the empty-memory lane is playable,
    // and that the offer surface clears once the opening beat ends.
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");
    await expect(
      page.locator('[id^="job-offer-"]'),
      "job-offer buttons must not persist past the packet-offered beat",
    ).toHaveCount(0, { timeout: WAIT_MS });

    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await tapReturnReason(page, "kind");
    await waitForBeat(page, "return-tone-choice");

    // ─────────────────────────────────────────────────────────────
    // SLOT B — completed prior delivery in durable memory. The
    // completed set renders; the safe default is gone.
    // ─────────────────────────────────────────────────────────────
    await page.goto(`/aftersign/?slot=${slotB}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    await expect(
      page.locator("#job-offer-job-night-transfer"),
      "completed-memory slot should offer night-transfer",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.locator("#job-offer-job-signed-receipt"),
      "completed-memory slot should offer signed-receipt",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.locator("#job-offer-job-safe-delivery"),
      "safe-default offer must NOT render for a completed-memory save",
    ).toHaveCount(0);

    const idsB = await offeredJobIds(page);
    expect(idsB, "completed-memory offer set").toEqual([
      "job-night-transfer",
      "job-signed-receipt",
    ]);
    expect(
      await snapshotMemoryCount(page),
      "snapshot should mirror the seeded COMPLETED memory",
    ).toBeGreaterThan(0);

    // THE divergence assertion: the two slots' offered id-sets differ.
    expect(idsB, "divergent saves must offer divergent job sets").not.toEqual(idsA);
    expect(idsB).not.toContain("job-safe-delivery");

    // Tap-only playability at phone size on the divergent lane too:
    // the packet tap advances the beat and clears the offer tray.
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");
    await expect(
      page.locator('[id^="job-offer-"]'),
      "job-offer buttons must not persist past the packet-offered beat",
    ).toHaveCount(0, { timeout: WAIT_MS });
  });
});
