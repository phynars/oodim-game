import { expect, test, type Browser, type Page } from "@playwright/test";

// M-LOOP-E1 done-gate — taps-only phone spec proving two divergent
// saves offer DIFFERENT tappable actions on the served page.
//
// SCOPE. This is the epic's done-gate (issue #1370). M-LOOP's metric
// is DIVERGENCE at the AVAILABLE-ACTION level, not beats-reachable.
// Two save-states with different memory records must produce different
// TAPPABLE ELEMENTS on the served surface. Dialogue-only differences
// score zero.
//
// WHY IT IS EXPECTED RED TODAY. The issue is explicit: this spec is
// RED before the memory-computed-action-set story lands (no divergence
// exists yet) and GREEN after. Its job is to fail HERE, at the
// element-set assertion — NOT at boot, NOT at a missing selector.
// Prior revision failed for the wrong reasons: it queried `#io` /
// `#orra` (no such ids on the served page — only `#deliverButton`,
// `#acknowledgeRouteButton`, `#skipRouteButton` exist, per
// `aftersign/index.html` and `main.js:1091-1112`), and it seeded via
// `localStorage["aftersign-save"]` (the boot path reads
// `aftersign:kiosk-slice:${slot}`, per `main.js`). Both defects
// masked the real assertion. Fixed here by (1) using only the three
// real button ids the served page exposes, and (2) letting real play
// write the durable save under a unique `?slot=` — the sibling pattern
// used by `m-continue-next-job-played.spec.ts` and
// `durable-return-session-phone-playtest.spec.ts`.
//
// HOW IT DIVERGES THE SAVES. Both saves start from a cold slot,
// deliver the packet by tap (mints the durable packet-outcome +
// route-attention memory facts), then take DIFFERENT `returnAnswerTone`
// paths at `io-return-recognition`:
//   • SAVE A taps `#acknowledgeRouteButton` — "Kind return"  → tone=kind
//   • SAVE B taps `#skipRouteButton`        — "Evasive return" → tone=evasive
// Same button strip, same three ids — but the memory record diverges
// on the tone fact. Both then tap "Ask for next job" and reload. The
// reload boots the returning-session line for each memory record; the
// M-LOOP-E1 impl story is what makes the returning session offer a
// DIFFERENT tappable action set on top of that divergent memory. This
// spec ASSERTS that set differs. Today: it does not (RED). After the
// impl lands: it does (GREEN).
//
// TAPS ONLY. Every mutation is a `.tap()` on a visible + enabled
// button that ships on the served page. `window.__game.getSnapshot()`
// is READ ONLY — used only to (a) confirm the memory records diverged
// (invariant), and (b) wait for beat transitions. Nothing drives play
// through `__game.input.*`.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 20_000;

