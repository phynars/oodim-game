import { expect, test, type Browser, type Page } from "@playwright/test";
import { performPacketGesture } from "./helpers/packetGesture.js";

// #2754 (story #2726) fail-to-pass: a completed Act II ending — outcome
// (lit / out) AND the name shown with it — is restored from the
// authoritative slot save in a fresh browser context.
//
// On main only `story.maudBellArchiveEndingId` was saved, so the restored
// card read "The bell rings for the courier." instead of the chosen name.
// The name assertions below fail there. The fix sets
// `story.maudBellArchiveName` in Maud's onSelect (main.js), saves it in
// persistence.js, hydrates it on boot, and passes it to the restore render.
//
// Taps only: every step is a `.tap()` on a visible element at 390×844.
// The spec never writes to `window.__game`.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`);
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function tapVisible(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await target.tap();
}

async function reachOrraPayback(page: Page, firstPacket: "sealed" | "opened" = "sealed"): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await tapVisible(page, '#offeredJobs button[data-offered-job-id="job-safe-delivery"]');
  if (firstPacket === "opened") await performPacketGesture(page, "opened", WAIT_MS);
  else await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await tapVisible(page, 'button[data-return-reason="blunt"]:not([disabled])');
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "accept-second-packet");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
  // Round-two offers depend on the first packet's seal: a sealed delivery
  // offers the completed set (job-night-transfer); an opened-only history
  // maps to { debtHeld } and offers job-wax-debt-repair instead
  // (offeredJobsMemoryFromIoMemory.js; job-offer-debt-held-played.spec.ts).
  const secondJob = firstPacket === "opened" ? "job-wax-debt-repair" : "job-night-transfer";
  await tapVisible(page, `#offeredJobs button[data-offered-job-id="${secondJob}"]`);
  await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
}

