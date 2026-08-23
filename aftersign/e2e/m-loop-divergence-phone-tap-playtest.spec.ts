import { expect, test, type Page } from "@playwright/test";

// M-LOOP-E1 DONE-GATE (#1370) — taps-only phone spec proving two
// divergent memory records surface DIFFERENT tappable actions.
//
// M-LOOP's metric is DIVERGENCE, not beats-reachable: two saves
// whose memory records differ must expose different AVAILABLE
// ELEMENTS in the DOM, not just different lines. This spec seeds
// two isolated slots with hand-crafted persisted saves that disagree
// on the memory axes M-LOOP-E1 keys on (`packetOutcome` and
// `returnReason`), plays one round from each entirely by taps on
// visible controls, and asserts the two runs offered a DIFFERENT
// `[data-offered-action]` id set at ELEMENT level.
//
// Boot contract:
//   • The served page reads its save from `localStorage` under
//     `aftersign:kiosk-slice:${slot}` — seeded here via
//     `page.addInitScript()` BEFORE `page.goto(...)` so the fresh
//     boot lands on the memory record we picked.
//   • The renderer (`aftersign/main.js :: renderOfferedActions()`)
//     reconciles `#offeredActions` on every publishState() tick
//     from the pure map (`apps/web/src/aftersign/offeredActions.ts`).
//     `window.__game.getSnapshot().story.offeredActions` mirrors the
//     same list — used here for invariant reads ONLY (never to
//     cause an action).
//
// Divergence axes exercised:
//   • Save A ("carry-opened-packet-warm")  — packetOutcome: opened, returnReason: kind
//   • Save B ("carry-sealed-packet-cold")  — packetOutcome: sealed, returnReason: blunt
//   Same base packet story, DIFFERENT tone → different action ids
//   → different tappable elements. That's the divergence axis
//   M-LOOP-E1 promises.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

type OfferedAction = { id: string; label: string };
type FlagshipSnapshot = {
  story?: {
    offeredActions?: OfferedAction[];
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => FlagshipSnapshot;
      lastOfferedActionTap?: { id: string; tappedAt: number };
    };
  }
}

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function snapshot(page: Page): Promise<FlagshipSnapshot> {
  await waitForGame(page);
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function seedSlot(
  page: Page,
  slot: string,
  save: {
    packetOutcome: "opened" | "sealed";
    returnReason: "kind" | "evasive" | "blunt";
  },
): Promise<void> {
  // Match the persistence contract in `aftersign/main.js` boot: the
  // stored bag is JSON at `aftersign:kiosk-slice:${slot}`, and the
  // page reads `stored.delivery.outcome`, `stored.player.returnReason`,
  // and the memory-fact array for its live `state`. `packet.sealed`
  // is set from `packetOutcome === "sealed"` so the packet HUD lines
  // up with the memory record.
  const storageKey = `aftersign:kiosk-slice:${slot}`;
  const payload = {
    slot,
    beat: "packet-offered",
    delivery: { outcome: save.packetOutcome },
    packet: {
      sealed: save.packetOutcome === "sealed",
      delivered: false,
      route: null,
      deliveredAt: null,
    },
    player: {
      id: "local-slice-player",
      returnReason: save.returnReason,
    },
    memory: [],
  };
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: payload },
  );
}

