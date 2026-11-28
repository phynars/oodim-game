import { expect, test } from "@playwright/test";

const WAIT_MS = 20_000;

async function waitForBeat(page: import("@playwright/test").Page, beat: string): Promise<void> {
  await expect.poll(
    () => page.evaluate(() => (window as unknown as { __game?: { scene?: { beat?: string } } }).__game?.scene?.beat),
    { timeout: WAIT_MS },
  ).toBe(beat);
}

test("visible Act I packet choice remains selected by the delegated dialogue branch", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto(`?slot=dialogue-selection-${Date.now()}`, { waitUntil: "load" });
  await waitForBeat(page, "packet-offered");
  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");
  await expect(page.locator("#line")).toHaveText(
    "Good. Some doors only open for people who can carry a secret without looking inside.",
    { timeout: WAIT_MS },
  );
});
