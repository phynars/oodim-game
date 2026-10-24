import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN third remembering NPC — acknowledgment survives a real
// served-page reload (#2448).
//
// What is NEW here vs. the existing coverage:
//   - `aftersign-red-tag-recipient-served.spec.ts` (#2446) proves the
//     acknowledgment renders IN-SESSION right after the red-tag tap.
//     It never reloads.
//   - `apps/web/src/aftersign/harness/windowGameHarnessBoot.test.ts`
//     round-trips `save()` → `load()` in vitest through harness verbs,
//     not through the served page's cold-boot hydration.
// This spec covers the gap: after a tap-driven red-tag delivery, a
// real `page.reload()` must re-run the cold-boot hydration in
// `aftersign/main.js` (search `let aftersignVerticalSlice`, which reads
// `stored.redTagDeliveredToThirdNpc`), and the render block (search
// `#aftersignRedTagRecipientLine`) must still stamp the recognizes-player
// disposition. If the persisted flag is dropped from
// `createPersistHelpers`' payload or the cold-boot hydration stops
// reading it, the reloaded page falls back to "awaiting-delivery"
// and this spec goes red.
//
// Contract, not copy: the assertions target the data attributes the
// served render block owns (`data-aftersign-red-tag-recipient`
// disposition id and `data-aftersign-red-tag-recipient-count`).
// The authored line text comes from
// `resolveAftersignRememberingNpcDialogue` and is not hard-coded here,
// so a copy edit does not break this spec. The only text check is that
// the paragraph is non-empty and matches the text from before the reload.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;
const RECIPIENT_LINE = "#aftersignRedTagRecipientLine";
const DISPOSITION_ATTR = "data-aftersign-red-tag-recipient";
const COUNT_ATTR = "data-aftersign-red-tag-recipient-count";

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
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(
    `button[data-choice-id="${choiceId}"]:not([disabled])`,
  );
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

// Round one (blue packet) through the next-job handoff. This mirrors
// `aftersign-red-tag-recipient-served.spec.ts`.
async function reachNextJobFromBoot(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page
    .locator('button[data-return-reason="blunt"]:not([disabled])')
    .tap();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
}

test.describe("AFTERSIGN third remembering NPC — acknowledgment after served reload (#2448)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("red-tag delivery persists across page.reload() and the recipient still recognizes the player", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const slot = `red-tag-recipient-reload-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // (1) First visit, no flag set. The served page renders no
    // recipient line at all, and there is no recognizes-player
    // disposition anywhere in the DOM.
    await reachNextJobFromBoot(page);
    await expect(page.locator(RECIPIENT_LINE)).toHaveCount(0);
    await expect(
      page.locator(`[${DISPOSITION_ATTR}="recognizes-player"]`),
    ).toHaveCount(0);

    // (2) Red-tag delivery, tapped like a player would.
    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toHaveAttribute("data-packet-job", "red-tag");
    await packetButton.tap();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");

    const line = page.locator(RECIPIENT_LINE);
    await expect(line).toBeVisible({ timeout: WAIT_MS });
    await expect(line).toHaveAttribute(DISPOSITION_ATTR, "recognizes-player");
    await expect(line).toHaveAttribute(COUNT_ATTR, "1");
    const inSessionText = (await line.textContent())?.trim() ?? "";
    expect(inSessionText.length).toBeGreaterThan(0);

    // (3) Reload/return. This re-runs cold-boot hydration from the
    // persisted save for the same slot.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "io-return-recognition");

    // (4) The acknowledgment is still rendered after the reload. The
    // disposition id comes from the restored
    // `redTagDeliveredToThirdNpc` flag, not from in-memory session state.
    const reloadedLine = page.locator(RECIPIENT_LINE);
    await expect(reloadedLine).toBeVisible({ timeout: WAIT_MS });
    await expect(reloadedLine).toHaveAttribute(
      DISPOSITION_ATTR,
      "recognizes-player",
    );
    await expect(reloadedLine).toHaveAttribute(COUNT_ATTR, "1");
    await expect(reloadedLine).toHaveText(inSessionText);
  });
});