async function openFreshContext(browser: Browser, slot: string, player: string) {
  const context = await browser.newContext({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(`/aftersign/?slot=${slot}&player=${player}`, { waitUntil: "load" });
  return { context, page };
}

type Case = { choice: string; endingId: string; light: string };
const LIT: Case = { choice: "remembered-name", endingId: "maud-bell-archive-lit", light: "lit" };
const DIM: Case = { choice: "archive-decoy", endingId: "maud-bell-archive-dark", light: "out" };

/** Complete the Act II ending by taps; return the visible outcome line. */
async function completeEnding(
  page: Page,
  slot: string,
  player: string,
  c: Case,
  firstPacket: "sealed" | "opened" = "sealed",
): Promise<string> {
  await page.goto(`/aftersign/?slot=${slot}&player=${player}`, { waitUntil: "load" });
  await reachOrraPayback(page, firstPacket);
  await tapVisible(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])');
  const nameButton = page.locator(`button[data-maud-name-choice="${c.choice}"]`);
  await expect(nameButton).toBeVisible({ timeout: WAIT_MS });
  await nameButton.tap();
  const card = page.locator(`[data-ending-id="${c.endingId}"]`);
  await expect(card).toBeVisible({ timeout: WAIT_MS });
  await expect(card).toHaveAttribute("data-district-light", c.light);
  const outcome = (await card.locator(".episode-one-ending__outcome").textContent())?.trim() ?? "";
  expect(outcome).toMatch(/The bell rings for /);
  return outcome;
}

/** Reopen the same slot in a fresh context; assert outcome + name match. */
async function assertRestored(browser: Browser, slot: string, player: string, c: Case, outcome: string) {
  await expect(async () => {
    const { context, page } = await openFreshContext(browser, slot, player);
    try {
      const card = page.locator(`[data-ending-id="${c.endingId}"]`);
      await expect(card).toBeVisible({ timeout: WAIT_MS });
      await expect(card).toHaveAttribute("data-district-light", c.light);
      await expect(card.locator(".episode-one-ending__outcome")).toHaveText(outcome);
      await expect(page.locator("[data-maud-name-choice]")).toHaveCount(0);
      await expect(page.locator('[data-beat="maud-bell-archive"]')).toHaveCount(0);
    } finally {
      await context.close();
    }
  }).toPass({ timeout: 90_000, intervals: [1_000, 2_000, 5_000] });
}

// The Worker rejects slot/player ids outside ^[A-Za-z0-9_-]{1,64}$
// (apps/web/src/aftersign/workerRequestGuards.ts SAFE_ID_PATTERN), so a long
// tag silently loses the authoritative save. Fail loudly instead.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const ids = (tag: string) => {
  const result = {
    player: `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    slot: `durable-act-ii-${tag}-${Date.now()}`,
  };
  for (const id of Object.values(result)) {
    if (!SAFE_ID.test(id)) throw new Error(`test id exceeds Worker id shape: ${id}`);
  }
  return result;
};

test.describe("Durable Act II ending (#2726)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("shows the named Unlit Door after a visible phone tap", async ({ page }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("unlit-door-heading");
    await completeEnding(page, slot, player, DIM);
    await tapVisible(page, 'button[data-choice-id="open-unlit-door"]');

    const card = page.locator(`[data-ending-id="${DIM.endingId}"]`);
    await expect(card.getByRole("heading", { name: "The Unlit Door", exact: true })).toBeVisible();
    await expect(card).not.toContainText("Act II — Bell Archive");
    // The door tap makes the terminal renderer hide every earlier story
    // control. #deliverButton must exist so the loop cannot pass vacuously.
    await expect(page.locator("#deliverButton")).toHaveCount(1);
    for (const selector of [
      "#packetButton",
      "#deliverButton",
      "#offeredJobs button",
      "#routeChoice button",
      "#orraPaybackAction",
    ]) {
      for (const control of await page.locator(selector).all()) {
        await expect(control, `${selector} must be hidden at the Unlit Door`).toBeHidden();
      }
    }
  });

  test("shows all three visible record and Maud consequences at the Unlit Door", async ({ page }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("unlit-door-consequences");
    await completeEnding(page, slot, player, DIM);
    await tapVisible(page, 'button[data-choice-id="open-unlit-door"]');

    const card = page.locator(`[data-ending-id="${DIM.endingId}"]`);
    const choices = card.locator('button[data-choice-id="keep-official-record"], button[data-choice-id="protect-private-lie"], button[data-choice-id="hang-new-sign"]');
    await expect(choices).toHaveCount(3);
    for (const choice of await choices.all()) {
      await expect(choice).toBeVisible();
      const box = await choice.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.y + box.height).toBeLessThanOrEqual(PHONE_VIEWPORT.height);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await expect(choice.locator("xpath=following-sibling::*[1]")).toBeVisible();
    }
  });

  test("renders only the three door choices on the opened Unlit Door card (#2992 AC-2)", async ({ page }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("unlit-door-only-choices");
    await completeEnding(page, slot, player, DIM);
    await tapVisible(page, 'button[data-choice-id="open-unlit-door"]');

    const card = page.locator(`[data-ending-id="${DIM.endingId}"]`);
    await expect(card.getByRole("heading", { name: "The Unlit Door", exact: true })).toBeVisible();
    const buttons = card.locator("button");
    await expect(buttons).toHaveCount(3);
    const buttonIds = await buttons.evaluateAll((els) => els.map((el) => el.getAttribute("data-choice-id")));
    expect(buttonIds).toEqual(["keep-official-record", "protect-private-lie", "hang-new-sign"]);
    await expect(card.locator("[data-maud-name-choice]")).toHaveCount(0);
    for (const text of ["Carry the name to the Bell Archive", "Red tag — Saint Orra", "Go to the Unlit Door"]) {
      await expect(card).not.toContainText(text);
    }
  });

  test("describes every door choice and names the private lie (#2992 AC-3)", async ({ page }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("unlit-door-private-lie");
    await completeEnding(page, slot, player, DIM);
    await tapVisible(page, 'button[data-choice-id="open-unlit-door"]');

    const card = page.locator(`[data-ending-id="${DIM.endingId}"]`);
    for (const id of ["keep-official-record", "protect-private-lie", "hang-new-sign"]) {
      const description = card.locator(`button[data-choice-id="${id}"] + .maud-bell-archive__door-consequence`);
      await expect(description).toBeVisible();
      expect((await description.innerText()).trim().length).toBeGreaterThan(0);
    }
    const privateLie = card.locator('button[data-choice-id="protect-private-lie"] + .maud-bell-archive__door-consequence');
    await expect(privateLie).toContainText("false name Mara Vell in Mara Vell's record");
  });

  test("restores the same Act II ending outcome and name in a fresh browser context", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("name");
    const outcome = await completeEnding(page, slot, player, DIM);
    expect(outcome).toContain("Mara Vell");
    await assertRestored(browser, slot, player, DIM, outcome);
  });

  test("reaches the lit ending by taps only at 390×844", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("lit");
    const outcome = await completeEnding(page, slot, player, LIT);
    await assertRestored(browser, slot, player, LIT, outcome);
  });

  test("reaches the dimmed ending by taps only at 390×844", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("dim");
    const outcome = await completeEnding(page, slot, player, DIM);
    await assertRestored(browser, slot, player, DIM, outcome);
  });

  test("disables every Act II name control after the first visible tap", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("final");
    await page.goto(`/aftersign/?slot=${slot}&player=${player}`, { waitUntil: "load" });
    await reachOrraPayback(page);
    await tapVisible(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])');

    const first = page.locator('button[data-maud-name-choice="remembered-name"]');
    await expect(first).toBeVisible({ timeout: WAIT_MS });
    await first.tap();
    const ending = page.locator('[data-ending-id="maud-bell-archive-lit"]');
    await expect(ending).toBeVisible({ timeout: WAIT_MS });
    const outcome = (await ending.locator(".episode-one-ending__outcome").textContent())?.trim() ?? "";
    const nameControls = page.locator("button[data-maud-name-choice]");
    await expect(nameControls).toHaveCount(3);
    expect(await nameControls.evaluateAll((controls) => controls.every((control) => control.disabled))).toBe(true);
    await expect(ending).toHaveAttribute("data-district-light", "lit");
    await expect(ending.locator(".episode-one-ending__outcome")).toHaveText(outcome);
    await assertRestored(browser, slot, player, LIT, outcome);
  });

  test("shows different sealed and opened Io final lines after visible door taps", async ({ page }) => {
    test.setTimeout(480_000);
    const sealed = ids("io-final-sealed");
    await completeEnding(page, sealed.slot, sealed.player, DIM, "sealed");
    await tapVisible(page, 'button[data-choice-id="open-unlit-door"]');
    await tapVisible(page, 'button[data-choice-id="protect-private-lie"]');
    const sealedLine = page.locator('[data-io-final-id="io-final-sealed-private"]');
    await expect(sealedLine).toBeVisible();
    await expect(sealedLine).toContainText("kept the seal");
    await expect(sealedLine).toContainText("protected the private lie");
    const sealedText = await sealedLine.textContent();

    const opened = ids("io-final-opened");
    await completeEnding(page, opened.slot, opened.player, DIM, "opened");
    await tapVisible(page, 'button[data-choice-id="open-unlit-door"]');
    await tapVisible(page, 'button[data-choice-id="protect-private-lie"]');
    const openedLine = page.locator('[data-io-final-id="io-final-opened-private"]');
    await expect(openedLine).toBeVisible();
    await expect(openedLine).toContainText("broke the seal");
    await expect(openedLine).toContainText("protected the private lie");
    await expect(openedLine).not.toHaveText(sealedText ?? "");
  });

  // #2878: every opened-seal line must render from real taps. The first
  // packet is opened, and the second packet (sealed) must not overwrite it.
  for (const [doorChoice, lineId, phrase] of [
    ["keep-official-record", "io-final-opened-official", "kept the official record"],
    ["hang-new-sign", "io-final-opened-sign", "hung a new sign"],
  ]) {
    test(`shows the opened-seal Io line after a visible ${doorChoice} tap`, async ({ page }) => {
      test.setTimeout(300_000);
      const { player, slot } = ids(`io-open-${doorChoice}`);
      await completeEnding(page, slot, player, DIM, "opened");
      await tapVisible(page, 'button[data-choice-id="open-unlit-door"]');
      await tapVisible(page, `button[data-choice-id="${doorChoice}"]`);
      const line = page.locator(`[data-io-final-id="${lineId}"]`);
      await expect(line).toBeVisible();
      await expect(line).toContainText("broke the seal");
      await expect(line).toContainText(phrase);
    });
  }

  for (const doorChoice of ["keep-official-record", "protect-private-lie", "hang-new-sign"]) {
    test(`persists the ${doorChoice} Unlit Door choice after a visible tap`, async ({ page, browser }) => {
      test.setTimeout(240_000);
      const { player, slot } = ids(`door-${doorChoice}`);
      await completeEnding(page, slot, player, DIM);
      const card = page.locator(`[data-ending-id="${DIM.endingId}"]`);
      await tapVisible(page, 'button[data-choice-id="open-unlit-door"]');
      await expect(card).toHaveAttribute("data-unlit-door-open", "true");
      await expect(card).toContainText("Orra Bell pays with this district's light.");
      const doorChoices = card.locator('button[data-choice-id="keep-official-record"], button[data-choice-id="protect-private-lie"], button[data-choice-id="hang-new-sign"]');
      await expect(doorChoices).toHaveCount(3);
      await tapVisible(page, `button[data-choice-id="${doorChoice}"]`);
      await expect(card).toHaveAttribute("data-door-choice", doorChoice);
      await expect(card.locator(`[data-io-final-id="io-final-sealed-${doorChoice === "keep-official-record" ? "official" : doorChoice === "protect-private-lie" ? "private" : "sign"}"]`)).toBeVisible();
      await expect(doorChoices).toHaveCount(0);
      // PR #2909: the only control left on the committed Act II card is the
      // Episode 2 continuation; no other story button may remain visible.
      await expect(page.locator("#episodeOneEnding button:visible:not(#beginEpisodeTwo)")).toHaveCount(0);
      await expect(page.locator("#episodeOneEnding #beginEpisodeTwo")).toBeVisible();
      await expect(page.locator("#resetButton")).toBeVisible();
      await expect(async () => {
        const { context, page: returning } = await openFreshContext(browser, slot, player);
        try {
          const restored = returning.locator(`[data-ending-id="${DIM.endingId}"]`);
          await expect(restored).toBeVisible({ timeout: WAIT_MS });
          await expect(restored).toHaveAttribute("data-unlit-door-open", "true");
          await expect(restored).toHaveAttribute("data-door-choice", doorChoice);
          await expect(restored).toContainText("Orra Bell pays with this district's light.");
          await expect(returning.locator('button[data-choice-id="open-unlit-door"]')).toHaveCount(0);
          await expect(returning.locator('button[data-choice-id="keep-official-record"], button[data-choice-id="protect-private-lie"], button[data-choice-id="hang-new-sign"]')).toHaveCount(0);
        } finally {
          await context.close();
        }
      }).toPass({ timeout: 90_000, intervals: [1_000, 2_000, 5_000] });
    });
  }

  // #2879: the Act III terminal surface must be the same durable, phone-sized
  // end state for every first-packet seal record and each visible door choice.
  // These runs use only visible taps; window.__game is never used to cause play.
  for (const firstPacket of ["sealed", "opened"] as const) {
    for (const doorChoice of ["keep-official-record", "protect-private-lie", "hang-new-sign"] as const) {
      test(`locks the ${firstPacket}/${doorChoice} Act III end screen except Start fresh`, async ({ page, browser }) => {
        test.setTimeout(300_000);
        // Keep the slot inside the Worker's ^[A-Za-z0-9_-]{1,64}$ guard
        // (workerRequestGuards.ts). `terminal-sealed-keep-official-record`
        // made a 65-char slot, so every save 400'd and restore found nothing.
        const { player, slot } = ids(`t-${firstPacket}-${doorChoice}`);
        expect(slot.length).toBeLessThanOrEqual(64);
        await completeEnding(page, slot, player, DIM, firstPacket);
        await tapVisible(page, 'button[data-choice-id="open-unlit-door"]');
        await tapVisible(page, `button[data-choice-id="${doorChoice}"]`);

        const card = page.locator(`[data-ending-id="${DIM.endingId}"]`);
        await expect(card).toBeVisible();
        await expect(card).toHaveAttribute("data-door-choice", doorChoice);
        const box = await card.boundingBox();
        expect(box).not.toBeNull();
        if (box) expect(box.y + box.height).toBeLessThanOrEqual(PHONE_VIEWPORT.height);
        await expect(page.locator('#resetButton')).toBeVisible();
        for (const selector of [
          '#packetButton', '#deliverButton', '#acknowledgeRouteButton', '#skipRouteButton',
          '#routeChoice button', '#vigilChoice button', '#offeredJobs button', '#returnToOrra',
        ]) {
          for (const control of await page.locator(selector).all()) await expect(control).toBeHidden();
        }
        await expect(page.locator('button[data-choice-id="open-unlit-door"]')).toHaveCount(0);
        await expect(page.locator('button[data-choice-id="keep-official-record"], button[data-choice-id="protect-private-lie"], button[data-choice-id="hang-new-sign"]')).toHaveCount(0);

        await expect(async () => {
          const { context, page: restored } = await openFreshContext(browser, slot, player);
          try {
            const restoredCard = restored.locator(`[data-ending-id="${DIM.endingId}"]`);
            await expect(restoredCard).toBeVisible({ timeout: WAIT_MS });
            await expect(restoredCard).toHaveAttribute("data-door-choice", doorChoice);
            await expect(restored.locator('#resetButton')).toBeVisible();
            await expect(restored.locator('button[data-choice-id="open-unlit-door"]')).toHaveCount(0);
            await expect(restored.locator('button[data-choice-id="keep-official-record"], button[data-choice-id="protect-private-lie"], button[data-choice-id="hang-new-sign"]')).toHaveCount(0);
          } finally {
            await context.close();
          }
        }).toPass({ timeout: 90_000, intervals: [1_000, 2_000, 5_000] });
      });
    }
  }

  test("Start fresh clears the Unlit Door choice so a replayed ending can choose again", async ({ page }) => {
    test.setTimeout(300_000);
    const { player, slot } = ids("door-restart");
    await completeEnding(page, slot, player, DIM);
    const card = page.locator(`[data-ending-id="${DIM.endingId}"]`);
    await tapVisible(page, 'button[data-choice-id="open-unlit-door"]');
    await tapVisible(page, 'button[data-choice-id="keep-official-record"]');
    await expect(card).toHaveAttribute("data-door-choice", "keep-official-record");

    // First tap arms the confirmation (#2955); the second one resets.
    await tapVisible(page, "#resetButton");
    await expect(page.locator("#resetButton")).toHaveText("Confirm start fresh");
    await tapVisible(page, "#resetButton");
    await expect(card).toHaveCount(0, { timeout: WAIT_MS });
    await reachOrraPayback(page);
    await tapVisible(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])');
    await tapVisible(page, `button[data-maud-name-choice="${DIM.choice}"]`);
    await expect(card).toBeVisible({ timeout: WAIT_MS });
    await expect(card).not.toHaveAttribute("data-unlit-door-open", "true");
    await expect(card).not.toHaveAttribute("data-door-choice", /.+/);
    await tapVisible(page, 'button[data-choice-id="open-unlit-door"]');
    await expect(card.locator('button[data-choice-id="hang-new-sign"]')).toBeVisible({ timeout: WAIT_MS });
    await tapVisible(page, 'button[data-choice-id="hang-new-sign"]');
    await expect(card).toHaveAttribute("data-door-choice", "hang-new-sign");
  });

  test("does not reopen an Act II choice after restoring an ending", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const { player, slot } = ids("nochoice");
    const outcome = await completeEnding(page, slot, player, DIM);
    await assertRestored(browser, slot, player, DIM, outcome);
    const { context, page: returning } = await openFreshContext(browser, slot, player);
    try {
      await expect(returning.locator(`[data-ending-id="${DIM.endingId}"]`)).toBeVisible({ timeout: WAIT_MS });
      await expect(returning.locator("button[data-maud-name-choice]")).toHaveCount(0);
      await expect(
        returning.locator('button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])'),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
