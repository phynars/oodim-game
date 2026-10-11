import { expect, test, type Page } from "@playwright/test";

// M3-E1 (#2260) — Saint Orra's red-tag payback. The player's red-tag
// outcome must change which action id is enabled when they come back
// to Orra. The issue's acceptance criteria:
//   A. Two records with different outcomes expose different enabled
//      action ids (assert ELEMENT IDS, not copy).
//   B. The payback survives a reload (server-authoritative).
//   C. The new action is a real `button` with a stable `data-*` id.
//
// This spec does NOT assert any "ending beat" renders — the engine's
// `AftersignStoryBeatId` union terminates at `io-next-job`. Walking
// into an ending beat belongs to #2259's consumer spec.
//
// WALK NOTE (Soren PR #2264 review): the payback button only renders
// when `state.delivery.id === "red-tag"`, and that id is only armed
// on the SECOND round — through `ask-for-next-job` →
// `accept-second-packet` → round-two `deliver-packet`. Round one's
// `io-return-recognition` is a `blue-packet` return, where no
// payback button is expected. An earlier draft of this spec stopped
// at the round-one return beat and timed out waiting for the button;
// this version drives two full rounds.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

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

// Walk ROUND 1 from a fresh slot through `io-return-recognition`
// (blue-packet) → `return-tone-choice` → `ask-for-next-job` →
// `io-next-job`, then arm the red-tag second packet and drive ROUND
// 2 to its own `io-return-recognition` — which is the first beat
// where `state.delivery.id === "red-tag"` and the Orra payback
// button is rendered. The round-one walk mirrors the canonical
// sequence pinned by `aftersign-mloop-two-round.playtest.spec.ts`;
// the round-two walk mirrors `red-tag-second-packet-round-2.spec.ts`
// (accept the red-tag packet at `io-next-job`, deliver, play the
// round through acknowledge → deliver → recognition).
async function reachRedTagIoReturnRecognition(page: Page): Promise<void> {
  await waitForReady(page);

  // Round 1 — fresh slot. The sole offered row is job-safe-delivery
  // (durable memory is "fresh"); taking it carries us through the
  // blue-packet route to the first io-return-recognition.
  await waitForBeat(page, "packet-offered");
  const firstRoundOffer = page
    .locator("#offeredJobs")
    .locator('button[data-offered-job-id="job-safe-delivery"]');
  await expect(firstRoundOffer).toBeVisible({ timeout: WAIT_MS });
  await firstRoundOffer.tap();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");

  // Pick any return posture to pass through — `blunt` is the same
  // control the two-round spec uses. The posture does not gate the
  // payback branch; the next-job hand-off does.
  const bluntReturn = page.locator(
    'button[data-return-reason="blunt"]:not([disabled])',
  );
  await expect(bluntReturn).toBeVisible({ timeout: WAIT_MS });
  await bluntReturn.tap();
  await waitForBeat(page, "return-tone-choice");

  // `ask-for-next-job` arms `state.delivery.id = "red-tag"` and
  // advances to `io-next-job`. From here, `accept-second-packet`
  // commits the hand-off and `deliver-packet` re-enters round-two
  // `packet-offered` with the red-tag identity preserved.
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "accept-second-packet");
  await tapChoice(page, "deliver-packet");

  // Round 2 — the red-tag identity is already armed. The offered
  // tray exposes two red-tag jobs (`job-night-transfer` /
  // `job-signed-receipt`); the choice doesn't gate the payback —
  // we drive night-transfer, same as the two-round spec's round-two
  // walk.
  await waitForBeat(page, "packet-offered");
  const secondRoundOffer = page
    .locator("#offeredJobs")
    .locator('button[data-offered-job-id="job-night-transfer"]');
  await expect(secondRoundOffer).toBeVisible({ timeout: WAIT_MS });
  await secondRoundOffer.tap();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");

  // Guard the invariant the whole spec depends on: this
  // `io-return-recognition` is the red-tag one. If the guard trips,
  // the walk — not the payback render — is wrong.
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { delivery?: { id?: string } } })
        .__game?.delivery?.id === "red-tag",
    undefined,
    { timeout: WAIT_MS },
  );
}

test.describe("Saint Orra payback — red-tag outcome gates the next action", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  // Criteria A + C: at round-two `io-return-recognition` with the
  // sealed red-tag outcome, the enabled payback action is rendered
  // as a real `button` with the stable id
  // `data-orra-payback-action="carry-name-to-bell-archive"`. Asserts
  // the element id, not copy.
  //
  // The opened-outcome branch is not driven here — the "open" gesture
  // on today's served kiosk is a timed packet hold that is
  // non-deterministic in CI. #2260's "two records with different
  // outcomes" criterion is covered by the pure module
  // (`aftersign/src/orraPayback.js`) and its unit coverage; the
  // played-not-driven proof below anchors the sealed branch, which
  // is the one the issue names as the enabling outcome.
  test("sealed red-tag outcome exposes the carry-name payback action with a stable element id", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto(
      `/aftersign/?slot=orra-payback-sealed-${Date.now()}`,
      { waitUntil: "load" },
    );
    await reachRedTagIoReturnRecognition(page);

    const carryName = page.locator(
      'button[data-orra-payback-action="carry-name-to-bell-archive"]',
    );
    await expect(carryName).toBeVisible({ timeout: WAIT_MS });
    await expect(carryName).toBeEnabled();

    // The leave-with-Orra alternative must NOT be exposed on the
    // sealed branch — "two different outcomes expose different
    // enabled action ids" (criterion A). The sealed branch exposes
    // exactly one.
    const leaveWithOrra = page.locator(
      'button[data-orra-payback-action="leave-name-with-orra"]',
    );
    await expect(leaveWithOrra).toHaveCount(0);
  });

  // Criterion B: the payback action survives a reload. We reach the
  // red-tag `io-return-recognition` beat, assert the carry-name
  // button is visible, reload against the SAME slot, and assert the
  // button is visible AGAIN — proving that `delivery.id === "red-tag"`
  // and `scene.beat === "io-return-recognition"` both round-trip
  // through the authoritative save. Before this PR, boot and
  // `applyRestoredState` both collapsed `delivery.id` back to
  // `"blue-packet"` on restore, which would silently remove the
  // payback button on reload.
  test("the payback action id survives a reload against the same slot", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const slot = `orra-payback-reload-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await reachRedTagIoReturnRecognition(page);

    const carryName = page.locator(
      'button[data-orra-payback-action="carry-name-to-bell-archive"]',
    );
    await expect(carryName).toBeVisible({ timeout: WAIT_MS });
    await expect(carryName).toBeEnabled();

    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "io-return-recognition");

    // Delivery identity must survive the reload. Without this guard
    // a regression that re-collapses `delivery.id` to "blue-packet"
    // on restore would read as a bare "button missing" failure.
    await page.waitForFunction(
      () =>
        (window as unknown as { __game?: { delivery?: { id?: string } } })
          .__game?.delivery?.id === "red-tag",
      undefined,
      { timeout: WAIT_MS },
    );

    const carryNameAfterReload = page.locator(
      'button[data-orra-payback-action="carry-name-to-bell-archive"]',
    );
    await expect(carryNameAfterReload).toBeVisible({ timeout: WAIT_MS });
    await expect(carryNameAfterReload).toBeEnabled();
  });
});
