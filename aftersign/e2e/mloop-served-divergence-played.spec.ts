import { expect, test, type Browser, type Page } from "@playwright/test";

// AFTERSIGN — served M-LOOP divergence memory, played tap-only.
//
// PR #1934 re-review (Soren Vask). The BRIEF amendment landed by that PR
// mandates:
//
//   "At `packet-offered`, the served `#offeredJobs` tray derives its action
//    set from durable Io memory. It stamps `data-mloop-divergence-memory`
//    as `fresh`, `completed`, or `debt-held`; the tray's
//    `button[data-offered-job-id]` children are the visible, tappable
//    evidence of that branch. […] A phone-viewport Playwright spec must
//    tap these rendered buttons for each seeded record; reading a harness
//    input surface is not acceptance evidence."
//
// This spec is the acceptance evidence. It seeds two divergent authoritative
// saves through the SAME `/aftersign/save` PUT endpoint the sibling
// `m-loop-divergent-offered-actions.playtest.spec.ts` uses (so the boot
// path is the shipped one), boots each at phone viewport, and:
//
//   1. Reads `data-mloop-divergence-memory` off the RENDERED `#offeredJobs`
//      tray — the exact attribute `aftersign/main.js` stamps via
//      `servedMloopDivergenceKey(offeredJobsMemory)`. This is the CONSUMER
//      the reviewer flagged as missing.
//   2. Real-taps a visible `button[data-offered-job-id]` child of the tray
//      on EACH seeded record — no `window.__game.input.*` reach-in, the
//      tap lands as a real touch event on the same DOM node the shipped
//      renderer decorates.
//   3. Asserts the two records produce DIFFERENT `data-mloop-divergence-memory`
//      values AND different tapped offer ids — the "durable-memory branch
//      selects the visible actions" contract the BRIEF names.
//
// The unit test at
// `apps/web/src/aftersign/servedMloopDivergenceKey.test.ts` pins the three
// return values of the helper this attribute rides on; if the label
// vocabulary shifts, THAT reds first and this spec reds second (both
// surfaces move together).

type DivergenceMemoryLabel = "fresh" | "completed" | "debt-held";

type SeededRecord = {
  label: string;
  slotSuffix: string;
  save: Record<string, unknown>;
  expectedDivergenceMemory: DivergenceMemoryLabel;
};

// SwiftShader can spend more than 10s compiling the cold WebGL boot path.
// Mirrors the sibling `m-loop-divergent-offered-actions.playtest.spec.ts`
// budget shape — this lane retries 3× in CI, so a spurious cold boot
// still self-heals.
const WAIT_MS = 30_000;
const COLD_START_MS = 90_000;
const BOOTSTRAP_PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";
const PHONE_VIEWPORT = { width: 390, height: 844 };

const FRESH_SAVE: Record<string, unknown> = {
  beat: "packet-offered",
  packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
  delivery: { outcome: "unknown" },
  player: {
    id: "mloop-served-divergence-fresh-player",
    name: null,
    flags: { io_intro_seen: true },
  },
  memory: [],
  save: { revision: 0 },
};

// One `delivery-outcome` fact with `object: "sealed"` — the SAME shape the
// sibling divergent-offered-actions spec uses. `offeredJobsMemoryFromIoMemory`
// maps this to `{ priorOutcome: "completed" }`, and `servedMloopDivergenceKey`
// then stamps `completed` on the tray.
const COMPLETED_MEMORY = [
  {
    id: "fact-delivery-outcome-seeded",
    kind: "delivery-outcome",
    subject: "io",
    object: "sealed",
    sessionId: "session-mloop-served-divergence-completed",
  },
  {
    id: "fact-route-attention-seeded",
    kind: "route-attention",
    subject: "io",
    object: "done",
    sessionId: "session-mloop-served-divergence-completed",
  },
];

const COMPLETED_SAVE: Record<string, unknown> = {
  beat: "packet-offered",
  packet: { delivered: true, route: "blue rainline", sealed: true, deliveredAt: "2026-01-01T00:00:00.000Z" },
  delivery: { outcome: "sealed" },
  player: {
    id: "mloop-served-divergence-completed-player",
    name: null,
    flags: { io_intro_seen: true },
  },
  memory: COMPLETED_MEMORY,
  save: { revision: 1 },
};

