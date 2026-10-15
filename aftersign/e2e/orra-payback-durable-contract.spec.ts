import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// #2260 durable authority contract. Seed each red-tag result through the
// served save endpoint, discard the seeding session, then inspect it from a
// fresh phone browser context. This deliberately does not use localStorage or
// an in-page snapshot: only D1-backed boot can satisfy the assertion.
//
// GATED (test.fixme): the Orra payback UI — a single
// `button[data-orra-payback-action]` whose action id is one of
// `carry-name-to-bell-archive` / `leave-name-with-orra` — is not yet
// rendered on main (grep: the markup appears only in this spec). The
// seed payload below is also provisional until it is checked against
// the real save schema + boot-restore code.
//
// Flip these to `test(...)` once BOTH land:
//   1. The payback scene renders the two buttons with the ids above.
//   2. `seedRedTagReturn`'s payload shape matches what the
//      `/aftersign/save/:player/:slot` PUT handler + boot restore
//      actually consume (verify against the schema module and the
//      boot path that reads it).
// Until then this file stands as the executable contract for #2260.

const PLAYER_ID = "local-slice-player";
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

type RedTagOutcome = "sealed" | "opened";

type ExpectedAction = {
  outcome: RedTagOutcome;
  actionId: "carry-name-to-bell-archive" | "leave-name-with-orra";
};

const cases: ExpectedAction[] = [
  { outcome: "sealed", actionId: "carry-name-to-bell-archive" },
  { outcome: "opened", actionId: "leave-name-with-orra" },
];

function saveUrl(slot: string): string {
  return `/aftersign/save/${encodeURIComponent(PLAYER_ID)}/${encodeURIComponent(slot)}`;
}

async function newPhoneContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function seedRedTagReturn(
  page: Page,
  slot: string,
  outcome: RedTagOutcome,
): Promise<void> {
  const payload = {
    beat: "io-return-recognition",
    packet: { delivered: true, route: "night-transfer", sealed: outcome === "sealed", deliveredAt: "seeded" },
    delivery: { id: "red-tag", outcome },
    player: {
      id: PLAYER_ID,
      name: null,
      flags: { io_intro_seen: true },
      secondPacketHandoffAccepted: true,
    },
    memory: [],
    save: { revision: 1 },
  };

  const put = await page.request.put(saveUrl(slot), {
    data: { payload },
    headers: { "content-type": "application/json" },
  });
  expect(put.ok(), `D1 seed PUT for ${outcome} must succeed (HTTP ${put.status()})`).toBe(true);

  const get = await page.request.get(saveUrl(slot), {
    headers: { accept: "application/json" },
  });
  expect(get.ok(), `D1 seed GET for ${outcome} must succeed (HTTP ${get.status()})`).toBe(true);
  expect(((await get.json()) as { payload?: unknown }).payload).toEqual(payload);
}

async function assertRestoredAction(
  page: Page,
  slot: string,
  actionId: ExpectedAction["actionId"],
): Promise<void> {
  await page.goto(`/aftersign/?slot=${encodeURIComponent(slot)}`, { waitUntil: "load" });
  await waitForReady(page);

  const action = page.locator(`button[data-orra-payback-action="${actionId}"]`);
  await expect(action).toBeVisible({ timeout: WAIT_MS });
  await expect(action).toBeEnabled();
  await expect(page.locator("button[data-orra-payback-action]")).toHaveCount(1);
  await expect.poll(
    () => page.evaluate(() => (window as unknown as { __game?: { save?: { authority?: string } } }).__game?.save?.authority),
    { timeout: WAIT_MS },
  ).toBe("server");
}

test.describe("Saint Orra payback survives D1-backed fresh sessions", () => {
  for (const expected of cases) {
    // Gated until the payback UI + verified save schema land. See the
    // header comment for the precise flip-criteria.
    test.fixme(`${expected.outcome} red-tag restores ${expected.actionId} in independent browser sessions`, async ({ browser }) => {
      test.setTimeout(90_000);
      const slot = `orra-payback-d1-${expected.outcome}-${Date.now()}`;

      const seedingContext = await newPhoneContext(browser);
      try {
        await seedRedTagReturn(await seedingContext.newPage(), slot, expected.outcome);
      } finally {
        await seedingContext.close();
      }

      const firstReturnContext = await newPhoneContext(browser);
      try {
        await assertRestoredAction(await firstReturnContext.newPage(), slot, expected.actionId);
      } finally {
        await firstReturnContext.close();
      }

      // A second fresh context is the reload boundary. The action must be
      // reconstructed from the same server record, not retained in memory by
      // the preceding page.
      const reloadedContext = await newPhoneContext(browser);
      try {
        await assertRestoredAction(await reloadedContext.newPage(), slot, expected.actionId);
      } finally {
        await reloadedContext.close();
      }
    });
  }
});
