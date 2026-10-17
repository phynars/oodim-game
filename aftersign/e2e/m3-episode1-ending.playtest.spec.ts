import { expect, test, type Locator, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;
const PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

type Seed = {
  packet: { sealed: boolean; delivered: boolean; route: string | null; deliveredAt: null };
  delivery: { outcome: string };
  memory: Array<{ kind: string; subject: string; outcome: string }>;
};

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene
        ?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function expectDialogue(page: Page, beatId: string): Promise<string> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({ timeout: WAIT_MS });
  const line = page.locator("#line");
  await expect(line, `beat ${beatId} must render player-visible dialogue`).toBeVisible({
    timeout: WAIT_MS,
  });
  const text = (await line.innerText()).trim();
  expect(text, `beat ${beatId} dialogue must not be empty`).not.toBe("");
  return text;
}

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(`${selector}:not([disabled])`);
  await expect(control, `${selector} must be visible and enabled before the player taps it`).toBeVisible({
    timeout: WAIT_MS,
  });
  await control.tap();
}

async function seedMemory(page: Page, slot: string, seed: Seed): Promise<void> {
  const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(PLAYER_ID)}/${encodeURIComponent(slot)}`;
  const payload = {
    beat: "packet-offered",
    packet: seed.packet,
    delivery: seed.delivery,
    player: { id: PLAYER_ID, name: null, flags: { io_intro_seen: true }, routeRisk: null },
    memory: seed.memory,
    save: { revision: 1 },
  };

  const put = await page.request.put(saveUrl, {
    data: { payload },
    headers: { "content-type": "application/json" },
  });
  expect(put.ok(), `seed PUT for ${slot} must succeed`).toBe(true);

  const get = await page.request.get(saveUrl, { headers: { accept: "application/json" } });
  expect(get.ok(), `seed GET for ${slot} must succeed`).toBe(true);
  await expect(get.json()).resolves.toMatchObject({ payload });
}

async function playDelivery(page: Page, packetChoice: "acknowledge-kiosk" | "skip-kiosk-acknowledge"): Promise<void> {
  await expectDialogue(page, "packet-offered");
  await tap(page, "#packetButton");
  await expectDialogue(page, "packet-choice");
  await tap(page, `button[data-choice-id="${packetChoice}"]`);
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await expectDialogue(page, "io-return-recognition");
  await tap(page, 'button[data-return-reason="blunt"]');
  await expectDialogue(page, "return-tone-choice");
  await tap(page, 'button[data-choice-id="ask-for-next-job"]');
  await expectDialogue(page, "io-next-job");
  await tap(page, 'button[data-choice-id="deliver-packet"]');
}

async function endingSurface(page: Page): Promise<Locator> {
  const ending = page.locator('[data-episode-ending]:visible');
  await expect(ending, "Episode 1 must finish on a visible ending surface").toHaveCount(1, {
    timeout: WAIT_MS,
  });
  await expect(ending.locator("#line"), "ending must contain rendered dialogue").toBeVisible();
  await expect(ending.locator("#line")).not.toHaveText("");
  return ending;
}

async function visibleEndingActions(ending: Locator): Promise<string[]> {
  return ending.locator("button:not([disabled]):visible").evaluateAll((buttons) =>
    buttons.map((button) => `${button.getAttribute("data-choice-id") ?? ""}:${button.textContent?.trim() ?? ""}`),
  );
}

test.describe("M3 Episode 1 ending phone playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("two durable red-tag records play by visible taps into different endings", async ({ page }) => {
    test.setTimeout(120_000);
    const intactSlot = `m3-episode1-intact-${Date.now()}`;
    const openedSlot = `m3-episode1-opened-${Date.now()}`;

    // The only pre-play setup is durable server memory. All player decisions below
    // are locator.tap() calls against visible enabled controls.
    await seedMemory(page, intactSlot, {
      packet: { sealed: true, delivered: false, route: null, deliveredAt: null },
      delivery: { outcome: "unknown" },
      memory: [{ kind: "red-tag", subject: "saint-orra", outcome: "intact" }],
    });
    await seedMemory(page, openedSlot, {
      packet: { sealed: false, delivered: false, route: null, deliveredAt: null },
      delivery: { outcome: "opened" },
      memory: [{ kind: "red-tag", subject: "saint-orra", outcome: "opened" }],
    });

    await page.goto(`/aftersign/?slot=${intactSlot}`, { waitUntil: "load" });
    await waitForReady(page);
    await expectDialogue(page, "packet-offered");

    // Persistence is proved from the served page before the run continues.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await expectDialogue(page, "packet-offered");
    await expect(page.locator("#packetButton")).toHaveAttribute("data-sealed", "true");

    await playDelivery(page, "acknowledge-kiosk");
    const intactEnding = await endingSurface(page);
    const intactActions = await visibleEndingActions(intactEnding);

    await page.goto(`/aftersign/?slot=${openedSlot}`, { waitUntil: "load" });
    await waitForReady(page);
    await expectDialogue(page, "packet-offered");
    await expect(page.locator("#packetButton")).toHaveAttribute("data-sealed", "false");

    await playDelivery(page, "skip-kiosk-acknowledge");
    const openedEnding = await endingSurface(page);
    const openedActions = await visibleEndingActions(openedEnding);

    // Different copy is insufficient: records must expose different ending UI.
    const intactEndingId = await intactEnding.getAttribute("data-episode-ending");
    const openedEndingId = await openedEnding.getAttribute("data-episode-ending");
    expect(
      intactEndingId !== openedEndingId || JSON.stringify(intactActions) !== JSON.stringify(openedActions),
      "intact and opened red-tag records must end with a different visible ending element or action set",
    ).toBe(true);
  });
});
