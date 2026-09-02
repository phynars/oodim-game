import { expect, test, type Browser, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP — divergent offered actions, played tap-only.
//
// Two save slots seeded with DIVERGENT durable memory (one empty,
// one with a completed prior delivery) must render DIFFERENT tappable
// offered-job buttons at the `packet-offered` beat, and a real tap on
// each must commit the composed M-LOOP `lastAction` axis (Soren's
// blocking requirement on PR #1422: `${mloopAction.id}:${offer.id}`).
//
// Storage key (from `aftersign/main.js:517`):
//   `aftersign:kiosk-slice:${slot}`
// The slot is passed via `?slot=<slot>` on the URL so each save is
// slot-scoped and cannot bleed into a sibling spec (Soren's second
// blocking item on PR #1579 — the prior rewrite seeded a
// non-existent `aftersign:player-memory` key and dropped `?slot=`).
//
// Sibling reference specs (same seed vocabulary):
//   - `memory-divergence-phone-playtest.spec.ts` (offered-id set
//     divergence, tap-only phone playthrough)
//   - `mloop-job-copy-played.spec.ts`             (composed
//     `lastAction` = `${mloopAction.id}:${offer.id}` assertion)

type OfferedAction = {
  jobId: string;
  actionId: string;
  memoryGate: string;
  ariaLabel: string;
};

const WAIT_MS = 10_000;
const COLD_START_MS = 90_000;

const STORAGE_PREFIX = "aftersign:kiosk-slice:";

const PHONE_VIEWPORT = { width: 390, height: 844 };

// Payload shapes mirror what `buildPersistPayload` writes and boot in
// `aftersign/main.js` reads back: top-level `beat`, `packet`,
// `delivery`, `player`, `memory` (Io's durable facts), `save`.

const FRESH_SAVE = {
  beat: "packet-offered",
  packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
  delivery: { outcome: "unknown" },
  player: {
    id: "m-loop-fresh-player",
    name: null,
    flags: { io_intro_seen: true },
  },
  memory: [],
  save: { revision: 0 },
};

const RETURNING_MEMORY = [
  {
    id: "fact-delivery-outcome-seeded",
    kind: "delivery-outcome",
    subject: "io",
    object: "sealed",
    sessionId: "session-m-loop-returning",
  },
  {
    id: "fact-route-attention-seeded",
    kind: "route-attention",
    subject: "io",
    object: "done",
    sessionId: "session-m-loop-returning",
  },
];

const RETURNING_SAVE = {
  beat: "packet-offered",
  packet: {
    delivered: true,
    route: "blue rainline",
    sealed: true,
    deliveredAt: "2026-01-01T00:00:00.000Z",
  },
  delivery: { outcome: "sealed" },
  player: {
    id: "m-loop-returning-player",
    name: null,
    flags: { io_intro_seen: true },
  },
  memory: RETURNING_MEMORY,
  save: { revision: 1 },
};

declare global {
  interface Window {
    __game?: {
      scene?: { ready?: boolean };
      interaction?: { lastAction?: string | null };
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

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function collectOfferedActions(
  browser: Browser,
  slot: string,
  save: Record<string, unknown>,
): Promise<{
  page: Page;
  context: Awaited<ReturnType<typeof newPhoneContext>>;
  actions: OfferedAction[];
}> {
  const context = await newPhoneContext(browser);
  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: `${STORAGE_PREFIX}${slot}`, value: JSON.stringify(save) },
  );
  const page = await context.newPage();
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);

  await expect(
    page.locator('[data-beat-id="packet-offered"]'),
    "seeded save should boot at the packet-offered beat",
  ).toBeVisible({ timeout: WAIT_MS });

  const offeredTray = page.locator("#offeredJobs");
  await expect(offeredTray).toBeVisible({ timeout: WAIT_MS });
  await expect(offeredTray.locator("button:not([disabled])").first()).toBeVisible({
    timeout: WAIT_MS,
  });

  const actions = await offeredTray
    .locator("button[data-mloop-job-id][data-aftersign-job-take-action]")
    .evaluateAll((nodes): OfferedAction[] =>
      nodes
        .filter((node) => {
          const el = node as HTMLElement;
          const rect = el.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            !el.hasAttribute("disabled")
          );
        })
        .map((node) => {
          const el = node as HTMLElement;
          return {
            jobId: el.getAttribute("data-mloop-job-id") ?? "",
            actionId: el.getAttribute("data-aftersign-job-take-action") ?? "",
            memoryGate: el.getAttribute("data-mloop-memory-gate") ?? "",
            ariaLabel: el.getAttribute("aria-label") ?? "",
          };
        }),
    );

  return { page, context, actions };
}

