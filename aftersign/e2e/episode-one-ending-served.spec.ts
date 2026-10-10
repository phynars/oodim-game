import { expect, test, type Page, type Locator } from "@playwright/test";

import { performPacketGesture } from "./helpers/packetGesture";

// AFTERSIGN M3-E1 (#2261) — Episode 1 ending beats A/B must be
// REACHABLE through the real served funnel at 390×844 and each path
// must stamp a distinct `data-ending-id` AND a distinct Io closing
// line pinned to a concrete prior action (never a false memory).
//
// Soren's REQUEST_CHANGES on PR #2265 iter-4 blocked the merge on
// three specific gaps in the first draft of this spec, each fixed
// below:
//
//   • AI008 — "the spec expected a visible `open-packet` button; the
//     served page has no such button, opening the packet is a
//     hold-and-pull on `#packetButton`". The dispatch-only choice
//     ids `open-packet` / `keep-packet-sealed` are NEVER stamped on
//     a rendered control — they live only inside `choose()` in
//     aftersign/main.js (see `aftersign/e2e/helpers/packetGesture.ts`
//     for the full note). This revision uses the shared
//     `performPacketGesture` helper for BOTH paths: a plain click on
//     `#packetButton` for SEALED, and a hold+pull for OPENED (pull=12
//     sits inside (OPEN_PULL_MIN_PX=10, DRIFT_CANCEL_PX=14], hold=900
//     ms clears HOLD_TO_OPEN_MS=450). Same gesture every played
//     ending spec uses today — one implementation, no drift.
//
//   • AI008 — "the real funnel runs through the return-tone choice
//     (`button[data-return-reason]`); the spec never taps it". Fixed:
//     after `return-to-io` auto-advances into `io-return-recognition`
//     we tap `button[data-return-reason="kind"]` — the real tap that
//     commits the posture (per
//     `aftersign/e2e/return-to-io-no-false-blunt.spec.ts`, the
//     canonical played proof of the return-tone surface).
//
//   • AI001 — "substring text fallbacks on `"open"` / `"return"` /
//     `"deliver"` can commit the wrong beat". Fixed: ALL text
//     fallbacks are gone. Every tap below targets either a stable
//     DOM id (`#packetButton`) or an exact `data-choice-id` /
//     `data-return-reason` attribute selector. No `hasText` match
//     anywhere in this file.
//
// Orra meet/vigil beat (`meet-orra` → `light-vigil`): the shipped
// served page renders NO `data-choice-id="meet-orra"` or
// `data-choice-id="light-vigil"` button today — these beats are
// only dispatchable via `input.choose(id)`. The sibling green specs
// `aftersign/e2e/orra-served-recognition.spec.ts` (M-ORRA-E1
// done-gate) and `aftersign/e2e/flagship-surface-contract.spec.ts`
// take the same path on the SAME surface for the same reason: the
// ending is set only inside the Orra vigil handler in
// aftersign/main.js's `choose()`, and that handler commits via
// either `input.choose(id)` OR a rendered button — the behavior is
// identical because `input.choose` IS the shipped dispatch seam
// (see `aftersign/src/runtime/inputAdapters.js`, where the input
// adapter calls `game.input.choose(...)` on pointerup). Taking the
// same seam here keeps this spec consistent with the merged Orra
// lane specs; the moment a rendered meet-orra/light-vigil surface
// lands, this spec switches to the tap exactly like
// `return-to-io-no-false-blunt.spec.ts` does for its tone row.
//
// Rendered-DOM funnel (both paths; only step 1 diverges):
//   #packetButton  (click or hold+pull)   → packet-choice
//   button[data-choice-id=
//     "acknowledge-kiosk"]                → still packet-choice
//   button[data-choice-id="deliver-packet"] → packet-delivered
//   (auto-advance ~1180ms)                 → io-return-recognition
//   button[data-return-reason="kind"]      → return-tone-choice
//   button[data-choice-id=
//     "ask-for-next-job"]                 → io-next-job
//   button[data-choice-id=
//     "accept-second-packet"]             → ARMS red tag
//                                           (state.delivery.id="red-tag")
//   input.choose("meet-orra")              → Orra first-contact
//   input.choose("light-vigil")            → ENDING committed
//
// Both paths accept the second packet so the funnel diverges ONLY
// at step 1 (the packet gesture). On the OPENED path this is also
// the P1 false-memory check: the run DID carry the red tag, so a
// resolver that cited the tag would speak a false memory. After
// this PR the opened-packet cause wins and Io cites the packet,
// never the tag.

const WAIT_MS = 60_000;
const COLD_START_MS = 90_000;
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

type EndingSnapshot = {
  endingId: string | null;
  endingCause: string | null;
};

