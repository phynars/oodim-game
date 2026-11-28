import { expect, test, type Page } from "@playwright/test";
import { playRoute } from "./helpers/route";
import { doorChoices } from "./helpers/routes";

// Episode 2 continuation: after the Unlit Door choice the Act II end card
// offers "Begin Episode 2", which enters the Night Post and survives reload.
// Taps only at 390×844; the route to the Unlit Door is helpers/routes.ts
// doorChoices (job offer → sealed packet → Orra payback → Maud name).

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;
const TEST_TIMEOUT = 120_000;

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapVisible(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await target.tap();
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  await tapVisible(page, `button[data-choice-id="${choiceId}"]:not([disabled])`);
}

// Opens a fresh player and slot at the Unlit Door (kind return, remembered
// name; played in CI and on the served replay, seeded in the box), then taps
// the door choice here, so the Begin Episode 2 reveal is always played.
async function runToEnding(page: Page, tag: string, doorChoice = "keep-official-record"): Promise<void> {
  const slot = slotFor(tag);
  await playRoute(page, `/aftersign/?slot=${slot}&player=e2e-${slot.slice(-6)}`, doorChoices("kind", "remembered-name"));
  await expect(page.locator('[data-ending-id="maud-bell-archive-lit"]')).toBeVisible({ timeout: WAIT_MS });
  await tapChoice(page, doorChoice);
  await expect(page.locator("#beginEpisodeTwo")).toBeVisible({ timeout: WAIT_MS });
}

async function expectUnclippedInPanel(page: Page, control: ReturnType<Page["locator"]>): Promise<void> {
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await expect.poll(async () => control.evaluate((element) => {
    const panel = element.closest(".panel");
    if (!panel) return false;
    for (let ancestor = element.parentElement; ancestor && ancestor !== panel; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (["auto", "scroll", "hidden", "clip"].includes(style.overflowY)) return false;
    }
    const rect = element.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return rect.top >= panelRect.top
      && rect.bottom <= panelRect.bottom
      && rect.top >= 0
      && rect.bottom <= window.innerHeight
      && Boolean(hit && (hit === element || element.contains(hit)));
  })).toBe(true);
}