const tap = async (page: Page, selector: string): Promise<void> => {
  const button = page.locator(selector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.tap();
};

test.describe("M-LOOP-E1 done-gate — memory divergence at the tappable-element level", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("two saves with divergent memory records offer DIFFERENT tappable actions, played by taps only", async ({
    page,
    context,
  }) => {
    // ── SAVE A: opened packet, "kind" return tone ────────────────
    const slotA = `m-loop-div-a-${Date.now()}`;
    await seedSlot(page, slotA, {
      packetOutcome: "opened",
      returnReason: "kind",
    });
    await page.goto(`/aftersign/?slot=${slotA}`, { waitUntil: "load" });
    await waitForGame(page);

    // Invariant read only — confirm the boot memory record is what
    // we seeded (not to cause an action).
    const snapA = await snapshot(page);
    const offeredA = snapA.story?.offeredActions ?? [];
    expect(offeredA.map((a) => a.id)).toEqual(["carry-opened-packet-warm"]);

    // The tappable ELEMENT for save A is present and enabled. Non-
    // offered ids MUST be absent from the DOM (not merely hidden) —
    // that's the divergence gate: element-level, not text-level.
    await expect(
      page.locator('#offeredActions button[data-offered-action="carry-opened-packet-warm"]'),
    ).toBeVisible();
    await expect(
      page.locator('#offeredActions button[data-offered-action="carry-sealed-packet-cold"]'),
    ).toHaveCount(0);

    // Played by a REAL tap on a visible element.
    await tap(
      page,
      '#offeredActions button[data-offered-action="carry-opened-packet-warm"]',
    );

    // The renderer stamps the receipt on `window.__game.lastOfferedActionTap`.
    // Reading it is an invariant assertion — proves the tap landed
    // on the id the memory record predicted, without driving state.
    await expect
      .poll(
        async () => page.evaluate(() => window.__game?.lastOfferedActionTap?.id ?? null),
        { timeout: WAIT_MS },
      )
      .toBe("carry-opened-packet-warm");

    // ── SAVE B: sealed packet, "blunt" return tone ───────────────
    // Isolated page so localStorage is fresh — the two saves must
    // never share a slot (the served page's boot ONLY reads its own
    // slot key from localStorage, so a mistargeted seed would
    // contaminate the divergence assertion).
    const pageB = await context.newPage();
    const slotB = `m-loop-div-b-${Date.now()}`;
    await seedSlot(pageB, slotB, {
      packetOutcome: "sealed",
      returnReason: "blunt",
    });
    await pageB.goto(`/aftersign/?slot=${slotB}`, { waitUntil: "load" });
    await waitForGame(pageB);

    const snapB = await snapshot(pageB);
    const offeredB = snapB.story?.offeredActions ?? [];
    expect(offeredB.map((a) => a.id)).toEqual(["carry-sealed-packet-cold"]);

    await expect(
      pageB.locator('#offeredActions button[data-offered-action="carry-sealed-packet-cold"]'),
    ).toBeVisible();
    await expect(
      pageB.locator('#offeredActions button[data-offered-action="carry-opened-packet-warm"]'),
    ).toHaveCount(0);

    await tap(
      pageB,
      '#offeredActions button[data-offered-action="carry-sealed-packet-cold"]',
    );

    await expect
      .poll(
        async () => pageB.evaluate(() => window.__game?.lastOfferedActionTap?.id ?? null),
        { timeout: WAIT_MS },
      )
      .toBe("carry-sealed-packet-cold");

    // ── DIVERGENCE ASSERTION ──────────────────────────────────────
    // The two saves offered DIFFERENT tappable action ids at
    // element level. This is the M-LOOP metric — a run that
    // differed only in line text would FAIL this assertion.
    const idsA = offeredA.map((a) => a.id).sort();
    const idsB = offeredB.map((a) => a.id).sort();
    expect(idsA).not.toEqual(idsB);
    // And the ids the DOM actually rendered agree with the snapshot
    // — no drift between predicted and painted.
    const domIdsA = await page.$$eval(
      "#offeredActions button[data-offered-action]",
      (nodes) => nodes.map((n) => n.getAttribute("data-offered-action")).sort(),
    );
    const domIdsB = await pageB.$$eval(
      "#offeredActions button[data-offered-action]",
      (nodes) => nodes.map((n) => n.getAttribute("data-offered-action")).sort(),
    );
    expect(domIdsA).toEqual(idsA);
    expect(domIdsB).toEqual(idsB);
    expect(domIdsA).not.toEqual(domIdsB);

    await pageB.close();
  });
});
