import { expect, test, type Page, type Locator } from "@playwright/test";

/**
 * PRODUCTION SAVE OPERATOR GATE
 *
 * Purpose: when an operator deploys a new AFTERSIGN build, this spec runs
 * against the deployed URL and PROVES — with real taps on the rendered
 * phone surface — that the auto-save at `packet-delivered` actually
 * persists across a page reload on the live build. The local e2e suite
 * (aftersign-recognition-reload.playtest.spec.ts) proves the same contract
 * against the preview build; this gate exists so a production deploy that
 * silently broke persistence (bad bundler config, missing storage adapter,
 * wrong CSP) is caught BEFORE a player hits it.
 *
 * Why it is still env-gated: the spec needs a deployed URL the operator
 * has coordinated — running it on every CI commit would hammer production
 * and the slot query parameter would pollute real player storage keys.
 * Operators set `AFTERSIGN_PRODUCTION_URL` to the base URL that serves
 * `/aftersign/index.html` on the deploy they want to verify (e.g.
 * `AFTERSIGN_PRODUCTION_URL=https://aftersign.example.com npx playwright
 * test production-save-operator-gate`). Without it the spec skips, by
 * design — a local `npm test` is not a production save verification.
 *
 * This mirrors the tap flow of
 * `aftersign/e2e/aftersign-recognition-reload.playtest.spec.ts` so the
 * production gate exercises the same contract the preview suite pins:
 *   1. Fresh slot → tap `#packetButton` at `packet-offered`.
 *   2. Tap `skip-kiosk-acknowledge` then `deliver-packet` at
 *      `packet-choice`. The `deliver-packet` tap triggers the auto-save
 *      at `packet-delivered`.
 *   3. Reload the SAME browser context.
 *   4. Verify the restored beat is `packet-delivered` (NOT the fresh
 *      opener beat) — this is the save-restore proof.
 *   5. Tap `#deliverButton` ("Return to Io") to confirm the restored
 *      state is interactive (not a frozen render) and advances into
 *      `io-return-recognition`.
 *
 * `hasTouch: true` is required on phone context; see
 * io-voice-served.spec.ts:74-80 for the same requirement everywhere.
 */

const productionBaseUrl = process.env.AFTERSIGN_PRODUCTION_URL;

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 240_000;
const WAIT_MS = 90_000;

function buildProductionTargetUrl(baseUrl: string, slot: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const path = trimmed.endsWith("/aftersign/index.html")
    ? trimmed
    : `${trimmed}/aftersign/index.html`;
  return `${path}?slot=${encodeURIComponent(slot)}`;
}

async function waitForBeat(page: Page, beatId: string): Promise<Locator> {
  const beatNode = page.locator(`[data-beat-id="${beatId}"]`);
  await expect(
    beatNode,
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
  return beatNode;
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(
    choice,
    `visible dialogue control for "${choiceId}" should be present`,
  ).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

test.describe("production save operator gate", () => {
  test.skip(
    !productionBaseUrl,
    "Set AFTERSIGN_PRODUCTION_URL to the deployed base URL during an operator-coordinated live save verification.",
  );

  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("the deployed build auto-saves at packet-delivered and restores it after a phone reload", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    // A per-run slot keeps this gate from colliding with real player
    // storage keys on the production origin.
    const slot = `operator-gate-${Date.now()}`;
    const target = buildProductionTargetUrl(productionBaseUrl!, slot);

    const response = await page.goto(target, { waitUntil: "load" });
    expect(
      response?.ok(),
      `production URL ${target} should respond with HTTP 2xx`,
    ).toBe(true);

    // --- Play from a fresh save to packet-delivered via taps only.
    await waitForBeat(page, "packet-offered");
    const packet = page.locator("#packetButton");
    await expect(
      packet,
      "#packetButton should be visible at packet-offered",
    ).toBeVisible({ timeout: WAIT_MS });
    await packet.tap();

    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "skip-kiosk-acknowledge");
    // The `deliver-packet` tap is what triggers the auto-save at
    // `packet-delivered` — this is the state we need the production
    // build to persist across the reload below.
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");

    // --- Reload the SAME context. Auto-save fired on the `deliver-packet`
    // tap, so the restored beat must be `packet-delivered`. If the
    // production build has broken persistence, this will fall back to
    // `packet-offered` (the fresh-session opener) and the next assertion
    // fails.
    await page.reload({ waitUntil: "load" });
    await waitForBeat(page, "packet-delivered");

    // --- Prove the restored surface is interactive (not a frozen render)
    // by taking the ONE affordance that advances from a restored
    // `packet-delivered`: tap `#deliverButton` ("Return to Io").
    const advance = page.locator("#deliverButton");
    await expect(
      advance,
      "#deliverButton should be visible after restoring packet-delivered",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(advance).toBeEnabled({ timeout: WAIT_MS });
    await expect(advance).toHaveText("Return to Io", { timeout: WAIT_MS });
    await advance.tap();

    await waitForBeat(page, "io-return-recognition");
  });
});
