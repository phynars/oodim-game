import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN — the packet-choice affordance line must render AT THE
// SERVED PAGE as a player-visible paragraph immediately after
// `#packetButton`, and `#packetButton` itself must carry the same
// literal on `aria-description`, the moment the beat becomes
// `packet-choice`. Soren's REQUEST_CHANGES on the prior revision
// pinned the same defect every sibling wire has hit: a unit test on
// the string constant proves nothing about whether the served page
// speaks it. This spec closes that gap the only way that counts —
// real taps on the shipped page, no `window.__game` state mutation,
// no localStorage seeding. Same tap shape as
// `io-loop-consequence-line-served.spec.ts` so the two beats keep
// drifting together.
//
//   FIRST VISIT → tap into `packet-choice` → visible `<p>` at
//                 `[data-aftersign-packet-choice-affordance]` inside
//                 the served DOM, verbatim `AFFORDANCE_LINE`, and
//                 `#packetButton[aria-description]` matches it.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
const PHONE_VIEWPORT = { width: 375, height: 812 } as const;

// Verbatim from `aftersign/src/packetChoiceAffordance.js`.
const AFFORDANCE_LINE =
  "Choose before you leave: Io will remember whether the seal stayed whole.";

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

test.describe("AFTERSIGN packet-choice affordance line — served (#1774)", () => {
  test("renders the affordance paragraph and mirrors it on packetButton[aria-description] the moment packet-choice is reached", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    await page.setViewportSize(PHONE_VIEWPORT);

    const slot = `packet-choice-affordance-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // Take the safe-delivery job and tap the packet — same shape as
    // every sibling served spec.
    await waitForBeat(page, "packet-offered");
    await page.locator("#job-offer-job-safe-delivery").click();
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");

    // The wired paragraph must be present in the served DOM.
    const affordance = page.locator(
      "[data-aftersign-packet-choice-affordance]",
    );
    await expect(
      affordance,
      "packet-choice affordance paragraph must render on the served page at packet-choice",
    ).toBeVisible({ timeout: WAIT_MS });

    // Verbatim copy — a served line that doesn't say the exact
    // literal is a broken promise, not a passing test.
    const affordanceText = (await affordance.textContent()) ?? "";
    expect(
      affordanceText,
      "affordance paragraph must speak the shipped literal verbatim",
    ).toBe(AFFORDANCE_LINE);
    await expect(
      page.getByText(AFFORDANCE_LINE, { exact: true }),
      "affordance literal must be player-visible on the served page",
    ).toBeVisible({ timeout: WAIT_MS });

    // The paragraph must sit immediately after `#packetButton` — the
    // gesture object the player just touched — not floated to some
    // unrelated tray.
    const isImmediatelyAfterPacketButton = await page.evaluate(() => {
      const button = document.querySelector("#packetButton");
      const next = button?.nextElementSibling;
      return (
        next instanceof HTMLElement &&
        next.hasAttribute("data-aftersign-packet-choice-affordance")
      );
    });
    expect(
      isImmediatelyAfterPacketButton,
      "affordance paragraph must be inserted immediately after #packetButton",
    ).toBe(true);

    // And the same literal must land on `#packetButton[aria-description]`
    // so a screen-reader user hears the consequence on the object.
    await expect(page.locator("#packetButton")).toHaveAttribute(
      "aria-description",
      AFFORDANCE_LINE,
    );
  });
});
