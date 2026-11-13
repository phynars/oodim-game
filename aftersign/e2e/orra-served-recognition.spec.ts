import { test, expect, type Page } from "@playwright/test";

import { IO_RETURN_MEMORY_ID } from "../../e2e-shared/flagshipStoryStateContract";
import { ORRA_LINE_COPY_BY_ID } from "../src/orraRuntimeLane";
import { recordSaveRequests, waitForLandedEndingSave } from "./helpers/saveRequests";

const WAIT_MS = 60_000;
const COLD_START_MS = 180_000;
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
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
  ioMemoryObjects: string[];
}> {
  return page.evaluate(() => {
    const game = (window as any).__game;
    const ioMemories: Array<{ object?: unknown }> = Array.isArray(game?.npcs?.io?.memories)
      ? game.npcs.io.memories
      : [];
    return {
      orraLine: game?.npcs?.orra?.lastLine ?? "",
      orraRefs: game?.npcs?.orra?.lastLineMemoryRefs ?? [],
      ioLine: game?.npcs?.io?.lastLine ?? "",
      ioRefs: game?.npcs?.io?.lastLineMemoryRefs ?? [],
      ioMemoryObjects: ioMemories.map((memory) => String(memory?.object ?? "")),
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
  // The served walk is tap-played (locator.tap()), which requires a touch
  // context. The default project is "Desktop Chrome" (no touch), so opt in
  // at phone size — same pattern as aftersign-audio-runtime.playtest.spec.ts.
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("M-ORRA-E1 served flow: visible first contact and vigil recognition survive reload", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    const breakMode = currentBreakMode();
    if (breakMode) {
      await page.addInitScript((mode: string) => {
        (window as unknown as { __FLAGSHIP_BREAK_MODE?: string }).__FLAGSHIP_BREAK_MODE = mode;
      }, breakMode);
    }

    const saves = recordSaveRequests(page);
    for (const choiceId of ["light-vigil", "spare-vigil"] as const) {
      const slot = `orra-served-${choiceId}-${Date.now()}`;
      const breakQuery = breakMode ? `&breakMode=${encodeURIComponent(breakMode)}` : "";
      await page.goto(`/aftersign/?slot=${slot}${breakQuery}`, { waitUntil: "load" });
      await waitForVersion(page);
      await runIoBeats(page);
      const endingsBefore = saves.landedEndingIds.length;
      await meetOrraAndChoose(page, choiceId);
      // `save.dirty` can already read false from an earlier save, so
      // reloadSavedRun's wait does not prove the vigil's save landed. Wait
      // for the server to hold the ending first (a break mode may keep the
      // save off the server, so only on the unbroken run).
      if (!breakMode) await waitForLandedEndingSave(saves, endingsBefore, WAIT_MS);
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
        // Io stays correct across the reload. The ending clears Io's spoken
        // line and line refs (main.js vigil branch + lineForBeat ending
        // branch), so read her DURABLE memory instead: it must still hold
        // the packet outcome. Keep the legacy ref ids as an alternative.
        const ioRefs = new Set(actedSnapshot.ioRefs);
        const ioRemembersOutcome =
          ioRefs.has(IO_RETURN_MEMORY_ID.sealed)
          || ioRefs.has(IO_RETURN_MEMORY_ID.opened)
          || actedSnapshot.ioMemoryObjects.includes("sealed")
          || actedSnapshot.ioMemoryObjects.includes("opened");
        expect(ioRemembersOutcome).toBe(true);
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
      // Expected copy comes from the shipped copy table, not from
      // window.__game, so the comparison is not self-referential.
      expect(actedSnapshot.orraLine).toBe(expectedOrraLine);
      // `#line` is blank on a restored ending (lineForBeat returns ""), so
      // the served proof is the re-rendered ending card instead.
      await expect(page.locator("#episodeOneEnding [data-ending-id]")).toBeVisible({ timeout: WAIT_MS });
      await expect(page.locator("#meetOrraButton")).toBeHidden({ timeout: WAIT_MS });

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