async function waitForVersion(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __game?: { version?: number } }).__game?.version === 1,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForStoryIdle(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as {
      __game?: { input?: { waitForStoryIdle?: () => Promise<void> | void } };
    }).__game?.input?.waitForStoryIdle?.(),
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<Locator> {
  const beatNode = page.locator(`[data-beat-id="${beatId}"]`);
  await expect(
    beatNode,
    `story should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
  return beatNode;
}

/**
 * Tap a rendered choice button by its exact `data-choice-id`.
 *
 * Soren's AI001 call-out on iter-4: substring text fallbacks can
 * match the wrong button (`hasText: "return"` matches "return next
 * session", "Return to Io", "returned the packet"…). This helper
 * targets ONLY the attribute selector, with no text fallback — a
 * missing button fails loudly instead of silently clicking an
 * unrelated control.
 */
async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const button = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `visible button[data-choice-id="${choiceId}"] must be present and enabled`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
  await waitForStoryIdle(page);
}

/**
 * Tap the return-tone posture button by `data-return-reason`.
 *
 * The three recognition-beat tone buttons (kind / evasive / blunt)
 * share a reused DOM node that round-robins through the labels; the
 * attribute selector is the stable surface (per
 * `aftersign/e2e/return-to-io-no-false-blunt.spec.ts` and
 * `apps/web/src/aftersign/mContinueVisibleButtons.contract.test.ts`).
 */
async function tapReturnTone(
  page: Page,
  reason: "kind" | "evasive" | "blunt",
): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `return-tone button[data-return-reason="${reason}"] must be visible at io-return-recognition`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
  await waitForStoryIdle(page);
}

/**
 * Dispatch an Orra lane choice through the shipped `input.choose`
 * seam.
 *
 * This is the SAME seam the input adapter calls on a real pointerup
 * (`aftersign/src/runtime/inputAdapters.js`), so no runtime branch
 * is bypassed — the ending-set handler in `choose()` runs on
 * exactly the same code path a tap would hit when the Orra lane
 * grows a rendered surface. See the top-of-file comment for why
 * Orra meet/vigil can't be tapped on the shipped DOM today, and
 * why `orra-served-recognition.spec.ts` and
 * `flagship-surface-contract.spec.ts` do the same thing.
 */
async function dispatchChoice(page: Page, choiceId: string): Promise<void> {
  const ok = await page.evaluate((id) => {
    try {
      const input = (window as unknown as {
        __game?: { input?: { choose?: (id: string) => unknown } };
      }).__game?.input;
      if (!input || typeof input.choose !== "function") return false;
      input.choose(id);
      return true;
    } catch {
      return false;
    }
  }, choiceId);
  expect(
    ok,
    `window.__game.input.choose("${choiceId}") must be callable`,
  ).toBe(true);
  await waitForStoryIdle(page);
}

async function readEndingSnapshot(page: Page): Promise<EndingSnapshot> {
  return page.evaluate(() => {
    const story = (window as unknown as {
      __game?: { story?: { endingId?: string | null; endingCause?: string | null } };
    }).__game?.story;
    return {
      endingId: story?.endingId ?? null,
      endingCause: story?.endingCause ?? null,
    };
  });
}

async function waitForEndingPublished(page: Page): Promise<void> {
  // The ending card MUST render from the funnel above. If no path
  // committed the ending, this fails loudly — the whole point of a
  // played spec.
  await expect(
    page.locator("#episodeOneEnding [data-ending-id]").first(),
    "episode-one ending card must render under #episodeOneEnding",
  ).toBeVisible({ timeout: WAIT_MS });
  await page.waitForFunction(
    () =>
      Boolean(
        (window as unknown as {
          __game?: { story?: { endingId?: string | null } };
        }).__game?.story?.endingId,
      ),
    undefined,
    { timeout: WAIT_MS },
  );
}

async function readEndingCard(page: Page): Promise<Locator> {
  const card = page.locator("#episodeOneEnding [data-ending-id]").first();
  await expect(card, "episode-one ending card must be present under #episodeOneEnding").toBeVisible({
    timeout: WAIT_MS,
  });
  return card;
}

/**
 * Play the full funnel to the Episode 1 ending.
 *
 * Steps 1-7 are each a REAL event on a rendered DOM node; steps
 * 8-9 dispatch through the shipped `input.choose` seam for the
 * un-rendered Orra lane (see top-of-file note). The Orra beats are
 * REQUIRED, not optional — the "`tapChoiceIfPresent`" seam Soren
 * blocked on iter-4 is gone. A missed `light-vigil` leaves
 * `endingId` null and `waitForEndingPublished` below fails loudly.
 */
async function runToEnding(
  page: Page,
  outcome: "sealed" | "opened",
): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await performPacketGesture(page, outcome);

  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");

  await waitForBeat(page, "packet-delivered");
  await waitForBeat(page, "io-return-recognition");

  await tapReturnTone(page, "kind");
  await waitForBeat(page, "return-tone-choice");

  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");

  // Arm the red tag on BOTH paths. For TRUE this is load-bearing
  // (the resolver's sealed-AND-tagged axis). For OPENED it stress-
  // tests the false-memory P1: the player DID carry the red tag,
  // so a resolver that cited the tag would speak a false memory;
  // after this PR the opened-packet cause wins and Io cites the
  // packet, not the tag. The branch that writes
  // `state.delivery = { id: "red-tag", outcome: "unknown" }` lives
  // in aftersign/main.js's `choose()` under this choice id — the
  // same hunk this PR's diff comments on.
  await tapChoice(page, "accept-second-packet");

  // Orra lane — no rendered surface today (see top-of-file). Order
  // matches `aftersign/e2e/orra-served-recognition.spec.ts`:
  // `meet-orra` first (stamps `state.npcs.orra.lastLineId` so the
  // vigil handler has a lineId to echo into `lastLineMemoryRefs`),
  // then `light-vigil` — the handler that commits
  // `state.story.endingId` and renders the card.
  await dispatchChoice(page, "meet-orra");
  await dispatchChoice(page, "light-vigil");

  await waitForEndingPublished(page);
}

test.describe("M3-E1 Episode 1 ending — served, phone-tapped", () => {
  test.describe.configure({ mode: "serial" });

  test("TRUE ending: sealed packet + carried red tag → ending-bell-true, lit light, no false memory", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    await page.setViewportSize(PHONE_VIEWPORT);

    const slot = `episode-one-ending-true-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForVersion(page);

    await runToEnding(page, "sealed");

    const card = await readEndingCard(page);
    await expect(card).toHaveAttribute("data-ending-id", "ending-bell-true");
    await expect(card.locator("[data-district-light]")).toHaveAttribute("data-district-light", "lit");
    await expect(card).toContainText(/Saint Orra/i);
    await expect(card.locator(".episode-one-ending__recall")).toContainText(/blue packet sealed/i);
    // Narrative-rule guard: the TRUE path must not accidentally cite
    // the red-tag-withheld memory.
    await expect(card.locator(".episode-one-ending__recall")).not.toContainText(/withheld the red tag/i);

    const snapshot = await readEndingSnapshot(page);
    expect(snapshot.endingId).toBe("ending-bell-true");
    expect(snapshot.endingCause).toBe("sealed-and-tagged");
  });

  test("FALSE ending (packet opened): ending-light-out, Io cites the opened packet, NEVER the red tag", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    await page.setViewportSize(PHONE_VIEWPORT);

    const slot = `episode-one-ending-opened-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForVersion(page);

    await runToEnding(page, "opened");

    const card = await readEndingCard(page);
    await expect(card).toHaveAttribute("data-ending-id", "ending-light-out");
    await expect(card).toHaveAttribute("data-ending-cause", "packet-opened");
    await expect(card.locator("[data-district-light]")).toHaveAttribute("data-district-light", "out");
    await expect(card).toContainText(/wrong name/i);

    // The P1 the first review surfaced: Io used to say "You withheld
    // the red tag" on this path, which is a FALSE MEMORY (the red tag
    // was armed by the handoff beat and carried through delivery).
    // After the fix the opened-packet run cites the opened packet
    // and NEVER the red tag.
    const recall = card.locator(".episode-one-ending__recall");
    await expect(recall).toContainText(/opened the blue packet/i);
    await expect(recall).not.toContainText(/withheld the red tag/i);

    const snapshot = await readEndingSnapshot(page);
    expect(snapshot.endingId).toBe("ending-light-out");
    expect(snapshot.endingCause).toBe("packet-opened");
  });

  test("the two endings are distinct — ids differ and Io's closing line diverges", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await page.setViewportSize(PHONE_VIEWPORT);

    const trueSlot = `episode-one-ending-pair-true-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${trueSlot}`, { waitUntil: "load" });
    await waitForVersion(page);
    await runToEnding(page, "sealed");
    const trueSnapshot = await readEndingSnapshot(page);
    const trueCard = await readEndingCard(page);
    const trueRecallText = (await trueCard.locator(".episode-one-ending__recall").textContent()) ?? "";

    const openedSlot = `episode-one-ending-pair-opened-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${openedSlot}`, { waitUntil: "load" });
    await waitForVersion(page);
    await runToEnding(page, "opened");
    const openedSnapshot = await readEndingSnapshot(page);
    const openedCard = await readEndingCard(page);
    const openedRecallText =
      (await openedCard.locator(".episode-one-ending__recall").textContent()) ?? "";

    expect(trueSnapshot.endingId).not.toBe(openedSnapshot.endingId);
    expect(trueSnapshot.endingCause).not.toBe(openedSnapshot.endingCause);
    expect(trueRecallText).not.toBe(openedRecallText);
    expect(trueRecallText.length).toBeGreaterThan(0);
    expect(openedRecallText.length).toBeGreaterThan(0);
  });
});
