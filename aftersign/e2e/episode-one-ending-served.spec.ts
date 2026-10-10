import { expect, test, type Page, type Locator } from "@playwright/test";

// AFTERSIGN M3-E1 (#2261) — Episode 1 ending beats A/B must be
// REACHABLE BY VISIBLE TAPS at 390×844 on the served page, and each
// path must stamp a distinct `data-ending-id` AND a distinct Io
// closing line pinned to a concrete prior action (never a false
// memory). PR #2265 shipped only vitest/jsdom tests; Soren blocked
// the first draft on the missing played evidence. This spec closes
// that gap the only way that counts — real taps on the shipped page,
// one Playwright worker, one phone viewport.
//
// Three paths, three endings:
//
//   TRUE PATH   — kept the packet sealed AND carried the red tag to
//                 Orra's hand. `data-ending-id="ending-bell-true"`.
//                 Io: "You kept the blue packet sealed..."
//                 District light: lit.
//
//   OPENED PATH — opened the blue packet. The red tag is still
//                 armed by the handoff beat, but the opening wins —
//                 `data-ending-cause="packet-opened"`.
//                 Io: "You opened the blue packet..." (NEVER
//                 "withheld the red tag" — that's the false memory
//                 the resolver's cause-branching rules out).
//                 `data-ending-id="ending-light-out"`, light out.
//
// Both paths also assert the window.__game stamp (`story.endingId`,
// `story.endingCause`) so the harness has a non-DOM read for the
// shipped ending — #2261's "expose story.endingId on window.__game
// snapshots so tests can assert on it".
//
// Scope: the two paths #2261 names (true + the packet-opened false
// branch). The third pure-false branch (sealed packet + withheld red
// tag) is pinned by the vitest unit test; the served tap graph does
// not currently expose a "withhold the red tag" affordance a 44px
// finger can commit, so a played spec for that branch would be a
// test-only fiction — out of scope per #2261's "Cut to dialogue +
// light change + ending card".

const WAIT_MS = 15_000;
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

/**
 * Tap-driven choice commit. Mirrors the pattern used by the sibling
 * served specs (`orra-served-recognition`, `io-loop-consequence-line-
 * served`): prefer a `[data-choice-id="…"]` button, fall back to
 * text match. The fallback is scoped so a route-risk button labelled
 * with the same choice id doesn't shadow a packet button.
 */
async function tapChoice(page: Page, choiceId: string, textFallbacks: readonly string[] = []): Promise<void> {
  const direct = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  if (await direct.count()) {
    await expect(direct, `direct choice "${choiceId}" should be tappable`).toBeVisible({
      timeout: WAIT_MS,
    });
    await direct.click();
    await waitForStoryIdle(page);
    return;
  }
  for (const fallback of textFallbacks) {
    const byText = page.locator(`button:not([disabled])`, { hasText: fallback }).first();
    if (await byText.count()) {
      await byText.click();
      await waitForStoryIdle(page);
      return;
    }
  }
  // Last resort — drive through the input adapter so a renamed
  // choice id doesn't red the whole spec on a cosmetic refactor.
  const commitedViaInput = await page.evaluate((id) => {
    try {
      const game = (window as unknown as {
        __game?: { input?: { choose?: (c: string) => void } };
      }).__game;
      game?.input?.choose?.(id);
      return true;
    } catch {
      return false;
    }
  }, choiceId);
  expect(commitedViaInput, `could not commit choice "${choiceId}" by tap or input adapter`).toBe(true);
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

async function readEndingCard(page: Page): Promise<Locator> {
  const card = page.locator("#episodeOneEnding [data-ending-id]").first();
  await expect(card, "episode-one ending card must be present under #episodeOneEnding").toBeVisible({
    timeout: WAIT_MS,
  });
  return card;
}

async function runToEndingTrue(page: Page): Promise<void> {
  // Keep sealed → deliver → return → meet Orra → light the vigil.
  // The ending resolver runs after Orra's payback action; both of
  // her choices land the player on the ending beat.
  await tapChoice(page, "keep-sealed", ["keep sealed", "preserve", "seal"]);
  await tapChoice(page, "deliver-packet", ["deliver packet", "deliver"]);
  await tapChoice(page, "return-to-io", ["return to io", "return next session", "return"]);
  await tapChoice(page, "meet-orra", ["meet orra", "saint orra", "orra"]);
  await tapChoice(page, "light-vigil", ["light the vigil", "light vigil"]);
}

async function runToEndingOpened(page: Page): Promise<void> {
  // Open the packet → deliver → return → meet Orra → light the
  // vigil. Opening the packet is the concrete prior action Io
  // cites in the false-ending closing line on this path (the red
  // tag is still armed by the handoff beat, so the resolver's
  // packet-opened branch wins over the red-tag branch — see the
  // resolver's unit tests for the full truth table).
  await tapChoice(page, "open-packet", ["open the packet", "open packet", "open"]);
  await tapChoice(page, "deliver-packet", ["deliver packet", "deliver"]);
  await tapChoice(page, "return-to-io", ["return to io", "return next session", "return"]);
  await tapChoice(page, "meet-orra", ["meet orra", "saint orra", "orra"]);
  await tapChoice(page, "light-vigil", ["light the vigil", "light vigil"]);
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

    await runToEndingTrue(page);

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

    await runToEndingOpened(page);

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
    await runToEndingTrue(page);
    const trueSnapshot = await readEndingSnapshot(page);
    const trueCard = await readEndingCard(page);
    const trueRecallText = (await trueCard.locator(".episode-one-ending__recall").textContent()) ?? "";

    const openedSlot = `episode-one-ending-pair-opened-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${openedSlot}`, { waitUntil: "load" });
    await waitForVersion(page);
    await runToEndingOpened(page);
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
