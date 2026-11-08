import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN — storage write failure must not break play (PR #2714).
//
// `createStoragePersistence().writeStored` in
// aftersign/src/runtime/persistence.js now catches a throwing
// `storage.setItem` (quota exceeded, private mode, disabled storage)
// and reports `false`; `persist()` then skips stamping
// `save.lastPersistedAt`. Before the fix the throw escaped from
// the persist call inside the tap handler, so a player whose browser
// refused storage writes could tap and nothing would visibly advance.
//
// This spec plays the served page with real taps while every
// `localStorage.setItem` throws, and asserts what a player SEES:
// the story line visibly advances beat by beat, no uncaught page
// error fires, and a hard reload still boots a playable scene. The
// only `window.__game` read is the scene-ready gate.

const WAIT_MS = 10_000;
const COLD_START_MS = 60_000;
const PHONE_VIEWPORT = { width: 375, height: 812 } as const;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should visibly reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(
    choice,
    `choice "${choiceId}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

test.describe("AFTERSIGN storage write failure — played (#2714)", () => {
  test("taps keep advancing the visible story and reload still boots when localStorage.setItem throws", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    await page.setViewportSize(PHONE_VIEWPORT);

    // Every storage write on this page fails, the way a full quota or a
    // locked-down private window fails. Reads keep working (they return
    // whatever is there — nothing, on a fresh context).
    await page.addInitScript(() => {
      const failingSetItem = function setItem(): never {
        throw new DOMException("storage quota exceeded", "QuotaExceededError");
      };
      Object.defineProperty(Storage.prototype, "setItem", {
        configurable: true,
        writable: true,
        value: failingSetItem,
      });
    });

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const slot = `storage-write-failure-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // Played input: the same opening taps as job-offer-route-risk-copy-played.
    await waitForBeat(page, "packet-offered");
    await page.locator("#job-offer-job-safe-delivery").click();
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");

    expect(
      pageErrors.filter((message) => /quota|setItem|storage/i.test(message)),
      "a failed storage write must not surface as an uncaught page error",
    ).toEqual([]);

    // Hard reload with storage still failing: the game must boot to a
    // playable, visible beat instead of a dead page.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await expect(
      page.locator("[data-beat-id]").first(),
      "a story beat must be visible after reload with failing storage",
    ).toBeVisible({ timeout: WAIT_MS });

    expect(
      pageErrors.filter((message) => /quota|setItem|storage/i.test(message)),
      "reload with failing storage must not surface an uncaught page error",
    ).toEqual([]);
  });
});
