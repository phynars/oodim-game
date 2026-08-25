import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN — memory-divergence phone playtest (#1384).
//
// Two players with DIVERGENT durable memories must be offered
// DIVERGENT job sets on the served page, played on a phone-sized
// viewport with taps only (no harness input, no forceReload):
//
//   NEW PLAYER (empty save — nothing in localStorage)
//     boots at `packet-offered` with `npcs.io.memory === []`
//     → `computeOfferedJobs(undefined)` → `[job-safe-delivery]`.
//
//   TRUSTED COURIER (seeded save — delivered packet + durable
//   delivery-outcome / route-attention memory facts)
//     boots at `packet-offered` with `npcs.io.memory.length > 0`
//     → `computeOfferedJobs({ priorOutcome: "completed" })`
//     → `[job-night-transfer, job-signed-receipt]`.
//
// Seeding uses the SAME persisted-save shape `buildPersistPayload`
// writes (aftersign/src/runtime/persistence.js) under the SAME key
// main.js reads (`aftersign:kiosk-slice:<slot>`), so the seeded save
// exercises the real boot-restore path — not a harness backdoor.
// Each divergent state is then PLAYED one full delivery round via
// real taps to prove the offered surface is playable, not just
// rendered. `window.__game.getSnapshot()` is consulted as a MIRROR
// only (secondary assertions); the primary assertions are on the
// served DOM (`[data-job-id]` sets).
//
// Selectors match the shipped surface (aftersign/main.js renderText):
//   - `[data-beat-id="<id>"]` for story-beat arrival
//   - `#packetButton` for the packet tap at `packet-offered`
//   - `button[data-choice-id="<id>"]` for choice buttons
//   - `#offeredJobs [data-job-id]` for the computeOfferedJobs render
//
// COLD-START BUDGET (why WAIT_MS is 60s and the test timeout 180s):
// this lane boots three.js under SwiftShader's software renderer.
// Sibling specs (io-recognition-memory-beat-contract.spec.ts header)
// document that first-WebGL-context init can exceed Playwright's 30s
// default on cold CI runners — the 10s waits in the first draft of
// this spec were the lane's red: `waitForReady` raced the deferred
// module boot and timed out before `scene.ready` ever flipped. Same
// numbers as the sibling contract specs: 60s per wait, wide test
// budget for the two full boot cycles this spec performs (this spec
// navigates twice — two SwiftShader cold boots in one test).
const WAIT_MS = 60_000;
const PLAYTEST_TIMEOUT_MS = 180_000;

// Phone-sized viewport — the divergence must hold on the mobile
// surface the slice is tuned for (44px tap targets, movePad, etc.).
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

async function collectOfferedJobIds(page: Page): Promise<string[]> {
  // Wait until at least one offer is stamped so we never race the
  // first renderText() pass at packet-offered.
  await expect(
    page.locator("#offeredJobs [data-job-id]").first(),
    "at least one offered job should render at packet-offered",
  ).toBeVisible({ timeout: WAIT_MS });
  const ids = await page
    .locator("#offeredJobs [data-job-id]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-job-id") ?? ""),
    );
  return [...ids].sort();
}

async function snapshotIoMemoryCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const game = (window as unknown as {
      __game?: { getSnapshot?: () => { npcs: { io: { memories: unknown[] } } } };
    }).__game;
    const snapshot = game?.getSnapshot?.();
    return snapshot ? snapshot.npcs.io.memories.length : -1;
  });
}

// One played delivery round, taps only: packet tap at packet-offered
// → route fork → deliver → the recognition beat lands. Proves the
// divergent boot state is PLAYABLE, not just rendered.
//
// The packet tap is a plain `.click()` — the exact drive the merged,
// green sibling `job-offers-played.spec.ts` uses on `#packetButton`
// at this same beat; a quick tap commits the sealed outcome and
// advances to `packet-choice`.
async function playOneDeliveryRound(page: Page): Promise<void> {
  const packetButton = page.locator("#packetButton");
  await expect(
    packetButton,
    "packet button should be visible at packet-offered",
  ).toBeVisible({ timeout: WAIT_MS });
  await packetButton.click();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
}

