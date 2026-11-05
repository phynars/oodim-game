import { expect, test, type Page } from "@playwright/test";

type Outcome = "sealed" | "opened";
const WAIT_MS = 30_000;

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choice: string): Promise<void> {
  const control = page.locator(`button[data-choice-id="${choice}"]:not([disabled])`).first();
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await control.click();
}

async function choosePacketOutcome(page: Page, outcome: Outcome): Promise<void> {
  const packet = page.locator("#packetButton");
  await expect(packet).toBeVisible({ timeout: WAIT_MS });
  if (outcome === "sealed") {
    await packet.click();
    return;
  }
  const box = await packet.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.move(x + 12, y);
  await page.waitForTimeout(450);
  await page.mouse.up();
}

async function playToLoopAffordance(page: Page, outcome: Outcome): Promise<void> {
  await page.goto(`/aftersign/?slot=io-loop-copy-${outcome}-${Date.now()}`, { waitUntil: "load" });
  await waitForBeat(page, "packet-offered");
  await choosePacketOutcome(page, outcome);
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await expect(page.locator('button[data-return-reason="kind"]')).toBeVisible({ timeout: WAIT_MS });
  await page.locator('button[data-return-reason="kind"]').click();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
}

test.describe("AFTERSIGN Io loop copy is served and player-driven (#2688)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const [outcome, label, line] of [
    ["sealed", "Take another safe job", "You kept the seal. I have another quiet route for you."],
    ["opened", "Take the careful job", "You opened it. This one stays in sight until you return."],
  ] as const) {
    test(`${outcome} packet shows its Io loop label and return line after a visible tap`, async ({ page }) => {
      await playToLoopAffordance(page, outcome);
      const affordance = page.locator("#ioLoopAffordance");
      await expect(affordance).toHaveAttribute("data-aftersign-io-loop-outcome", outcome);
      const button = affordance.getByRole("button", { name: label });
      await expect(button).toBeVisible({ timeout: WAIT_MS });
      await button.click();
      await expect(affordance.getByText(line, { exact: true })).toBeVisible({ timeout: WAIT_MS });
    });
  }
});
