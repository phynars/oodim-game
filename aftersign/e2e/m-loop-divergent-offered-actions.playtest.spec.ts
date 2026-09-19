import { expect, test, type Browser, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP — divergent offered actions, played tap-only.
// Two divergent authoritative saves must render different tappable offers;
// each real tap commits `${mloopAction.id}:${offer.id}`.

type OfferedAction = {
  jobId: string;
  actionId: string;
  memoryGate: string;
  ariaLabel: string;
  offerFingerprint: string;
};

// SwiftShader can spend more than 10s compiling the cold WebGL boot path.
// This is only the readiness/DOM wait budget; the 90s test budget and all
// seed, divergence, and played-action assertions remain unchanged.
const WAIT_MS = 30_000;
const COLD_START_MS = 90_000;
const BOOTSTRAP_PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";
const PHONE_VIEWPORT = { width: 390, height: 844 };

const FRESH_SAVE = {
  beat: "packet-offered",
  packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
  delivery: { outcome: "unknown" },
  player: { id: "m-loop-fresh-player", name: null, flags: { io_intro_seen: true } },
  memory: [],
  save: { revision: 0 },
};

const RETURNING_MEMORY = [
  { id: "fact-delivery-outcome-seeded", kind: "delivery-outcome", subject: "io", object: "sealed", sessionId: "session-m-loop-returning" },
  { id: "fact-route-attention-seeded", kind: "route-attention", subject: "io", object: "done", sessionId: "session-m-loop-returning" },
];

const RETURNING_SAVE = {
  beat: "packet-offered",
  packet: { delivered: true, route: "blue rainline", sealed: true, deliveredAt: "2026-01-01T00:00:00.000Z" },
  delivery: { outcome: "sealed" },
  player: { id: "m-loop-returning-player", name: null, flags: { io_intro_seen: true } },
  memory: RETURNING_MEMORY,
  save: { revision: 1 },
};

declare global {
  interface Window {
    __game?: {
      scene?: { ready?: boolean };
      interaction?: { lastAction?: string | null };
      getSnapshot?: () => { story?: { offeredJobs?: Array<{ semanticKey?: string }> } };
    };
  }
}

async function newPhoneContext(browser: Browser) {
  return browser.newContext({ viewport: PHONE_VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
}

function uniqueSlotSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.scene?.ready === true, undefined, { timeout: WAIT_MS });
}

async function collectOfferedActions(
  browser: Browser,
  slot: string,
  save: Record<string, unknown>,
): Promise<{
  page: Page;
  context: Awaited<ReturnType<typeof newPhoneContext>>;
  actions: OfferedAction[];
  snapshotFingerprints: string[];
}> {
  const context = await newPhoneContext(browser);
  const page = await context.newPage();
  const bootConsoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && msg.text().includes("[aftersign boot]")) bootConsoleErrors.push(msg.text());
  });

  const endpoint = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(BOOTSTRAP_PLAYER_ID)}/${encodeURIComponent(slot)}`;
  const seedResponse = await page.request.put(endpoint, {
    data: { payload: save },
    headers: { "content-type": "application/json" },
  });
  expect(seedResponse.ok(), `seed PUT for slot ${slot} must succeed (HTTP ${seedResponse.status()})`).toBe(true);

  // Keep the PUT/GET diagnostic: the served boot reads this exact endpoint.
  const verifyResponse = await page.request.get(endpoint, { headers: { accept: "application/json" } });
  expect(verifyResponse.ok(), `seed round-trip GET for slot ${slot} must succeed (HTTP ${verifyResponse.status()})`).toBe(true);
  const verifyBody = (await verifyResponse.json()) as { payload?: { memory?: unknown } | null };
  expect(verifyBody?.payload, `seed round-trip GET for slot ${slot} must return the payload the served page will read at boot`).not.toBeNull();
  expect(Array.isArray(verifyBody?.payload?.memory), `seed round-trip payload for slot ${slot} must carry a memory array (fresh: length 0; returning: length > 0)`).toBe(true);

  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);
  expect(bootConsoleErrors, `boot must not log an [aftersign boot] readAuthoritativeSave failure for slot ${slot}`).toEqual([]);

  await expect(page.locator('[data-beat-id="packet-offered"]'), "seeded save should boot at the packet-offered beat").toBeVisible({ timeout: WAIT_MS });
  const offeredTray = page.locator("#offeredJobs");
  await expect(offeredTray).toBeVisible({ timeout: WAIT_MS });
  await expect(offeredTray.locator("button:not([disabled])").first()).toBeVisible({ timeout: WAIT_MS });

  const actions = await offeredTray.locator("button[data-mloop-job-id][data-aftersign-job-take-action]").evaluateAll((nodes): OfferedAction[] =>
    nodes.filter((node) => {
      const el = node as HTMLElement;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && !el.hasAttribute("disabled");
    }).map((node) => {
      const el = node as HTMLElement;
      return {
        jobId: el.getAttribute("data-mloop-job-id") ?? "",
        actionId: el.getAttribute("data-aftersign-job-take-action") ?? "",
        memoryGate: el.getAttribute("data-mloop-memory-gate") ?? "",
        ariaLabel: el.getAttribute("aria-label") ?? "",
        offerFingerprint: el.getAttribute("data-offer-fingerprint") ?? "",
      };
    }),
  );
  const snapshotFingerprints = await page.evaluate(() => window.__game?.getSnapshot?.().story?.offeredJobs?.map((job) => job.semanticKey ?? "") ?? []);
  return { page, context, actions, snapshotFingerprints };
}

function assertActionShape(actions: OfferedAction[], label: string) {
  expect(actions.length, `${label}: at least one offered action must render`).toBeGreaterThan(0);
  for (const action of actions) {
    expect(action.jobId, `${label}: data-mloop-job-id must be set`).not.toBe("");
    expect(action.actionId, `${label}: data-aftersign-job-take-action must carry the M-LOOP action id`).not.toBe("");
    expect(action.memoryGate, `${label}: data-mloop-memory-gate must be set (fresh|returning)`).not.toBe("");
    expect(action.ariaLabel, `${label}: aria-label must be authored non-empty`).not.toBe("");
    expect(action.offerFingerprint, `${label}: data-offer-fingerprint must be set on the tappable DOM node`).not.toBe("");
  }
}

function assertSnapshotMirrorsDomFingerprints(actions: OfferedAction[], snapshotFingerprints: string[], label: string) {
  expect(snapshotFingerprints.filter(Boolean).sort(), `${label}: story.offeredJobs semantic keys must mirror the offered-button fingerprints`).toEqual(actions.map((a) => a.offerFingerprint).sort());
}

async function tapFirstOffer(page: Page, action: OfferedAction): Promise<void> {
  const target = page.locator(`#job-offer-${action.jobId}`);
  await expect(target, `offered button #job-offer-${action.jobId} should be tappable`).toBeVisible({ timeout: WAIT_MS });
  await expect(target, "offered button must carry the resolved M-LOOP action id").toHaveAttribute("data-aftersign-job-take-action", action.actionId);
  await expect(target, "offered button must carry the same semantic fingerprint collected from the DOM").toHaveAttribute("data-offer-fingerprint", action.offerFingerprint);
  await target.tap();
  await expect(target, "the played tap must arm the job-take feel marker on the exact offered button").toHaveAttribute("data-aftersign-job-take", "armed");
  await expect.poll(() => page.evaluate(() => window.__game?.interaction?.lastAction ?? null), {
    message: `tap on ${action.jobId} must commit lastAction = ${action.actionId}:${action.jobId}`,
    timeout: WAIT_MS,
  }).toBe(`${action.actionId}:${action.jobId}`);
}