// Trusted-courier seed: the exact persisted shape
// `buildPersistPayload` writes (aftersign/src/runtime/persistence.js)
// — a completed sealed delivery with both durable memory facts
// recorded. `memory.length > 0` is the career signal renderText's
// packet-offered block maps to `{ priorOutcome: "completed" }`
// (main.js: `state.npcs.io.memory.length > 0 → priorOutcome:
// "completed"`). Memory-fact shapes match the builders in
// aftersign/src/memoryFacts.js (buildPacketOutcomeMemoryFact /
// buildSecondActionMemoryFact): delivery-outcome carries the packet
// outcome, route-attention carries the second action.
const trustedCourierSave = {
  beat: "packet-offered",
  player: {
    id: "local-slice-player",
    name: null,
    flags: { io_intro_seen: true },
    x: -1.8,
    z: 1.15,
    facingRadians: Math.PI,
    secondAction: "done",
    returnReason: null,
    routeRisk: null,
  },
  packet: {
    delivered: true,
    route: "blue rainline",
    sealed: true,
    deliveredAt: "2026-01-01T00:00:00.000Z",
  },
  delivery: { id: "blue-packet", outcome: "sealed" },
  memory: [
    {
      kind: "delivery-outcome",
      subject: "io",
      object: "sealed",
      sessionId: "seeded-trusted-courier",
    },
    {
      kind: "route-attention",
      subject: "io",
      object: "done",
      sessionId: "seeded-trusted-courier",
    },
  ],
  npcs: {
    orra: {
      memory: [],
      lastLine: null,
      lastLineId: null,
      lastLineMemoryRefs: [],
    },
  },
  save: { revision: 2, dirty: false },
};

test.describe("AFTERSIGN memory divergence — phone playtest (#1384)", () => {
  test("divergent memories offer divergent job sets, both playable by taps", async ({ page }) => {
    test.setTimeout(PLAYTEST_TIMEOUT_MS);

    const runId = Date.now();
    const newPlayerSlot = `memory-div-fresh-${runId}`;
    const trustedSlot = `memory-div-trusted-${runId}`;

    // Seed ONLY the trusted-courier slot's key. The init script runs
    // on every navigation, but the new-player slot's key is never
    // written, so the first visit boots genuinely empty.
    await page.addInitScript(
      ({ key, payload }) => {
        window.localStorage.setItem(key, JSON.stringify(payload));
      },
      {
        key: `aftersign:kiosk-slice:${trustedSlot}`,
        payload: trustedCourierSave,
      },
    );

    // ─────────────────────────────────────────────────────────────
    // ROUND 1 — NEW PLAYER: empty memory boots to the safe default.
    // ─────────────────────────────────────────────────────────────
    await page.goto(`/aftersign/?slot=${newPlayerSlot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    const newPlayerJobIds = await collectOfferedJobIds(page);
    expect(
      newPlayerJobIds,
      "empty-memory boot must offer exactly the safe default",
    ).toEqual(["job-safe-delivery"]);

    // Snapshot mirror only: the DOM assertion above is primary.
    expect(
      await snapshotIoMemoryCount(page),
      "snapshot mirror: new player has no durable memory facts",
    ).toBe(0);

    await playOneDeliveryRound(page);

    // ─────────────────────────────────────────────────────────────
    // ROUND 2 — TRUSTED COURIER: seeded durable memory boots to the
    // completed set. Same page, different slot, real boot restore.
    // ─────────────────────────────────────────────────────────────
    await page.goto(`/aftersign/?slot=${trustedSlot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    const trustedJobIds = await collectOfferedJobIds(page);
    expect(
      trustedJobIds,
      "trusted-courier boot must offer the completed set",
    ).toEqual(["job-night-transfer", "job-signed-receipt"]);
    expect(
      trustedJobIds,
      "the safe default must not leak into the completed set",
    ).not.toContain("job-safe-delivery");

    // THE divergence assertion (#1384): two memories, two job sets.
    expect(
      JSON.stringify(trustedJobIds),
      "divergent memories must produce divergent offered-job sets",
    ).not.toEqual(JSON.stringify(newPlayerJobIds));

    // Snapshot mirror only.
    expect(
      await snapshotIoMemoryCount(page),
      "snapshot mirror: trusted courier carries durable memory facts",
    ).toBeGreaterThan(0);

    // The divergent boot state must also be PLAYABLE by taps.
    await playOneDeliveryRound(page);
  });
});
