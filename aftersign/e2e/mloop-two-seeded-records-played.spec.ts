import { expect, test, type Page } from "@playwright/test";

// M-LOOP acceptance: two authoritative memory records must expose different
// rendered actions. All story progress is made by clicking visible controls.

const WAIT_MS = 30_000;
const COLD_START_MS = 90_000;
const PHONE_VIEWPORT = { width: 390, height: 844 };
const PLAYER_ID = "local-slice-player";

type Seed = {
  name: string;
  save: Record<string, unknown>;
};

const freshSave: Record<string, unknown> = {
  beat: "packet-offered",
  packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
  delivery: { outcome: "unknown" },
  player: { id: "mloop-two-seeded-fresh", name: null, flags: { io_intro_seen: true } },
  memory: [],
  save: { revision: 0 },
};

const completedSave: Record<string, unknown> = {
  beat: "packet-offered",
  packet: { delivered: true, route: "blue rainline", sealed: true, deliveredAt: "2026-01-01T00:00:00.000Z" },
  delivery: { outcome: "sealed" },
  player: { id: "mloop-two-seeded-completed", name: null, flags: { io_intro_seen: true } },
  memory: [
    {
      id: "mloop-two-seeded-delivery",
      kind: "delivery-outcome",
      subject: "io",
      object: "sealed",
      sessionId: "mloop-two-seeded-completed-session",
    },
    {
      id: "mloop-two-seeded-route",
      kind: "route-attention",
      subject: "io",
      object: "done",
      sessionId: "mloop-two-seeded-completed-session",
    },
  ],
  save: { revision: 1 },
};

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choice: string): Promise<void> {
  const control = page.locator(`button[data-choice-id="${choice}"]:not([disabled])`).first();
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await control.click();
}

async function offeredAction(page: Page): Promise<{ memory: string; actionId: string }> {
  const tray = page.locator("#offeredJobs");
  await expect(tray).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });
  const memory = await tray.getAttribute("data-mloop-divergence-memory");
  expect(memory).not.toBeNull();

  const action = tray.locator("button[data-offered-job-id]:not([disabled])").first();
  await expect(action).toBeVisible({ timeout: WAIT_MS });
  const actionId = await action.getAttribute("data-offered-job-id");
  expect(actionId).not.toBeNull();
  await action.click();
  await expect(action).toHaveAttribute("data-aftersign-job-take", "armed");
  return { memory: memory!, actionId: actionId! };
}

async function playRound(page: Page): Promise<void> {
  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");

  const tone = page.locator('button[data-return-reason="blunt"]:not([disabled])').first();
  await expect(tone).toBeVisible({ timeout: WAIT_MS });
  await tone.click();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
}

async function playTwoRounds(page: Page, seed: Seed): Promise<Array<{ memory: string; actionId: string }>> {
  const slot = `mloop-two-seeded-${seed.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await page.request.put(
    `/aftersign/save/${encodeURIComponent(PLAYER_ID)}/${encodeURIComponent(slot)}`,
    { data: { payload: seed.save }, headers: { "content-type": "application/json" } },
  );
  expect(response.ok(), `${seed.name} authoritative seed must be accepted`).toBe(true);

  await page.goto(`/aftersign/?slot=${encodeURIComponent(slot)}`, { waitUntil: "load" });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");

  const first = await offeredAction(page);
  await playRound(page);
  const second = await offeredAction(page);
  await playRound(page);
  return [first, second];
}

test.describe("M-LOOP two seeded durable records", () => {
  test.use({ viewport: PHONE_VIEWPORT, isMobile: true, hasTouch: true });

  test("two played rounds per durable record retain divergent rendered job actions", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const fresh = await playTwoRounds(page, { name: "fresh", save: freshSave });
    const completed = await playTwoRounds(page, { name: "completed", save: completedSave });

    expect(fresh[0].memory).not.toBe(completed[0].memory);
    expect(fresh[0].actionId).not.toBe(completed[0].actionId);
    expect(fresh[1].memory).not.toBe(completed[1].memory);
    expect(fresh[1].actionId).not.toBe(completed[1].actionId);
  });
});
