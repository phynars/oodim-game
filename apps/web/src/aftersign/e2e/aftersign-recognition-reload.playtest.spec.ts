import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };

async function waitForBeat(page: import("@playwright/test").Page, beat: string) {
  await expect
    .poll(async () =>
      page.locator("#aftersign").getAttribute("data-story-beat"),
    )
    .toBe(beat);
}

test.describe("AFTERSIGN recognition reload playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("keeps Io's recognition beat and its rendered tone controls after a phone-player reload", async ({
    page,
  }) => {
    await page.goto("/aftersign/");

    await expect(page.locator("#offeredJobs button[data-offered-job-id]").first()).toBeVisible();
    await page.locator("#offeredJobs button[data-offered-job-id]").first().tap();

    await expect(page.getByRole("button", { name: /sealed|open/i }).first()).toBeVisible();
    await page.getByRole("button", { name: /sealed|open/i }).first().tap();

    await expect(page.getByRole("button", { name: /deliver|return/i }).first()).toBeVisible();
    await page.getByRole("button", { name: /deliver|return/i }).first().tap();

    await waitForBeat(page, "io-return-recognition");
    await expect(page.getByText(/you came back/i)).toBeVisible();
    await expect(page.locator("button[data-return-tone]").first()).toBeVisible();

    await page.reload();

    await waitForBeat(page, "io-return-recognition");
    await expect(page.getByText(/you came back/i)).toBeVisible();
    await expect(page.locator("button[data-return-tone]").first()).toBeVisible();
  });
});