type FlagshipSnapshot = {
  scene?: { beat?: string };
  packet?: { delivered?: boolean; sealed?: boolean };
  delivery?: { outcome?: string };
  npcs?: {
    io?: {
      lastLine?: string | null;
      memory?: Array<{ id?: string; object?: string; action?: string }>;
    };
  };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean; beat?: string };
      getSnapshot?: () => FlagshipSnapshot;
    };
  }
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function snapshot(page: Page): Promise<FlagshipSnapshot> {
  await waitForReady(page);
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function waitForBeat(page: Page, beat: string): Promise<FlagshipSnapshot> {
  await expect
    .poll(async () => (await snapshot(page)).scene?.beat, { timeout: WAIT_MS })
    .toBe(beat);
  return snapshot(page);
}

async function tap(page: Page, selector: string): Promise<void> {
  const button = page.locator(selector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.tap();
}

// The three tap targets the served page actually exposes
// (`aftersign/index.html` + `main.js`'s button strip). Any assertion
// about "which actions are offered" must be over THIS set of ids —
// there is no `#io` / `#orra` on the served page.
const SERVED_BUTTON_IDS = ["#deliverButton", "#acknowledgeRouteButton", "#skipRouteButton"] as const;

async function offeredTappableIds(page: Page): Promise<Array<{ id: string; label: string }>> {
  const rows = await Promise.all(
    SERVED_BUTTON_IDS.map(async (selector) => {
      const button = page.locator(selector);
      const visible = await button.isVisible().catch(() => false);
      const enabled = visible ? await button.isEnabled().catch(() => false) : false;
      if (!visible || !enabled) return null;
      const label = ((await button.textContent().catch(() => "")) ?? "").trim();
      return { id: selector, label };
    }),
  );
  return rows.filter((row): row is { id: string; label: string } => row !== null);
}

async function playRoundThenReload(
  browser: Browser,
  tag: string,
  toneSelector: "#acknowledgeRouteButton" | "#skipRouteButton",
): Promise<{ page: Page; memory: FlagshipSnapshot; offered: Array<{ id: string; label: string }> }> {
  const context = await browser.newContext({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  // Unique slot per save — same isolation the sibling playtests use
  // (`m-continue-phone-tap-playtest.spec.ts`,
  // `durable-return-session-phone-playtest.spec.ts`). Cold slot means
  // cold localStorage + cold server-authoritative save; the round
  // itself is what writes the durable memory record we assert on.
  const slot = `m-loop-e1-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);

  // Boot: packet-offered. Only `#deliverButton` is enabled here
  // (`main.js` else-branch at packet-offered leaves acknowledge/skip
  // disabled with their default labels).
  const boot = await snapshot(page);
  expect(boot.scene?.beat).toBe("packet-offered");
  await expect(page.locator("#acknowledgeRouteButton")).toBeDisabled();
  await expect(page.locator("#skipRouteButton")).toBeDisabled();
  await tap(page, "#deliverButton");

  // io-return-recognition: the three buttons re-label to Kind/Evasive/Blunt.
  // SAVE A taps Kind (`#acknowledgeRouteButton`),
  // SAVE B taps Evasive (`#skipRouteButton`) — divergent tone facts.
  await waitForBeat(page, "io-return-recognition");
  await expect(page.locator("#acknowledgeRouteButton")).toContainText(/kind return/i);
  await expect(page.locator("#skipRouteButton")).toContainText(/evasive return/i);
  await expect(page.locator("#deliverButton")).toContainText(/blunt return/i);
  await tap(page, toneSelector);

  // return-tone-choice: only `#deliverButton` ("Ask for next job")
  // is enabled. Tapping it advances to io-next-job and finalizes the
  // durable save for this run.
  await waitForBeat(page, "return-tone-choice");
  await tap(page, "#deliverButton");
  await waitForBeat(page, "io-next-job");

  // Reload — real browser reload, fresh module evaluation. The
  // returning-session boot override picks the line from the durable
  // memory record; the M-LOOP-E1 impl story wires the AVAILABLE
  // ACTION SET off that same record.
  await page.reload({ waitUntil: "load" });
  await waitForReady(page);

  const memory = await snapshot(page);
  const offered = await offeredTappableIds(page);
  return { page, memory, offered };
}

test.describe("M-LOOP E1: memory changes the actions a phone player can take", () => {
  test("two divergent saves offer different visible tappable actions after a taps-only round", async ({ browser }) => {
    test.setTimeout(180_000);

    const saveA = await playRoundThenReload(browser, "kind", "#acknowledgeRouteButton");
    const saveB = await playRoundThenReload(browser, "evasive", "#skipRouteButton");

    // INVARIANT — the two runs actually diverged the memory record.
    // Read-only snapshot access; never drives play. If this fails the
    // divergent-actions assertion below is meaningless, so we assert
    // it first and give a clear signal.
    const toneA = saveA.memory.npcs?.io?.memory?.find((fact) => fact?.action === "returned")?.object
      ?? saveA.memory.npcs?.io?.lastLine;
    const toneB = saveB.memory.npcs?.io?.memory?.find((fact) => fact?.action === "returned")?.object
      ?? saveB.memory.npcs?.io?.lastLine;
    expect(toneA).toBeDefined();
    expect(toneB).toBeDefined();
    expect(toneA).not.toEqual(toneB);

    // THE GATE — DIVERGENCE AT THE TAPPABLE-ELEMENT LEVEL.
    // Compare the set of visible + enabled button ids (and their
    // rendered labels) on the returning session. A run that differs
    // only in `#line` text (dialogue-only) will match here and FAIL
    // the assertion — that is the point of the M-LOOP metric.
    //
    // Today: both returning sessions boot into the same
    // `packet-delivered` beat with the same enabled `#deliverButton`
    // affordance (no action-set divergence yet). This assertion is
    // RED. Once the impl story wires the available action set off
    // the memory record, the sets diverge and this goes GREEN.
    expect(saveA.offered).not.toEqual(saveB.offered);

    await saveA.page.context().close();
    await saveB.page.context().close();
  });
});
