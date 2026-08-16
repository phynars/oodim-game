import { test, expect, type Page } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

async function waitForAnyBeat(page: Page, beatIds: readonly string[]): Promise<string> {
  await page.waitForFunction(
    (ids) => ids.some((id) => Boolean(document.querySelector(`[data-beat-id="${id}"]`))),
    beatIds,
    { timeout: WAIT_MS },
  );

  const beatId = await page.evaluate((ids) => {
    for (const id of ids) {
      if (document.querySelector(`[data-beat-id="${id}"]`)) {
        return id;
      }
    }
    return null;
  }, beatIds);

  if (!beatId) {
    throw new Error(`Expected one of beats to be visible: ${beatIds.join(", ")}`);
  }

  return beatId;
}

async function clickChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`[data-choice-id="${choiceId}"]`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

async function clickFirstVisibleChoice(page: Page): Promise<string> {
  const choiceId = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("button[data-choice-id]"));
    for (const node of nodes) {
      const element = node as HTMLButtonElement;
      if (element.disabled) {
        continue;
      }
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        continue;
      }
      const id = element.getAttribute("data-choice-id");
      if (id) {
        return id;
      }
    }
    return null;
  });

  if (!choiceId) {
    throw new Error("No visible enabled [data-choice-id] button found");
  }

  await clickChoice(page, choiceId);
  return choiceId;
}

test.describe("AFTERSIGN phone tap progression via visible DOM selectors", () => {
  test("progresses packet-choice to next-job using data-beat-id/data-choice-id taps", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(`/aftersign/?slot=phone-tap-visible-choice-${Date.now()}`, { waitUntil: "load" });

    await waitForAnyBeat(page, ["packet-choice"]);
    await clickChoice(page, "deliver-packet");

    const afterDeliveryBeat = await waitForAnyBeat(page, ["packet-delivered", "return-recognition", "io-return-recognition"]);
    if (afterDeliveryBeat === "packet-delivered") {
      await clickChoice(page, "return-to-io");
    }

    await waitForAnyBeat(page, ["return-recognition", "io-return-recognition"]);
    await clickFirstVisibleChoice(page);

    await waitForAnyBeat(page, ["return-tone-choice", "io-return-tone-choice"]);
    await clickFirstVisibleChoice(page);

    await waitForAnyBeat(page, ["next-job", "io-next-job"]);
  });
});
