import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN save persistence + slot isolation regression.
//
// SCOPE (what this spec DOES assert):
//   - A completed delivery writes an authoritative save (PUT /aftersign/save/…
//     returns 204), reloads rehydrate the exact payload (GET returns 200), and
//     the player can start a second delivery after reload.
//   - Two slots are isolated: the primary slot's save never appears under a
//     sibling slot (GET on the sibling slot returns 200 with
//     `{ payload: null, exists: false }` — the cold-slot contract after
//     #2227; see aftersign/server-authoritative-save.js).
//
// NOT IN SCOPE (what this spec does NOT assert — do not read "Worker-backed"
// into this file):
//   - A deployed Worker (miniflare / wrangler dev / staging) is NOT exercised
//     here. This spec runs against the vite-preview baseURL
//     (http://localhost:4374/aftersign/), which serves the Worker-shaped
//     /aftersign/save/* endpoints from aftersign/server-authoritative-save.js.
//     That handler is the same contract the Worker implements in
//     apps/web/src/aftersign/authoritativeSaveBackend.ts, but this test
//     never actually hits AftersignAuthoritativeSave. #2063's first AC
//     ("runs against Worker backend, not Vite middleware") therefore
//     remains open — see AI006 and the PR body for the Refs vs Closes
//     distinction. Filename and describe-block deliberately avoid the
//     word "Worker" to stop the overclaim flagged in AI007.
const WAIT_MS = 10_000;

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

test.describe("AFTERSIGN save persistence (vite-preview save surface)", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("persists a played delivery across reload without sharing another slot", async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const stamp = `${Date.now()}-${testInfo.workerIndex}`;
    const primarySlot = `save-persistence-${stamp}`;
    const otherSlot = `save-isolation-${stamp}`;
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
      // GET /aftersign/save/:playerId/:slot returns 200 with
      // { payload, exists: true } on a hot slot (#2227).
      expect(getResponse.status()).toBe(200);
      // Reload must rehydrate the exact payload the game last PUT. The
      // response body also carries `exists: true` to distinguish a hot
      // slot from a cold one that stored a null payload.
      expect((await getResponse.json()) as SavePayload & { exists: boolean }).toEqual({
        ...saved,
        exists: true,
      });
      await waitForBeat(primary, "io-next-job");
      await tap(primary, 'button[data-choice-id="deliver-packet"]');
      await waitForBeat(primary, "packet-offered");
      await expect(primary.locator("#offeredJobs button[data-offered-job-id]:visible").first()).toBeVisible();

      await boot(other, otherSlot);
      const otherSavePath = `/aftersign/save/local-slice-player/${encodeURIComponent(otherSlot)}`;
      const otherGet = await other.request.get(otherSavePath);
      // Cold slot: 200 with { payload: null, exists: false } (#2227).
      expect(otherGet.status()).toBe(200);
      expect(await otherGet.json()).toEqual({ payload: null, exists: false });
    } finally {
      await primary.close();
      await other.close();
    }
  });
});
