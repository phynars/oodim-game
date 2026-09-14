import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN #1765 — Io's round-to-round consequence line must render
// AT THE SERVED PAGE as a player-visible paragraph inside the
// `#offeredJobs` tray, and its literal must diverge between a fresh
// boot (no delivery-outcome fact) and a looped return with a sealed
// first delivery. Soren's four consecutive REQUEST_CHANGES on this
// PR pinned the same defect: the copy module was wired into
// `bootWindowGame.ts` (the vitest boot harness) but zero characters
// of it reached the served `aftersign/main.js`, so a player never
// saw the line. This spec closes that gap the only way that counts —
// real taps on the shipped page, no `window.__game` state mutation,
// no localStorage seeding.
//
//   FIRST VISIT   → no delivery-outcome fact → "pending" line.
//                   `data-aftersign-io-consequence-line="pending"`.
//   LOOPED RETURN → one full loop with a sealed packet delivery →
//                   delivery-outcome fact `object === "sealed"` →
//                   "sealed" line.
//                   `data-aftersign-io-consequence-line="sealed"`.
//
// Same tap script as the sibling `job-offer-route-risk-copy-played`
// spec, so the two beats keep drifting together.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
const PHONE_VIEWPORT = { width: 375, height: 812 } as const;

// Verbatim from `aftersign/src/ioLoopConsequenceCopy.js`.
const PENDING_LINE =
  "One run changes the next. Take the work in front of you.";
const SEALED_LINE =
  "You brought it back whole last time. I can risk your hands on wider work.";

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

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `return-tone "${reason}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

test.describe("AFTERSIGN Io loop consequence line — played divergence (#1765)", () => {
  test("fresh boot shows the pending line; looped return with a sealed delivery shows the sealed line", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    await page.setViewportSize(PHONE_VIEWPORT);

    const slot = `io-loop-consequence-line-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // FIRST VISIT — no delivery-outcome memory yet → pending line.
    await waitForBeat(page, "packet-offered");
    const consequenceLine = page.locator(
      "#offeredJobs [data-aftersign-io-consequence-line]",
    );
    await expect(
      consequenceLine,
      "consequence line paragraph must render inside the served #offeredJobs tray on first visit",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(consequenceLine).toHaveAttribute(
      "data-aftersign-io-consequence-line",
      "pending",
    );
    await expect(
      page.getByText(PENDING_LINE, { exact: true }),
      "first-visit consequence line must speak the pending literal verbatim",
    ).toBeVisible({ timeout: WAIT_MS });
    const firstRunText = (await consequenceLine.textContent()) ?? "";
    expect(firstRunText).toBe(PENDING_LINE);

    // Play one full loop, keeping the packet SEALED (the tap script
    // never opens it), so the durable delivery-outcome fact lands
    // with `object === "sealed"` and the looped return resolves the
    // "sealed" consequence branch.
    await page.locator("#job-offer-job-safe-delivery").click();
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await tapReturnReason(page, "blunt");
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    // LOOPED RETURN — sealed delivery-outcome fact in Io's memory →
    // sealed line. Same visible paragraph, new literal, new marker.
    await waitForBeat(page, "packet-offered");
    await expect(
      consequenceLine,
      "consequence line paragraph must still render at the looped packet-offered",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(consequenceLine).toHaveAttribute(
      "data-aftersign-io-consequence-line",
      "sealed",
    );
    await expect(
      page.getByText(SEALED_LINE, { exact: true }),
      "looped-return consequence line must speak the sealed literal verbatim",
    ).toBeVisible({ timeout: WAIT_MS });
    const loopedText = (await consequenceLine.textContent()) ?? "";
    expect(loopedText).toBe(SEALED_LINE);

    // Divergence proof: the two run's visible literals differ, and
    // the pending literal no longer lingers on the looped page.
    expect(
      loopedText,
      "visible consequence line must diverge between fresh boot and looped return",
    ).not.toBe(firstRunText);
    await expect(
      page.getByText(PENDING_LINE, { exact: true }),
      "pending consequence line must NOT render on the looped return",
    ).toHaveCount(0);
  });
});
