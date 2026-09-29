import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const value = window.__game?.scene?.beat;
          return typeof value === "string" ? value : null;
        }),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const button = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(button).toBeVisible();
  await button.tap();
}

test.describe("AFTERSIGN recognition reload playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("keeps Io's recognition beat and rendered tone controls after a phone-player reload", async ({
    page,
  }) => {
    const slot = `recognition-reload-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForGame(page);
    await waitForBeat(page, "packet-offered");

    await expect(page.locator("#packetButton")).toBeVisible();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");
    await waitForBeat(page, "io-return-recognition");
    await expect(page.getByText(/you came back/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Kind return", exact: true })).toBeVisible();

    await page.reload({ waitUntil: "load" });
    await waitForGame(page);
    await waitForBeat(page, "io-return-recognition");
    await expect(page.getByText(/you came back/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Kind return", exact: true })).toBeVisible();
  });
});
