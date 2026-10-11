import { expect, test, type Page } from "@playwright/test";

const WAIT_MS = 10_000;

type GameReadout = {
  scene: { ready: boolean; beat: string };
  save: { authority: string; dirty: boolean };
};

type EndingRecord = {
  name: "orra-intact" | "tag-opened";
  slot: string;
  facts: Array<{ id: string; kind: string; subject: string; object: string; sessionId: string }>;
};

async function game(page: Page): Promise<GameReadout> {
  return page.evaluate(() => (window as unknown as { __game: GameReadout }).__game);
}

async function waitForDialogue(page: Page, previous?: string): Promise<string> {
  const line = page.locator("#line");
  await expect(page.locator("#speaker")).toBeVisible({ timeout: WAIT_MS });
  await expect(line).toBeVisible({ timeout: WAIT_MS });
  await expect(line).not.toHaveText(/^\s*$/, { timeout: WAIT_MS });
  if (previous) await expect(line).not.toHaveText(previous, { timeout: WAIT_MS });
  return (await line.innerText()).trim();
}

async function tapVisibleEnabled(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector).first();
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await expect(control).toBeEnabled({ timeout: WAIT_MS });
  await control.tap();
}

async function tapFirstChoice(page: Page): Promise<void> {
  const controls = page.locator("button[data-choice-id]:visible");
  await expect(controls.first()).toBeVisible({ timeout: WAIT_MS });
  await expect(controls.first()).toBeEnabled({ timeout: WAIT_MS });
  await controls.first().tap();
}

async function actionSet(page: Page): Promise<string[]> {
  const controls = page.locator("button:visible");
  await expect(controls.first()).toBeVisible({ timeout: WAIT_MS });
  return controls.evaluateAll((buttons) => buttons
    .filter((button) => !(button as HTMLButtonElement).disabled)
    .map((button) => button.getAttribute("data-choice-id")
      ?? button.getAttribute("data-offered-job-id")
      ?? button.getAttribute("data-return-reason")
      ?? button.id
      ?? button.textContent?.trim())
    .filter((value): value is string => Boolean(value))
    .sort());
}

test.describe("M3 Episode 1 ending on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  // Pending until #2261 writes the Episode 1 ending beats. The product plan
  // (docs/plan/product-plan.md § M3-E1 story map) records: "No ending beats
  // exist on paper. #2261 writes them under Io's voice lock." Until that
  // lands, this spec asserts a beat the served page cannot reach, so it is
  // gated as test.fixme — the gate re-arms the moment #2261 ships the
  // endings. Do NOT delete; flip back to `test(` when #2261 merges.
  test.fixme("two durable red-tag records reach distinct served-page endings by taps", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const stamp = `${Date.now()}-${testInfo.workerIndex}-${testInfo.retry}`;
    const playerId = `m3-ending-${stamp}`;
    const records: EndingRecord[] = [
      {
        name: "orra-intact",
        slot: `m3-orra-${stamp}`,
        facts: [{ id: "red-tag-intact", kind: "red-tag", subject: "saint-orra", object: "intact", sessionId: "seeded" }],
      },
      {
        name: "tag-opened",
        slot: `m3-opened-${stamp}`,
        facts: [{ id: "red-tag-opened", kind: "red-tag", subject: "saint-orra", object: "opened", sessionId: "seeded" }],
      },
    ];
    const endings = new Map<string, string[]>();

    for (const record of records) {
      const payload = {
        beat: "packet-offered",
        packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
        delivery: { outcome: "unknown" },
        player: { id: playerId, name: null, flags: { io_intro_seen: true } },
        memory: record.facts,
        save: { revision: 1 },
      };
      const saveUrl = `/aftersign/save/${encodeURIComponent(playerId)}/${encodeURIComponent(record.slot)}`;
      const seeded = await page.request.put(saveUrl, { data: { payload } });
      expect(seeded.ok(), `${record.name} seed saves`).toBe(true);
      expect((await (await page.request.get(saveUrl)).json()).payload).toEqual(payload);

      await page.goto(`/aftersign/?slot=${record.slot}&player=${encodeURIComponent(playerId)}`, { waitUntil: "load" });
      await page.waitForFunction(() => (window as unknown as { __game?: GameReadout }).__game?.scene.ready, undefined, { timeout: WAIT_MS });
      let line = await waitForDialogue(page);

      // The player follows the live route with touchscreen controls only. A
      // dialogue assertion accompanies every observed transition; __game is
      // used only to prove the post-reload save authority.
      for (let step = 0; step < 24; step += 1) {
        const beat = (await game(page)).scene.beat;
        if (/episode[- ]?1.*ending|ending/i.test(beat)) break;
        const packet = page.locator("#packetButton:visible");
        if (await packet.count()) {
          await tapVisibleEnabled(page, "#packetButton");
        } else {
          await tapFirstChoice(page);
        }
        line = await waitForDialogue(page, line);
        if (step === 3) {
          await page.reload({ waitUntil: "load" });
          await expect.poll(async () => (await game(page)).save, { timeout: WAIT_MS })
            .toEqual({ authority: "server", dirty: false });
          line = await waitForDialogue(page);
        }
      }

      const endingBeat = (await game(page)).scene.beat;
      expect(endingBeat, `${record.name} reaches an Episode 1 ending beat`).toMatch(/episode[- ]?1.*ending|ending/i);
      await waitForDialogue(page);
      endings.set(record.name, await actionSet(page));
    }

    expect(endings.get("orra-intact"), "intact tag ending has actions").not.toEqual([]);
    expect(endings.get("tag-opened"), "opened tag ending has actions").not.toEqual([]);
    expect(endings.get("orra-intact"), "the two records cannot collapse into one ending action set")
      .not.toEqual(endings.get("tag-opened"));
  });
});
