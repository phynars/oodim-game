import { expect, test, type Page, type Locator } from "@playwright/test";

import { expectedIoRecognitionLine } from "../../aftersign/src/ioRecognitionDialogue";

// three.js needs WebGL; force SwiftShader like `aftersign-save.spec.ts`
// (its `test.use({ launchOptions: ... })`) so a headless CI runner
// without a GPU still boots the deployed page.
test.use({
  launchOptions: {
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    ],
  },
});

type AftersignWindow = {
  __game?: { version?: number; player?: { id?: string } };
};

/**
 * AFTERSIGN production save+reload gate (prod-smoke lane).
 *
 * Why this spec lives HERE, not in `aftersign/e2e/`:
 * - `aftersign/playwright.config.ts` boots a vite preview webServer and
 *   points `baseURL` at `http://localhost:4374/aftersign/`. That lane
 *   verifies the LOCAL build, not the deployed Worker.
 * - This file sits in `e2e-shared/prod-smoke/`, whose
 *   `playwright.config.ts` has NO webServer and reads `baseURL` from
 *   `SMOKE_BASE_URL` (default `https://game.oodim.com`). It is executed
 *   by `npm run test:smoke`, which `.github/workflows/deploy.yml` runs
 *   on EVERY push to `main`:
 *     deploy.yml:86 → `SMOKE_BASE_URL=https://game.oodim.com npm run test:smoke`
 *   So this gate runs automatically after every production deploy — no
 *   extra env var, no new workflow, no operator coordination required.
 *   To smoke staging instead, set `SMOKE_BASE_URL=https://staging...`.
 *
 * What this spec PROVES that the sibling smokes don't:
 * - `aftersign-save.spec.ts` already exercises the Worker's save
 *   endpoint directly (PUT→GET→DELETE round-trip) and the per-visitor
 *   identity. That proves the storage API works and that the page
 *   boots with an identity.
 * - What NEITHER sibling proves on prod: that the auto-save fired by
 *   the `deliver-packet` tap at `packet-delivered` actually RESTORES
 *   that beat after a browser reload — i.e. the full save → persist →
 *   boot → restore → render loop on the deployed build. This spec
 *   closes that gap with real taps on visible elements.
 *
 * Flow mirrors `aftersign/e2e/aftersign-recognition-reload.playtest.spec.ts`
 * (the local preview-build equivalent):
 *   1. Fresh slot → tap `#packetButton` at `packet-offered`.
 *   2. Tap `skip-kiosk-acknowledge` (keeps `routeListened=false` so the
 *      RETURNING tier of `ioRecognitionDialogue` speaks).
 *   3. Tap `deliver-packet` — this is the tap that triggers the
 *      auto-save at `packet-delivered`.
 *   4. Reload the SAME browser context.
 *   5. Assert the restored beat is `packet-delivered` (NOT the fresh
 *      opener). That is the save-restore proof against prod.
 *   6. Tap `#deliverButton` ("Return to Io") on the restored surface
 *      to prove it is interactive, and assert the authored RETURNING
 *      line via `expectedIoRecognitionLine("sealed", false)` — same
 *      copy-contract hook the local spec uses, so if the deployed
 *      bundle drops/garbles the recognition dialogue module, this
 *      fails loudly (not just a beat-id check).
 *
 * `hasTouch: true` is required on phone context — see
 * `aftersign/e2e/io-voice-served.spec.ts:74-80` for the sibling rule.
 */

const PHONE_VIEWPORT = { width: 390, height: 844 };
// Prod cold-start includes the deployed vite bundle + three.js + the
// Worker-backed save round-trip. Keep the ceiling generous but finite.
const TEST_TIMEOUT_MS = 240_000;
const WAIT_MS = 90_000;

const SEALED_RECOGNITION_LINE = expectedIoRecognitionLine("sealed", false);

