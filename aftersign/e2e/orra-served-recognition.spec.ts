import { test, expect, type Page } from "@playwright/test";

import { IO_RETURN_MEMORY_ID } from "../../e2e-shared/flagshipStoryStateContract";
import { ORRA_LINE_COPY_BY_ID } from "../src/orraRuntimeLane";

const WAIT_MS = 60_000;
const COLD_START_MS = 90_000;
const ORRA_FIRST_CONTACT_LINE_ID = "orra_first_contact";
const ORRA_RETURN_LINE_ID = {
  "light-vigil": "orra_return_lit_vigil",
  "spare-vigil": "orra_return_spared_vigil",
} as const;

type OrraChoiceId = keyof typeof ORRA_RETURN_LINE_ID;
type OrraBreakMode = "orra-dropped" | "orra-wrong" | "orra-io-contamination";

function currentBreakMode(): OrraBreakMode | null {
  const raw = process.env.FLAGSHIP_BREAK_MODE;
  return raw === "orra-dropped" || raw === "orra-wrong" || raw === "orra-io-contamination" ? raw : null;
}

async function waitForVersion(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__game?.version === 1, undefined, { timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const control = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`);
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await control.tap();
}

async function waitForFirstContact(page: Page): Promise<void> {
  await page.waitForFunction(
    (lineId) => (window as any).__game?.npcs?.orra?.lastLineId === lineId,
    ORRA_FIRST_CONTACT_LINE_ID,
    { timeout: WAIT_MS },
  );
}

async function reloadSavedRun(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__game?.save?.dirty === false, undefined, { timeout: WAIT_MS });
  await page.reload({ waitUntil: "load" });
  await waitForVersion(page);
}

async function readNpcSnapshot(page: Page): Promise<{
  orraLine: string;
  orraRefs: string[];
  ioLine: string;
  ioRefs: string[];
}> {
  return page.evaluate(() => {
    const game = (window as any).__game;
    return {
      orraLine: game?.npcs?.orra?.lastLine ?? "",
      orraRefs: game?.npcs?.orra?.lastLineMemoryRefs ?? [],
      ioLine: game?.npcs?.io?.lastLine ?? "",
      ioRefs: game?.npcs?.io?.lastLineMemoryRefs ?? [],
    };
  });
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({ timeout: WAIT_MS });
}

// Served Io walk, mirroring aftersign-mloop-two-round.playtest.spec.ts:
// offered job → #packetButton → acknowledge-kiosk → deliver-packet →
// io-return-recognition → blunt return → ask-for-next-job → io-next-job.
// There is no served `keep-sealed` button, so it is not tapped.
async function runIoBeats(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  const offeredJob = page.locator("#offeredJobs button[data-offered-job-id]").first();
  await expect(offeredJob).toBeVisible({ timeout: WAIT_MS });
  await offeredJob.tap();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
}

// Orra's first-contact control is offered at the io-next-job park.
// Accept either the dedicated #meetOrraButton or a meet-orra choice button.
async function tapMeetOrra(page: Page): Promise<void> {
  await waitForBeat(page, "io-next-job");
  const control = page
    .locator("#meetOrraButton:not([disabled])")
    .or(page.locator('button[data-choice-id="meet-orra"]:not([disabled])'))
    .first();
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await control.tap();
}

async function meetOrraAndChoose(page: Page, choiceId: OrraChoiceId): Promise<void> {
  await tapMeetOrra(page);
  await waitForFirstContact(page);
  await tapChoice(page, choiceId);
}

test.describe("served Orra recognition lane", () => {
  test.describe.configure({ mode: "serial" });

  test("M-ORRA-E1 served flow: visible first contact and vigil recognition survive reload", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    const breakMode = currentBreakMode();
    if (breakMode) {
      await page.addInitScript((mode: string) => {
        (window as unknown as { __FLAGSHIP_BREAK_MODE?: string }).__FLAGSHIP_BREAK_MODE = mode;
      }, breakMode);
    }

    for (const choiceId of ["light-vigil", "spare-vigil"] as const) {
      const slot = `orra-served-${choiceId}-${Date.now()}`;
      const breakQuery = breakMode ? `&breakMode=${encodeURIComponent(breakMode)}` : "";
      await page.goto(`/aftersign/?slot=${slot}${breakQuery}`, { waitUntil: "load" });
      await waitForVersion(page);
      await runIoBeats(page);
      await meetOrraAndChoose(page, choiceId);
      await reloadSavedRun(page);
      // The vigil tap commits story.endingId and force-saves. On reload the
      // ending is hydrated, #vigilChoice (and #meetOrraButton inside it) is
      // hidden, and lineForBeat returns "" — so there is no meet-orra control
      // to tap and #line is empty. Recognition is read from boot hydration of
      // Orra's vigil memory, published on window.__game.
      if (!breakMode) {
        await page.waitForFunction(
          (lineId) => (window as any).__game?.npcs?.orra?.lastLineId === lineId,
          ORRA_RETURN_LINE_ID[choiceId],
          { timeout: WAIT_MS },
        );
      }

      const actedSnapshot = await readNpcSnapshot(page);
      const assertRecognized = () => {
        expect(actedSnapshot.orraLine.length).toBeGreaterThan(0);
        expect(actedSnapshot.orraRefs).toContain(ORRA_RETURN_LINE_ID[choiceId]);
        const ioRefs = new Set(actedSnapshot.ioRefs);
        expect(ioRefs.has(IO_RETURN_MEMORY_ID.sealed) || ioRefs.has(IO_RETURN_MEMORY_ID.opened)).toBe(true);
      };

      if (breakMode) {
        let didThrow = false;
        try { assertRecognized(); } catch { didThrow = true; }
        expect(didThrow, `FLAGSHIP_BREAK_MODE=${breakMode} must fail served recognition`).toBe(true);
        continue;
      }

      assertRecognized();
      const expectedOrraLine = ORRA_LINE_COPY_BY_ID[ORRA_RETURN_LINE_ID[choiceId]];
      expect(expectedOrraLine).toBeTruthy();
      await expect(page.locator("#line")).toHaveText(expectedOrraLine, { timeout: WAIT_MS });
      expect(actedSnapshot.orraLine).toBe(expectedOrraLine);

      const controlSlot = `orra-control-${choiceId}-${Date.now()}`;
      await page.goto(`/aftersign/?slot=${controlSlot}`, { waitUntil: "load" });
      await waitForVersion(page);
      await runIoBeats(page);
      await tapMeetOrra(page);
      await waitForFirstContact(page);
      const controlSnapshot = await readNpcSnapshot(page);
      expect(controlSnapshot.orraLine.length).toBeGreaterThan(0);
      expect(controlSnapshot.orraRefs.includes(ORRA_FIRST_CONTACT_LINE_ID) || controlSnapshot.orraLine !== actedSnapshot.orraLine).toBe(true);
      expect(controlSnapshot.orraLine).not.toBe(actedSnapshot.orraLine);
    }
  });
});
