import { expect, test, type Page } from "@playwright/test";

const WAIT_MS = 10_000;
// Default to the aftersign vite-preview baseURL (http://localhost:4374/aftersign/),
// which already serves the Worker-shaped /aftersign/save/* endpoints the
// sibling playtest specs hit. AFTERSIGN_WORKER_BASE_URL stays an override so a
// real Worker deployment can be targeted from CI if/when wired, but the spec
// is NOT allowed to silently skip in the default lane — a spec that never
// runs gates nothing (see playwright.config.ts header). AI006.
const workerBaseURL = process.env.AFTERSIGN_WORKER_BASE_URL
  ?? "http://localhost:4374/aftersign/";

type SavePayload = {
  payload: {
    beat: string;
    memory?: Array<{ kind: string; object: string }>;
  };
};

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector).first();
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await expect(control).toBeEnabled({ timeout: WAIT_MS });
  await control.tap();
}

async function boot(page: Page, slot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${encodeURIComponent(slot)}`, {
    waitUntil: "load",
  });
  await waitForBeat(page, "packet-offered");
}

async function completeDelivery(page: Page): Promise<SavePayload> {
  await tap(page, "button[data-offered-job-id]");
  await tap(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tap(page, 'button[data-choice-id="acknowledge-kiosk"]');

  const [response] = await Promise.all([
    page.waitForResponse((candidate) =>
      candidate.request().method() === "PUT"
      && new URL(candidate.url()).pathname.startsWith("/aftersign/save/"),
    ),
    tap(page, 'button[data-choice-id="deliver-packet"]'),
  ]);
  // PUT /aftersign/save/:playerId/:slot returns 204 No Content
  // (see apps/web/src/aftersign/authoritativeSaveBackend.ts and
  // aftersign/server-authoritative-save.js). GETs return 200.
  expect(response.status()).toBe(204);
  return response.request().postDataJSON() as SavePayload;
}

async function reachNextJob(page: Page): Promise<SavePayload> {
  await waitForBeat(page, "io-return-recognition");
  await tap(page, 'button[data-return-reason="blunt"]');
  await waitForBeat(page, "return-tone-choice");
  const [response] = await Promise.all([
    page.waitForResponse((candidate) =>
      candidate.request().method() === "PUT"
      && new URL(candidate.url()).pathname.startsWith("/aftersign/save/")
      && candidate.request().postDataJSON()?.payload?.beat === "io-next-job",
    ),
    tap(page, 'button[data-choice-id="ask-for-next-job"]'),
  ]);
  // PUT returns 204 (same handler as completeDelivery).
  expect(response.status()).toBe(204);
  await waitForBeat(page, "io-next-job");
  return response.request().postDataJSON() as SavePayload;
}

test.describe("AFTERSIGN Worker save persistence", () => {
  test.use({
    baseURL: workerBaseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("persists a played delivery across reload without sharing another slot", async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const stamp = `${Date.now()}-${testInfo.workerIndex}`;
    const primarySlot = `worker-persistence-${stamp}`;
    const otherSlot = `worker-isolation-${stamp}`;
    const primary = await browser.newPage();
    const other = await browser.newPage();

    try {
      await boot(primary, primarySlot);
      await completeDelivery(primary);
      const saved = await reachNextJob(primary);

      const savePath = `/aftersign/save/local-slice-player/${encodeURIComponent(primarySlot)}`;
      const [getResponse] = await Promise.all([
        primary.waitForResponse((candidate) =>
          candidate.request().method() === "GET"
          && new URL(candidate.url()).pathname === savePath,
        ),
        primary.reload({ waitUntil: "load" }),
      ]);
      // GET /aftersign/save/:playerId/:slot returns 200 with { payload }.
      expect(getResponse.status()).toBe(200);
      // Reload must rehydrate the exact payload the game last PUT.
      expect((await getResponse.json()) as SavePayload).toEqual(saved);
      await waitForBeat(primary, "io-next-job");
      await tap(primary, 'button[data-choice-id="deliver-packet"]');
      await waitForBeat(primary, "packet-offered");
      await expect(primary.locator("#offeredJobs button[data-offered-job-id]:visible").first()).toBeVisible();

      await boot(other, otherSlot);
      const otherSavePath = `/aftersign/save/local-slice-player/${encodeURIComponent(otherSlot)}`;
      const otherGet = await other.request.get(otherSavePath);
      expect(otherGet.status()).toBe(404);
    } finally {
      await primary.close();
      await other.close();
    }
  });
});