const slotFor = (tag: string) =>
  `ep2-${tag}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

test.describe("Episode 2 continuation — served phone flow", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("shows a tap-reachable Begin Episode 2 control on the phone end screen", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await runToEnding(page, "control");
    const heading = page.getByRole("heading", { name: "End of Episode 1" });
    const begin = page.locator("#beginEpisodeTwo");
    await expect(heading).toHaveText("End of Episode 1");
    await expect(begin).toHaveText("Begin Episode 2");
    await expect(page.getByText("Episode 1 complete. Episode 2 is ready.", { exact: true })).toBeVisible();
    await expectUnclippedInPanel(page, heading);
    await expectUnclippedInPanel(page, begin);
    const box = await begin.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(56);
    await begin.tap({ trial: true });
  });

  test("enters the Night Post after tapping Begin Episode 2", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await runToEnding(page, "enter");
    await page.locator("#beginEpisodeTwo").tap();
    await expect(page.locator('#episodeOneEnding[data-continuation="night-post"]')).toBeVisible({ timeout: WAIT_MS });
    await expect(page.locator("#episodeOneEnding")).toContainText("Night Post");
    await expect(page.locator("#line")).toHaveText("Night Post. I remember the door you chose: Keep the official record.");
    const accept = page.locator("#acceptEpisodeTwoJob");
    await expect(accept).toHaveText(/Accept The Ledger Run/);
    await expectUnclippedInPanel(page, page.getByText("Night Post", { exact: true }));
    await expectUnclippedInPanel(page, accept);
    // Blind M6 closeouts stopped here without tapping Accept. Niko must
    // already be on screen, saying the stored route, before any Accept tap.
    const nikoGreeting = page.locator('#nikoThread[data-niko-greeting="night-post"]');
    await expect(nikoGreeting).toBeVisible({ timeout: WAIT_MS });
    // runToEnding never taps a route-risk action, so Niko claims no route.
    await expect(nikoGreeting).toContainText("Niko Thread: I have no route from you to claim.");
    await expect(page.locator("[data-niko-shortcut-choice]")).toHaveCount(0);
    await accept.tap();
    await expect(page.locator("#nikoThread")).toBeVisible({ timeout: WAIT_MS });
    // #2991: a blind phone player reported that after Accept the Take/Refuse
    // shortcut choices sat below the fold. Guard that both land inside the
    // panel, tap-reachable, with no swipe.
    const shortcutChoices = page.locator("[data-niko-shortcut-choice]");
    await expect(shortcutChoices).toHaveCount(2);
    await expectUnclippedInPanel(page, shortcutChoices.nth(0));
    await expectUnclippedInPanel(page, shortcutChoices.nth(1));
    await expect(page.locator("#beginEpisodeTwo")).toHaveCount(0);
    // #3125: the door-choice sentence must appear once on screen (Io's #line),
    // not again inside the Night Post panel.
    await expect(page.getByText(/the door you chose/i)).toHaveCount(1);
    await expect(page.locator("#episodeOneEnding")).not.toContainText("the door you chose");
    await expect(page.locator("#episodeOneEnding [data-niko-shortcut-explanation]")).toHaveText(
      "Niko offers a quicker route to the Night Post registry; taking it changes how you arrive.",
    );
    await expect(page.locator("#episodeOneEnding [data-ending-id]")).toHaveCount(0);
  });

  test("names only the visibly selected Unlit Door choice at the Night Post", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await runToEnding(page, "choice");
    await page.locator("#beginEpisodeTwo").tap();
    const nightPost = page.locator('#episodeOneEnding[data-continuation="night-post"]');
    await expect(nightPost).toBeVisible({ timeout: WAIT_MS });
    await expect(page.getByText(/the door you chose/i)).toHaveCount(1);
    await expect(page.locator("#line")).toContainText("Keep the official record");
    await expect(nightPost.locator('[data-night-post-door-choice="keep-official-record"]')).toHaveCount(1);
    await expect(page.locator("#line")).not.toContainText("Protect the private lie");
    await expect(page.locator("#line")).not.toContainText("Hang a new sign");
    await expect(nightPost).not.toContainText("Protect the private lie");
    await expect(nightPost).not.toContainText("Hang a new sign");
  });

  test("restores the Night Post continuation after reload", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await runToEnding(page, "reload");
    await page.locator("#beginEpisodeTwo").tap();
    await expect(page.locator('#episodeOneEnding[data-continuation="night-post"]')).toBeVisible({ timeout: WAIT_MS });
    await page.reload({ waitUntil: "load" });
    await expect(page.locator('#episodeOneEnding[data-continuation="night-post"]')).toBeVisible({ timeout: WAIT_MS });
    await expect(page.getByText(/the door you chose/i)).toHaveCount(1);
    await expect(page.locator("#line")).toContainText("Keep the official record");
    await expect(page.locator("#beginEpisodeTwo")).toHaveCount(0);
  });

  // Regression coverage for the extracted Night Post beat orchestration:
  // each player action below is a visible pointer tap, and reload proves the
  // helper's persistence callback still reaches the durable-save seam.
  test("accepting the visible Night Post offer persists its delivery id", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await runToEnding(page, "accept");
    await page.locator("#beginEpisodeTwo").tap();
    const accept = page.locator("#acceptEpisodeTwoJob");
    await expect(accept).toBeVisible({ timeout: WAIT_MS });
    await expect(page.locator(".episode-two-job__io-offer")).toHaveText("Io: This is the work the door left for you.");
    await accept.tap();
    const job = page.locator("#episodeTwoJob");
    await expect(job).toHaveAttribute("data-episode-two-delivery-id", "ep2-sealed-ledger");
    await expect(accept).toBeDisabled();
    await page.reload({ waitUntil: "load" });
    await expect(job).toHaveAttribute("data-episode-two-delivery-id", "ep2-sealed-ledger");
    await expect(page.locator("#acceptEpisodeTwoJob")).toBeDisabled();
    const shortcutChoices = page.locator("[data-niko-shortcut-choice]");
    await expect(shortcutChoices).toHaveCount(2);
    await expect(shortcutChoices.nth(0)).toHaveAttribute("data-niko-shortcut-choice", "take");
    await expect(shortcutChoices.nth(1)).toHaveAttribute("data-niko-shortcut-choice", "refuse");
  });

  test("Start fresh from the Night Post leaves it and stays left after reload", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await runToEnding(page, "reset");
    await page.locator("#beginEpisodeTwo").tap();
    await expect(page.locator('#episodeOneEnding[data-continuation="night-post"]')).toBeVisible({ timeout: WAIT_MS });
    // First tap arms the confirmation; the second visible pointer tap resets.
    await tapVisible(page, "#resetButton");
    await expect(page.locator("#resetButton")).toHaveText("Confirm start fresh");
    await tapVisible(page, "#resetButton");
    await expect(page.locator("#episodeOneEnding[data-continuation]")).toHaveCount(0, { timeout: WAIT_MS });
    await expect(page.locator("#episodeOneEnding")).not.toContainText("Night Post");
    await waitForBeat(page, "packet-offered");
    // #2968: a completed Episode 2 run used to leave its old red-tag action
    // surface mounted after the visible Start fresh tap. A fresh player may
    // only touch the new safe offer, never resume an old packet or seal state.
    await expect(page.locator('#offeredJobs button[data-offered-job-id="job-safe-delivery"]')).toBeVisible();
    await expect(page.locator('button[data-offered-job-id*="red-tag"]')).toHaveCount(0);
    await expect(page.locator("#packetButton")).toContainText("Blue packet");
    await expect(page.locator("#packetButton")).toHaveAttribute("data-packet-job", "blue-packet");
    await tapVisible(page, "#packetButton");
    await waitForBeat(page, "packet-choice");
    await expect(page.locator('button[data-choice-id="acknowledge-kiosk"]')).toBeVisible();
    // The deliver control is always mounted in packet-choice; it must name the
    // fresh blue packet, never the prior run's red tag (#2968).
    await expect(page.locator('button[data-choice-id="deliver-packet"]')).not.toContainText(/red tag/i);
    await page.reload({ waitUntil: "load" });
    await waitForBeat(page, "packet-offered");
    await expect(page.locator("#episodeOneEnding[data-continuation]")).toHaveCount(0);
    await expect(page.locator("#episodeOneEnding")).not.toContainText("Night Post");
    await expect(page.locator('button[data-offered-job-id*="red-tag"]')).toHaveCount(0);
    await expect(page.locator("#packetButton")).toContainText("Blue packet");
  });

  // #2918: each Unlit Door choice serves its own Episode 2 job at the Night Post.
  for (const [doorChoice, jobId, name, brief] of [
    ["keep-official-record", "ep2-ledger-run", "The Ledger Run", "Carry the sealed official record to the Night Post registry before the lamps go out."],
    ["protect-private-lie", "ep2-quiet-envelope", "The Quiet Envelope", "Slip an unmarked envelope past the night clerk so the lie you kept stays kept."],
    ["hang-new-sign", "ep2-new-sign", "The New Sign", "Haul the freshly painted sign across the district and hang it where the old one fell."],
  ] as const) {
    test(`serves the ${jobId} job after a visible ${doorChoice} tap`, async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      await runToEnding(page, `job-${doorChoice}`, doorChoice);
      await page.locator("#beginEpisodeTwo").tap();
      const job = page.locator(`#episodeTwoJob[data-episode-two-job-id="${jobId}"]`);
      await expect(job).toBeVisible({ timeout: WAIT_MS });
      await expect(job).toHaveAttribute("data-episode-two-door-choice", doorChoice);
      await expect(job).toContainText(name);
      await expect(job).toContainText(brief);
      await expect(page.locator("#episodeTwoJob")).toHaveCount(1);
      await page.reload({ waitUntil: "load" });
      await expect(page.locator(`#episodeTwoJob[data-episode-two-job-id="${jobId}"]`)).toBeVisible({ timeout: WAIT_MS });
    });
  }
});