// One `delivery-outcome` fact with `object: "opened"` and NO sealed
// delivery — the SAME shape the sibling
// `aftersign/e2e/job-offer-debt-held-played.spec.ts` mints by holding
// the packet open at the first loop. `offeredJobsMemoryFromIoMemory`
// (aftersign/src/offeredJobsMemoryFromIoMemory.js) maps this to
// `{ debtHeld: 1 }` because the sealed count is zero and the opened
// count is one, and `servedMloopDivergenceKey` then stamps `debt-held`
// on the tray. The matching render surface
// (`aftersign/e2e/job-offer-debt-held-played.spec.ts`) tapped the
// rendered `#job-offer-job-wax-debt-repair` button; here the SAME
// durable-memory posture is reached by SEEDING the opened fact into
// the authoritative save (no need to replay the hold gesture — the
// save endpoint is the shipped boot path), and we tap the first
// visible `button[data-offered-job-id]` child of `#offeredJobs` so
// the third branch of `servedMloopDivergenceKey` carries its own
// tappable evidence inside THIS spec.
const DEBT_HELD_MEMORY = [
  {
    id: "fact-delivery-outcome-opened-seeded",
    kind: "delivery-outcome",
    subject: "io",
    object: "opened",
    sessionId: "session-mloop-served-divergence-debt-held",
  },
  {
    id: "fact-route-attention-opened-seeded",
    kind: "route-attention",
    subject: "io",
    object: "done",
    sessionId: "session-mloop-served-divergence-debt-held",
  },
];

const DEBT_HELD_SAVE: Record<string, unknown> = {
  beat: "packet-offered",
  packet: { delivered: true, route: "blue rainline", sealed: false, deliveredAt: "2026-01-01T00:00:00.000Z" },
  delivery: { outcome: "opened" },
  player: {
    id: "mloop-served-divergence-debt-held-player",
    name: null,
    flags: { io_intro_seen: true },
  },
  memory: DEBT_HELD_MEMORY,
  save: { revision: 1 },
};

declare global {
  interface Window {
    __game?: {
      scene?: { ready?: boolean };
    };
  }
}

async function newPhoneContext(browser: Browser) {
  return browser.newContext({
    viewport: PHONE_VIEWPORT,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
}

function uniqueSlotSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

type PlayedRecord = {
  page: Page;
  context: Awaited<ReturnType<typeof newPhoneContext>>;
  divergenceMemory: string;
  tappedOfferId: string;
};

async function playSeededRecord(
  browser: Browser,
  record: SeededRecord,
): Promise<PlayedRecord> {
  const slot = `mloop-served-divergence-${record.slotSuffix}`;
  const context = await newPhoneContext(browser);
  const page = await context.newPage();
  const bootConsoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && msg.text().includes("[aftersign boot]")) {
      bootConsoleErrors.push(msg.text());
    }
  });

  // Seed the authoritative save through the SHIPPED PUT endpoint the
  // boot path reads (mirrors the sibling divergent-offered-actions
  // spec). No `input.choose`, no `__game` reach-in — the save lands
  // on the server and the served boot reads it.
  const endpoint = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(BOOTSTRAP_PLAYER_ID)}/${encodeURIComponent(slot)}`;
  const seedResponse = await page.request.put(endpoint, {
    data: { payload: record.save },
    headers: { "content-type": "application/json" },
  });
  expect(
    seedResponse.ok(),
    `${record.label}: seed PUT for slot ${slot} must succeed (HTTP ${seedResponse.status()})`,
  ).toBe(true);

  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);
  expect(
    bootConsoleErrors,
    `${record.label}: boot must not log an [aftersign boot] readAuthoritativeSave failure`,
  ).toEqual([]);

  await expect(
    page.locator('[data-beat-id="packet-offered"]'),
    `${record.label}: seeded save should boot at the packet-offered beat`,
  ).toBeVisible({ timeout: WAIT_MS });

  const offeredTray = page.locator("#offeredJobs");
  await expect(offeredTray, `${record.label}: #offeredJobs tray should render`).toBeVisible({
    timeout: WAIT_MS,
  });

  // (1) READ the presentation attribute the served renderer stamps on
  //     the tray — the exact `data-mloop-divergence-memory` value the
  //     BRIEF names. This is the CONSUMER the reviewer flagged as
  //     missing. If `aftersign/main.js` stops calling
  //     `servedMloopDivergenceKey`, this attribute goes missing and
  //     the assertion below reds.
  const divergenceMemory =
    (await offeredTray.getAttribute("data-mloop-divergence-memory")) ?? "";
  expect(
    divergenceMemory,
    `${record.label}: #offeredJobs must carry data-mloop-divergence-memory (the served M-LOOP divergence branch label — presentation-safe stamp of the durable-memory posture the tray was derived from)`,
  ).toBe(record.expectedDivergenceMemory);

  // (2) Real-tap a visible `button[data-offered-job-id]` child of the
  //     tray — the tappable evidence of the branch. Mirrors the
  //     sibling spec's tap discipline: touch the actual rendered
  //     DOM node the shipped renderer decorates, no
  //     `window.__game.input.*` reach-in.
  const tappable = offeredTray.locator("button[data-offered-job-id]").first();
  await expect(
    tappable,
    `${record.label}: at least one button[data-offered-job-id] must render inside #offeredJobs (visible tappable evidence of the branch)`,
  ).toBeVisible({ timeout: WAIT_MS });
  const tappedOfferId = (await tappable.getAttribute("data-offered-job-id")) ?? "";
  expect(
    tappedOfferId,
    `${record.label}: the tapped offered-job button must expose its offer id via data-offered-job-id`,
  ).not.toBe("");
  await tappable.tap();

  return { page, context, divergenceMemory, tappedOfferId };
}

