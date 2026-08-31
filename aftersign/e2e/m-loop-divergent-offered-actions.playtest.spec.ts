import { expect, test, type Browser, type Page } from "@playwright/test";

type OfferedAction = {
  id: string;
  tapChoice: string;
  routeRisk: string;
  memoryGate: string;
  jobTakeAction: string;
  ariaLabel: string;
};

const phone = { width: 390, height: 844 };

const memoryFact = (object: "sealed" | "opened") => ({
  id: `fact-${object}-delivery`,
  kind: "delivery-outcome",
  subject: "blue-packet",
  object,
  sessionId: `session-m-loop-${object}`,
  createdAt: "2026-08-31T00:00:00.000Z",
});

const freshSave = {
  beat: "packet-offered",
  player: { id: "m-loop-fresh-player", flags: { io_intro_seen: true } },
  packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
  delivery: { id: "blue-packet", outcome: "unknown" },
  memory: [],
  npcs: { io: { memory: [] }, orra: { memory: [] } },
  save: { revision: 0, dirty: false },
};

const returningMemory = [memoryFact("sealed")];
const returningSave = {
  beat: "packet-offered",
  player: { id: "m-loop-returning-player", flags: { io_intro_seen: true } },
  packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
  delivery: { id: "blue-packet", outcome: "unknown" },
  memory: returningMemory,
  npcs: { io: { memory: returningMemory }, orra: { memory: [] } },
  save: { revision: 1, dirty: false },
};

async function collectVisibleOfferedActions(page: Page, slot: string) {
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
  );

  const offeredJobs = page.locator("#offeredJobs");
  await expect(offeredJobs).toHaveAttribute("data-visible", "true");
  const buttons = offeredJobs.locator("button:visible:not([disabled])");
  await expect(buttons.first()).toBeVisible();

  const actions = await buttons.evaluateAll((nodes): OfferedAction[] =>
    nodes.map((node) => ({
      id: node.id,
      tapChoice: node.getAttribute("data-aftersign-tap-choice") ?? "",
      routeRisk:
        node.getAttribute("data-route-risk")
        ?? node.getAttribute("data-offered-job-risk")
        ?? "",
      memoryGate: node.getAttribute("data-mloop-memory-gate") ?? "",
      jobTakeAction: node.getAttribute("data-aftersign-job-take-action") ?? "",
      ariaLabel: node.getAttribute("aria-label") ?? "",
    })),
  );

  return actions.sort((a, b) =>
    `${a.id}/${a.tapChoice}/${a.routeRisk}/${a.memoryGate}/${a.jobTakeAction}/${a.ariaLabel}`
      .localeCompare(
        `${b.id}/${b.tapChoice}/${b.routeRisk}/${b.memoryGate}/${b.jobTakeAction}/${b.ariaLabel}`,
      ),
  );
}

async function collectActionsForSave(
  browser: Browser,
  slot: string,
  save: Record<string, unknown>,
) {
  const context = await browser.newContext({
    viewport: phone,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    {
      key: `aftersign:kiosk-slice:${slot}`,
      value: save,
    },
  );
  const page = await context.newPage();
  try {
    return await collectVisibleOfferedActions(page, slot);
  } finally {
    await context.close();
  }
}

test.describe("AFTERSIGN M-LOOP offered actions", () => {
  test("played phone surface renders different tappable actions for divergent memory saves", async ({ browser }) => {
    const freshActions = await collectActionsForSave(
      browser,
      "m-loop-fresh-actions",
      freshSave,
    );
    const returningActions = await collectActionsForSave(
      browser,
      "m-loop-returning-actions",
      returningSave,
    );

    expect(freshActions.length).toBeGreaterThan(0);
    expect(returningActions.length).toBeGreaterThan(0);
    expect(returningActions).not.toEqual(freshActions);
    expect(returningActions.map((action) => action.tapChoice)).not.toEqual(
      freshActions.map((action) => action.tapChoice),
    );
  });
});
