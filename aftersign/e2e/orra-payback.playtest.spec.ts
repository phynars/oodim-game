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
  // `actionTimeout` bounds EVERY tap in the two-round walk, so a stall
  // names the exact step instead of burning the whole 180s budget
  // (Soren PR #2264 review: "diagnose where the walk stalls").
  test.use({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
    actionTimeout: WAIT_MS,
  });

  // Criteria A + C: at round-two `io-return-recognition` with the
  // sealed red-tag outcome, the enabled payback action is rendered
  // as a real `button` with the stable id
  // `data-orra-payback-action="carry-name-to-bell-archive"`. Asserts
  // the element id, not copy. Tapping the button commits the
  // outcome, which lands on three observable surfaces:
  //   - `state.player.orraPaybackAction` records the chosen id
  //     (durable; survives reload — the reload spec below pins it).
  //   - The button stamps `data-orra-payback-committed="<id>"` so
  //     the DOM proof is independent of a yet-unrendered ending beat.
  //   - The forward-hook ending-beat id (`ending-bell-archive`) is
  //     surfaced as `data-orra-payback-ending` for #2259's consumer.
  //
  // The opened-outcome branch is not driven here — the "open" gesture
  // on today's served kiosk is a timed packet hold that is
  // non-deterministic in CI. #2260's "two records with different
  // outcomes" criterion is covered by the pure module
  // (`aftersign/src/orraPayback.js`) and its unit coverage in
  // `aftersign/src/orraPayback.test.ts` (registered in
  // `aftersign/pure-runner.ts` under `runOrraPaybackChecks`); the
  // played-not-driven proof below anchors the sealed branch, which
  // is the one the issue names as the enabling outcome, AND taps
  // the button to prove the commit lands on a surface the player
  // can observe.
  test("sealed red-tag outcome exposes the carry-name payback action with a stable element id and the tap commits durably", async ({
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

    // Soren PR #2264 review AI006: the tap must land on a surface
    // nothing silently drops. Prior drafts routed the commit through
    // `setBeat("ending-bell-archive")` where no renderer owns the
    // beat; this version keeps the beat on `io-return-recognition`
    // and surfaces the commit as a durable state field + stamped
    // data attribute, both of which the spec reads below.
    // Bounded tap: the prior CI failure was an UNBOUNDED tap retrying
    // its hit-target check for 180s because the button inherited
    // `.hud { pointer-events: none }`. A bounded tap turns any
    // regression of that into a named 15s failure on this line.
    await carryName.tap({ timeout: WAIT_MS });

    // Durable state surface — `state.player.orraPaybackAction`.
    await page.waitForFunction(
      () =>
        (
          window as unknown as {
            __game?: { player?: { orraPaybackAction?: string | null } };
          }
        ).__game?.player?.orraPaybackAction === "carry-name-to-bell-archive",
      undefined,
      { timeout: WAIT_MS },
    );

    // DOM commit surface — the button stamps the committed action
    // and the forward-hook ending-beat id, and goes disabled so the
    // player can't double-commit.
    const committed = page.locator(
      'button[data-orra-payback-action="carry-name-to-bell-archive"]',
    );
    await expect(committed).toHaveAttribute(
      "data-orra-payback-committed",
      "carry-name-to-bell-archive",
      { timeout: WAIT_MS },
    );
    await expect(committed).toHaveAttribute(
      "data-orra-payback-ending",
      "ending-bell-archive",
    );
    await expect(committed).toBeDisabled();
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
    // A restored delivered slot may come back on the recognition beat
    // directly, or one step earlier with `#deliverButton` reading
    // "Return to Io" (the path `advance()` re-enters through, as the
    // existing sealed-reload spec pins). Accept either, then drive the
    // return tap if needed — both land on io-return-recognition.
    const recognition = page.locator('[data-beat-id="io-return-recognition"]');
    const returnToIo = page.locator("#deliverButton", { hasText: "Return to Io" });
    await expect(recognition.or(returnToIo).first()).toBeVisible({ timeout: WAIT_MS });
    if (!(await recognition.isVisible())) {
      await returnToIo.tap();
    }
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
