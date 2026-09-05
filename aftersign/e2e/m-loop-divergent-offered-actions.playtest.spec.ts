import { expect, test, type Browser, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP — divergent offered actions, played tap-only.
//
// Two save slots seeded with DIVERGENT durable memory (one empty,
// one with a completed prior delivery) must render DIFFERENT tappable
// offered-job buttons at the `packet-offered` beat, and a real tap on
// each must commit the composed M-LOOP `lastAction` axis (Soren's
// blocking requirement on PR #1422: `${mloopAction.id}:${offer.id}`).
//
// This spec also pins the DOM ↔ story-state mirror that the player can
// actually regress against: every offered button's element-level
// `data-offer-fingerprint` must match the published
// `story.offeredJobs[].semanticKey` snapshot for the same seeded save.
// That keeps the harness's state contract honest without replacing the
// played tap path.
//
// Seed vector — server-authoritative endpoint (PR #1636 / #1642).
//
// The served page no longer boots from `localStorage`. `aftersign/main.js`
// calls `readAuthoritativeSave({ slot, playerId: "local-slice-player" })`
// at boot; the response wins. So to seed divergent memory this spec
// PUTs the payload into the same store the served page will read:
//   PUT /aftersign/save/local-slice-player/${slot}
//   body: { payload: <persist payload shape> }
// (Endpoint owner: aftersign/vite.config.ts →
// aftersignAuthoritativeSaveMiddleware.)
//
// The slot is passed via `?slot=<slot>` on the URL so each save is
// slot-scoped and cannot bleed into a sibling spec (Soren's second
// blocking item on PR #1579 — the prior rewrite seeded a
// non-existent `aftersign:player-memory` key and dropped `?slot=`).
//
// The bootstrap playerId is the fixed `"local-slice-player"` string
// hardcoded in `aftersign/main.js` around line 556 — it is NOT the
// `player.id` inside the seeded payload. Once the seed is loaded
// state.player.id becomes the payload's id, but the READ path uses
// the bootstrap constant, so the seed MUST be PUT under it.
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
  offerFingerprint: string;
};

const WAIT_MS = 10_000;
const COLD_START_MS = 90_000;

// See boot in aftersign/main.js (~line 556): the read is always keyed
// on this fixed bootstrap id. Any seed must be PUT under it.
const BOOTSTRAP_PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

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
      getSnapshot?: () => {
        story?: {
          offeredJobs?: Array<{ semanticKey?: string }>;
        };
      };
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

  // Capture any browser console.error emitted during boot. The runtime
  // now (PR #1642 follow-up) logs `[aftersign boot] readAuthoritativeSave
  // failed …` on a real fetch/middleware error instead of swallowing it
  // silently. If two slots ever hydrate identical empty state (Soren's
  // hypothesis on the first CI red), this array carries the actual
  // error message the divergence assertion couldn't see before.
  const bootConsoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("[aftersign boot]")) {
        bootConsoleErrors.push(text);
      }
    }
  });

  // Seed the authoritative store BEFORE navigating to the served
  // page — boot fires a single GET against
  //   /aftersign/save/${BOOTSTRAP_PLAYER_ID}/${slot}
  // and there is no localStorage fallback anymore. The PUT below is
  // the ONLY thing that will make the served renderer boot at
  // `packet-offered` with the seeded memory. A missed PUT = both
  // cold slots load empty state = the divergence assertion fails.
  const seedResponse = await page.request.put(
    `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(BOOTSTRAP_PLAYER_ID)}/${encodeURIComponent(slot)}`,
    {
      data: { payload: save },
      headers: { "content-type": "application/json" },
    },
  );
  expect(
    seedResponse.ok(),
    `seed PUT for slot ${slot} must succeed (HTTP ${seedResponse.status()})`,
  ).toBe(true);

  // Round-trip verify: read back the seed through the SAME endpoint
  // the served page boot will hit. If this GET returns the wrong
  // payload (null / stripped memory / different id encoding), boot
  // will hydrate empty state and the divergence assertion fails with
  // an opaque "actions equal" — this check catches the middleware /
  // encoding bug at the seed step, where the error message names the
  // slot instead of hiding behind DOM equality.
  const verifyResponse = await page.request.get(
    `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(BOOTSTRAP_PLAYER_ID)}/${encodeURIComponent(slot)}`,
    { headers: { accept: "application/json" } },
  );
  expect(
    verifyResponse.ok(),
    `seed round-trip GET for slot ${slot} must succeed (HTTP ${verifyResponse.status()})`,
  ).toBe(true);
  const verifyBody = (await verifyResponse.json()) as {
    payload?: { memory?: unknown } | null;
  };
  expect(
    verifyBody?.payload,
    `seed round-trip GET for slot ${slot} must return the payload the served page will read at boot`,
  ).not.toBeNull();
  expect(
    Array.isArray(verifyBody?.payload?.memory),
    `seed round-trip payload for slot ${slot} must carry a memory array (fresh: length 0; returning: length > 0)`,
  ).toBe(true);

  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);

  // If boot logged a load failure, surface it BEFORE the divergence
  // assertion — an error message like "readAuthoritativeSave failed"
  // is the actual diagnostic; two empty slots' identical DOM is the
  // symptom that hides it.
  expect(
    bootConsoleErrors,
    `boot must not log an [aftersign boot] readAuthoritativeSave failure for slot ${slot}`,
  ).toEqual([]);

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
            offerFingerprint: el.getAttribute("data-offer-fingerprint") ?? "",
          };
        }),
    );

  const snapshotFingerprints = await page.evaluate(() =>
    window.__game?.getSnapshot?.().story?.offeredJobs
      ?.map((job) => job.semanticKey ?? "") ?? [],
  );

  return { page, context, actions, snapshotFingerprints };
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
    expect(
      action.offerFingerprint,
      `${label}: data-offer-fingerprint must be set on the tappable DOM node`,
    ).not.toBe("");
  }
}