function slotUrl(slot: string): string {
  // `baseURL` resolves `SMOKE_BASE_URL` (see
  // `e2e-shared/prod-smoke/playwright.config.ts`). A relative target
  // keeps staging vs prod a one-env-var switch.
  return `/aftersign/index.html?slot=${encodeURIComponent(slot)}`;
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

test.describe("aftersign: production save+reload (prod-smoke)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("deployed build auto-saves at packet-delivered and restores it after a phone reload", async ({
    page,
  }, testInfo) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    // Dedicated per-run/per-retry slot. We fold BOTH `testInfo.retry`
    // AND `Date.now()` into the name so that:
    //   - A retry of the same job gets a FRESH slot (otherwise
    //     attempt 1's `packet-delivered` save would be restored on
    //     retry and the test would skip past `packet-offered`, which
    //     is exactly the wrong-reason-fail Soren flagged).
    //   - A workflow re-run of the SAME `GITHUB_RUN_ID` also gets a
    //     fresh slot — `Date.now()` guarantees uniqueness across
    //     re-runs because `prod-smoke/aftersign-save.spec.ts` is the
    //     sibling that already uses the retry-index pattern.
    //   - And the `finally` block below DELETEs the slot regardless of
    //     outcome, so even a crashing retry doesn't leave the next run
    //     a hot save.
    const run = process.env.GITHUB_RUN_ID ?? String(Date.now());
    const slot = `prod-save-reload-${run}-${testInfo.retry}-${Date.now()}`;

    try {
      const response = await page.goto(slotUrl(slot), { waitUntil: "load" });
      expect(
        response?.ok(),
        "the deployed aftersign page must respond with HTTP 2xx",
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
      // `packet-delivered` — this is the state the production build has
      // to persist across the reload below.
      await tapChoice(page, "deliver-packet");
      await waitForBeat(page, "packet-delivered");

      // --- Reload the SAME context. If the production build has broken
      // persistence (bad bundler config, missing storage adapter, wrong
      // CSP, Worker save endpoint 404'ing), the restored beat falls back
      // to `packet-offered` and the next assertion fails.
      await page.reload({ waitUntil: "load" });
      await waitForBeat(page, "packet-delivered");

      // --- Prove the restored surface is interactive by tapping the ONE
      // affordance that advances from a restored `packet-delivered`
      // (`#deliverButton`, labelled "Return to Io").
      const advance = page.locator("#deliverButton");
      await expect(
        advance,
        "#deliverButton should be visible after restoring packet-delivered",
      ).toBeVisible({ timeout: WAIT_MS });
      await expect(advance).toBeEnabled({ timeout: WAIT_MS });
      await expect(advance).toHaveText("Return to Io", { timeout: WAIT_MS });
      await advance.tap();

      // --- The recognition beat has to render the AUTHORED returning
      // line, not an empty / fallback string. Going through
      // `expectedIoRecognitionLine` keeps the copy contract owned by a
      // single module (the local-preview sibling asserts the same way),
      // so a prod bundle that drops `ioRecognitionDialogue` fails here.
      await waitForBeat(page, "io-return-recognition");
      await expect(page.locator("#line")).toHaveText(SEALED_RECOGNITION_LINE, {
        timeout: WAIT_MS,
      });
      await expect(
        page.getByRole("button", { name: "Kind return", exact: true }),
        "the authored return-tone control should render on the deployed build",
      ).toBeVisible({ timeout: WAIT_MS });
    } finally {
      // Clean up the save slot on the deployed Worker — same discipline
      // as `aftersign-save.spec.ts`'s DELETE-in-finally. The save is
      // keyed by the per-visitor capability id, which we read off the
      // page before tearing down (see per-visitor-identity.spec.ts for
      // the same read-id-then-delete pattern). We swallow errors here:
      // the primary assertions above own the pass/fail signal, and a
      // flaky cleanup must never mask the real failure.
      try {
        const playerId = await page.evaluate(
          () => (window as unknown as AftersignWindow).__game?.player?.id ?? null,
        );
        if (playerId) {
          await page.request.delete(
            `/aftersign/save/${encodeURIComponent(playerId)}/${encodeURIComponent(slot)}`,
          );
        }
      } catch {
        // best-effort cleanup; see note above.
      }
    }
  });
});
