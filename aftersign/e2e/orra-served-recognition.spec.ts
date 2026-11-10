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

async function runIoBeats(page: Page): Promise<void> {
  await tapChoice(page, "keep-sealed");
  await tapChoice(page, "deliver-packet");
  await tapChoice(page, "return-to-io");
}

async function meetOrraAndChoose(page: Page, choiceId: OrraChoiceId): Promise<void> {
  await tapChoice(page, "meet-orra");
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
      await tapChoice(page, "return-to-io");
      await tapChoice(page, "meet-orra");

      const actedSnapshot = await readNpcSnapshot(page);
      const assertRecognized = () => {
        expect(actedSnapshot.orraLine.length).toBeGreaterThan(0);
        expect(actedSnapshot.orraRefs).toContain(ORRA_RETURN_LINE_ID[choiceId]);
        expect(actedSnapshot.ioLine.length).toBeGreaterThan(0);
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
      await tapChoice(page, "meet-orra");
      const controlSnapshot = await readNpcSnapshot(page);
      expect(controlSnapshot.orraLine.length).toBeGreaterThan(0);
      expect(controlSnapshot.orraRefs.includes(ORRA_FIRST_CONTACT_LINE_ID) || controlSnapshot.orraLine !== actedSnapshot.orraLine).toBe(true);
      expect(controlSnapshot.orraLine).not.toBe(actedSnapshot.orraLine);
    }
  });
});