function assertActionShape(actions: OfferedAction[], label: string) {
  expect(actions.length, `${label}: at least one offered action must render`).toBeGreaterThan(0);
  for (const action of actions) {
    expect(action.jobId, `${label}: data-mloop-job-id must be set`).not.toBe("");
    expect(
      action.actionId,
      `${label}: data-aftersign-job-take-action must carry the M-LOOP action id`,
    ).not.toBe("");
    expect(
      action.memoryGate,
      `${label}: data-mloop-memory-gate must be set (fresh|returning)`,
    ).not.toBe("");
    expect(
      action.ariaLabel,
      `${label}: aria-label must be authored non-empty`,
    ).not.toBe("");
  }
}

async function tapFirstOffer(page: Page, action: OfferedAction): Promise<void> {
  // The served page renders exactly one `#job-offer-<jobId>` per
  // offered action (aftersign/main.js:1934), and the M-LOOP action
  // id is stamped on the same node via `data-aftersign-job-take-action`.
  const target = page.locator(`#job-offer-${action.jobId}`);
  await expect(
    target,
    `offered button #job-offer-${action.jobId} should be tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await expect(
    target,
    `offered button must carry the resolved M-LOOP action id`,
  ).toHaveAttribute("data-aftersign-job-take-action", action.actionId);
  await target.tap();

  await expect(
    target,
    "the played tap must arm the job-take feel marker on the exact offered button",
  ).toHaveAttribute("data-aftersign-job-take", "armed");

  // `lastAction` composed by `aftersign/main.js:1978` —
  // `${mloopAction.id}:${offer.id}`. Poll because the click handler
  // stamps it asynchronously after the rAF-scheduled render pass.
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.interaction?.lastAction ?? null),
      {
        message: `tap on ${action.jobId} must commit lastAction = ${action.actionId}:${action.jobId}`,
        timeout: WAIT_MS,
      },
    )
    .toBe(`${action.actionId}:${action.jobId}`);
}

test.describe("AFTERSIGN M-LOOP divergent offered actions", () => {
  test("divergent seeded memory renders divergent tappable offered actions and each tap commits the composed lastAction axis", async ({
    browser,
  }) => {
    test.setTimeout(COLD_START_MS);

    const stamp = Date.now();
    const freshSlot = `m-loop-divergent-fresh-${stamp}`;
    const returningSlot = `m-loop-divergent-returning-${stamp}`;

    const fresh = await collectOfferedActions(browser, freshSlot, FRESH_SAVE);
    const returning = await collectOfferedActions(browser, returningSlot, RETURNING_SAVE);

    try {
      assertActionShape(fresh.actions, "fresh save");
      assertActionShape(returning.actions, "returning save");

      // Divergence — element-level (jobId × actionId × memoryGate),
      // not just text-level. `data-mloop-memory-gate` MUST flip
      // fresh → returning under the two seeded saves.
      const freshKeys = fresh.actions
        .map((a) => `${a.jobId}|${a.actionId}|${a.memoryGate}`)
        .sort();
      const returningKeys = returning.actions
        .map((a) => `${a.jobId}|${a.actionId}|${a.memoryGate}`)
        .sort();

      expect(
        returningKeys,
        "divergent seeded memory must produce a different element-level offered-action set",
      ).not.toEqual(freshKeys);

      const freshGates = new Set(fresh.actions.map((a) => a.memoryGate));
      const returningGates = new Set(returning.actions.map((a) => a.memoryGate));
      expect(freshGates.has("fresh"), "fresh save must expose a `fresh`-gated offer").toBe(true);
      expect(
        returningGates.has("returning"),
        "returning save must expose a `returning`-gated offer",
      ).toBe(true);

      // Real tap on each surface commits the composed lastAction.
      await tapFirstOffer(fresh.page, fresh.actions[0]);
      await tapFirstOffer(returning.page, returning.actions[0]);
    } finally {
      await fresh.context.close();
      await returning.context.close();
    }
  });
});