function assertSnapshotMirrorsDomFingerprints(
  actions: OfferedAction[],
  snapshotFingerprints: string[],
  label: string,
) {
  const domFingerprints = actions.map((a) => a.offerFingerprint).sort();
  expect(
    snapshotFingerprints.filter(Boolean).sort(),
    `${label}: story.offeredJobs semantic keys must mirror the offered-button fingerprints`,
  ).toEqual(domFingerprints);
}

async function tapFirstOffer(page: Page, action: OfferedAction): Promise<void> {
  // The served page renders exactly one `#job-offer-<jobId>` per
  // offered action, and the M-LOOP action id is stamped on the same
  // node via `data-aftersign-job-take-action`.
  const target = page.locator(`#job-offer-${action.jobId}`);
  await expect(
    target,
    `offered button #job-offer-${action.jobId} should be tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await expect(
    target,
    `offered button must carry the resolved M-LOOP action id`,
  ).toHaveAttribute("data-aftersign-job-take-action", action.actionId);
  await expect(
    target,
    `offered button must carry the same semantic fingerprint collected from the DOM`,
  ).toHaveAttribute("data-offer-fingerprint", action.offerFingerprint);
  await target.tap();

  await expect(
    target,
    "the played tap must arm the job-take feel marker on the exact offered button",
  ).toHaveAttribute("data-aftersign-job-take", "armed");

  // `lastAction` composed by `aftersign/main.js` —
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

    const stamp = uniqueSlotSuffix();
    const freshSlot = `m-loop-divergent-fresh-${stamp}`;
    const returningSlot = `m-loop-divergent-returning-${stamp}`;

    const fresh = await collectOfferedActions(browser, freshSlot, FRESH_SAVE);
    const returning = await collectOfferedActions(browser, returningSlot, RETURNING_SAVE);

    try {
      assertActionShape(fresh.actions, "fresh save");
      assertActionShape(returning.actions, "returning save");
      assertSnapshotMirrorsDomFingerprints(
        fresh.actions,
        fresh.snapshotFingerprints,
        "fresh save",
      );
      assertSnapshotMirrorsDomFingerprints(
        returning.actions,
        returning.snapshotFingerprints,
        "returning save",
      );

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

      const freshFingerprintKeys = fresh.actions
        .map((a) => a.offerFingerprint)
        .sort();
      const returningFingerprintKeys = returning.actions
        .map((a) => a.offerFingerprint)
        .sort();
      expect(
        returningFingerprintKeys,
        "divergent seeded memory must also produce a different story/DOM fingerprint set",
      ).not.toEqual(freshFingerprintKeys);

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
