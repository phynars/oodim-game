import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };

async function visibleText(page: Parameters<Parameters<typeof test>[1]>[0]["page"], pattern: RegExp) {
  const locator = page.getByText(pattern).first();
  await expect(locator).toBeVisible();
  return locator;
}

async function tapFirstVisible(page: Parameters<Parameters<typeof test>[1]>[0]["page"], patterns: RegExp[]) {
  for (const pattern of patterns) {
    const candidate = page.getByRole("button", { name: pattern }).first();
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.tap();
      return;
    }
  }

  throw new Error(`No visible player control matched: ${patterns.map(String).join(", ")}`);
}

test.describe("Aftersign M-CONTINUE played acceptance", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone player taps past Io return recognition into the next-job handoff", async ({
    page,
  }) => {
    await page.goto("/aftersign/");

    await visibleText(page, /io/i);

    await tapFirstVisible(page, [/sealed/i, /deliver/i, /packet/i, /begin/i, /continue/i]);
    await visibleText(page, /remember|sealed|packet|again|back/i);

    await tapFirstVisible(page, [/blunt/i, /careful/i, /honest/i, /tone/i, /continue/i]);
    await visibleText(page, /return|tone|said|answer/i);

    await tapFirstVisible(page, [/next job/i, /ask/i, /work/i, /continue/i]);
    await visibleText(page, /orra|saint|name|debt|next job/i);

    const snapshot = await page.evaluate(() => window.__game?.getSnapshot?.());
    expect(snapshot?.story?.beat).toBe("io-next-job");
    expect(snapshot?.story?.completedBeats).toEqual(
      expect.arrayContaining(["return-tone-choice", "io-next-job"]),
    );
  });
});
