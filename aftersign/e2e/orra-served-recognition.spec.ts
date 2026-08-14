import { test, expect, type Page } from "@playwright/test";

import { IO_RETURN_MEMORY_ID } from "../../e2e-shared/flagshipStoryStateContract";

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
  if (raw === "orra-dropped" || raw === "orra-wrong" || raw === "orra-io-contamination") {
    return raw;
  }
  return null;
}

async function waitForVersion(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function waitForStoryIdle(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).__game!.input.waitForStoryIdle());
}

async function tryChooseById(page: Page, id: string): Promise<boolean> {
  const ok = await page.evaluate((choiceId) => {
    try {
      const input = (window as any).__game?.input;
      if (!input || typeof input.choose !== "function") return false;
      input.choose(choiceId);
      return true;
    } catch {
      return false;
    }
  }, id);
  if (ok) {
    await waitForStoryIdle(page);
  }
  return ok;
}

async function clickChoiceViaDom(page: Page, variants: readonly string[]): Promise<boolean> {
  const clicked = await page.evaluate((candidates) => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("button, [role='button'], [data-choice-id], [data-choice], [data-choiceid]"),
    );
    const lowered = candidates.map((entry) => entry.toLowerCase());

    const normalize = (value: string | null | undefined): string =>
      (value ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    for (const node of nodes) {
      const text = normalize(node.textContent);
      const attrs = [
        normalize(node.getAttribute("data-choice-id")),
        normalize(node.getAttribute("data-choice")),
        normalize(node.getAttribute("data-choiceid")),
        normalize(node.getAttribute("aria-label")),
        normalize(node.id),
        text,
      ].filter(Boolean);

      const matches = lowered.some((needle) => attrs.some((hay) => hay.includes(needle)));
      if (!matches) continue;

      node.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, button: 0, buttons: 1 }));
      node.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, button: 0, buttons: 0 }));
      node.click();
      return true;
    }

    return false;
  }, variants);

  if (clicked) {
    await waitForStoryIdle(page);
  }
  return clicked;
}

async function choose(page: Page, preferredId: string, variants: readonly string[]): Promise<void> {
  const byId = await tryChooseById(page, preferredId);
  if (byId) return;

  const byDom = await clickChoiceViaDom(page, variants);
  expect(byDom, `Expected choice '${preferredId}' via id or DOM variants [${variants.join(", ")}]`).toBe(true);
}

async function forceSaveReload(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).__game!.input.forceSave());
  await page.waitForFunction(() => (window as any).__game?.save?.dirty === false, undefined, {
    timeout: WAIT_MS,
  });
  await page.evaluate(() => (window as any).__game!.input.forceReload({ clearLocalState: true }));
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
  await choose(page, "keep-sealed", ["keep-sealed", "preserve", "seal"]);
  await choose(page, "deliver-packet", ["deliver-packet", "deliver packet", "deliver"]);
  await choose(page, "return-to-io", ["return-to-io", "return to io", "return next session", "return"]);
}

async function meetOrraAndChoose(page: Page, choiceId: OrraChoiceId): Promise<void> {
  await choose(page, "meet-orra", ["meet orra", "saint orra", "orra", "vigil"]);
  await choose(page, choiceId, [choiceId, choiceId.replace("-", " "), "vigil"]);
}

test.describe("served Orra recognition lane", () => {
  test.describe.configure({ mode: "serial" });

  test("M-ORRA-E1 served flow: Orra remembers vigil action across reload, first-contact stays distinct, Io stays correct", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    const breakMode = currentBreakMode();

    for (const choiceId of ["light-vigil", "spare-vigil"] as const) {
      const slot = `orra-served-${choiceId}-${Date.now()}`;
      await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForVersion(page);

      await runIoBeats(page);
      await meetOrraAndChoose(page, choiceId);

      await forceSaveReload(page);
      await choose(page, "return-to-io", ["return-to-io", "return to io", "return next session", "return"]);
      await choose(page, "meet-orra", ["meet orra", "saint orra", "orra", "vigil"]);

      const actedSnapshot = await readNpcSnapshot(page);

      const assertRecognized = () => {
        expect(actedSnapshot.orraLine.length).toBeGreaterThan(0);
        expect(actedSnapshot.orraRefs).toContain(ORRA_RETURN_LINE_ID[choiceId]);

        expect(actedSnapshot.ioLine.length).toBeGreaterThan(0);
        const ioRefSet = new Set(actedSnapshot.ioRefs);
        expect(ioRefSet.has(IO_RETURN_MEMORY_ID.sealed) || ioRefSet.has(IO_RETURN_MEMORY_ID.opened)).toBe(true);
      };

      if (breakMode === "orra-dropped" || breakMode === "orra-wrong" || breakMode === "orra-io-contamination") {
        let didThrow = false;
        try {
          assertRecognized();
        } catch {
          didThrow = true;
        }
        expect(
          didThrow,
          `FLAGSHIP_BREAK_MODE=${breakMode} must make served Orra recognition assertions fail for ${choiceId}; it did not.`,
        ).toBe(true);
        continue;
      }

      assertRecognized();

      const controlSlot = `orra-control-${choiceId}-${Date.now()}`;
      await page.goto(`/aftersign/?slot=${controlSlot}`, { waitUntil: "load" });
      await waitForVersion(page);
      await runIoBeats(page);
      await choose(page, "meet-orra", ["meet orra", "saint orra", "orra", "vigil"]);

      const controlSnapshot = await readNpcSnapshot(page);
      expect(controlSnapshot.orraLine.length).toBeGreaterThan(0);
      expect(
        controlSnapshot.orraRefs.includes(ORRA_FIRST_CONTACT_LINE_ID) ||
          controlSnapshot.orraLine !== actedSnapshot.orraLine,
      ).toBe(true);
      expect(controlSnapshot.orraLine).not.toBe(actedSnapshot.orraLine);
    }
  });
});