const SEEDED_RECORDS: readonly SeededRecord[] = [
  {
    label: "fresh save",
    slotSuffix: `fresh-${uniqueSlotSuffix()}`,
    save: FRESH_SAVE,
    expectedDivergenceMemory: "fresh",
  },
  {
    label: "completed save",
    slotSuffix: `completed-${uniqueSlotSuffix()}`,
    save: COMPLETED_SAVE,
    expectedDivergenceMemory: "completed",
  },
  {
    label: "debt-held save",
    slotSuffix: `debt-held-${uniqueSlotSuffix()}`,
    save: DEBT_HELD_SAVE,
    expectedDivergenceMemory: "debt-held",
  },
];

test.describe("AFTERSIGN M-LOOP served divergence memory — phone-viewport, tap-driven", () => {
  test("three divergent authoritative saves (fresh / completed / debt-held) stamp three DIFFERENT `data-mloop-divergence-memory` values on #offeredJobs and each renders a real, tappable button[data-offered-job-id]", async ({
    browser,
  }) => {
    test.setTimeout(COLD_START_MS);
    const played: PlayedRecord[] = [];
    try {
      for (const record of SEEDED_RECORDS) {
        played.push(await playSeededRecord(browser, record));
      }

      // Each record rendered its own tappable offered button and
      // exposed the branch label the durable-memory posture selected.
      // Pairwise divergence check: NO two records may collapse into
      // the same tray-level branch label. This covers all three
      // branches `servedMloopDivergenceKey` returns (fresh / completed
      // / debt-held) — the unit test at
      // `apps/web/src/aftersign/servedMloopDivergenceKey.test.ts` pins
      // the vocabulary; this spec is the rendered proof that each
      // branch reaches the DOM.
      for (let i = 0; i < played.length; i += 1) {
        for (let j = i + 1; j < played.length; j += 1) {
          const a = played[i];
          const b = played[j];
          const aLabel = SEEDED_RECORDS[i].label;
          const bLabel = SEEDED_RECORDS[j].label;
          expect(
            b.divergenceMemory,
            `${aLabel} and ${bLabel} must stamp DIFFERENT data-mloop-divergence-memory values on #offeredJobs (the whole point of the served divergence contract — if two saves stamp the same label, that branch is dead)`,
          ).not.toBe(a.divergenceMemory);

          // And the visible tappable evidence must diverge too — no
          // two records may resolve to the SAME first offered-job id.
          // (If they do, the branch label is stamped but the action
          // tray itself doesn't actually diverge, which is the same
          // failure shape the sibling
          // `m-loop-divergent-offered-actions.playtest.spec.ts` pins —
          // kept independent here so this spec fails specifically when
          // the tray-stamp regresses vs. when the primitive regresses.)
          expect(
            b.tappedOfferId,
            `${aLabel} and ${bLabel} must render DIFFERENT first offered-job ids (visible tappable evidence of the branch — not just a relabeled attribute over the same action set)`,
          ).not.toBe(a.tappedOfferId);
        }
      }
    } finally {
      for (const record of played) {
        await record.context.close();
      }
    }
  });
});