test.describe("AFTERSIGN M-LOOP divergent offered actions", () => {
  test("divergent seeded memory renders divergent tappable offered actions and each tap commits the composed lastAction axis", async ({ browser }) => {
    test.setTimeout(COLD_START_MS);
    const stamp = uniqueSlotSuffix();
    const fresh = await collectOfferedActions(browser, `m-loop-divergent-fresh-${stamp}`, FRESH_SAVE);
    const returning = await collectOfferedActions(browser, `m-loop-divergent-returning-${stamp}`, RETURNING_SAVE);
    try {
      assertActionShape(fresh.actions, "fresh save");
      assertActionShape(returning.actions, "returning save");
      assertSnapshotMirrorsDomFingerprints(fresh.actions, fresh.snapshotFingerprints, "fresh save");
      assertSnapshotMirrorsDomFingerprints(returning.actions, returning.snapshotFingerprints, "returning save");

      const freshKeys = fresh.actions.map((a) => `${a.jobId}|${a.actionId}|${a.memoryGate}`).sort();
      const returningKeys = returning.actions.map((a) => `${a.jobId}|${a.actionId}|${a.memoryGate}`).sort();
      expect(returningKeys, "divergent seeded memory must produce a different element-level offered-action set").not.toEqual(freshKeys);
      expect(returning.actions.map((a) => a.offerFingerprint).sort(), "divergent seeded memory must also produce a different story/DOM fingerprint set").not.toEqual(fresh.actions.map((a) => a.offerFingerprint).sort());
      expect(new Set(fresh.actions.map((a) => a.memoryGate)).has("fresh"), "fresh save must expose a `fresh`-gated offer").toBe(true);
      expect(new Set(returning.actions.map((a) => a.memoryGate)).has("returning"), "returning save must expose a `returning`-gated offer").toBe(true);

      // Visible player interaction: touch the rendered #job-offer-* buttons.
      await tapFirstOffer(fresh.page, fresh.actions[0]);
      await tapFirstOffer(returning.page, returning.actions[0]);
    } finally {
      await fresh.context.close();
      await returning.context.close();
    }
  });
});
