import { expect, test } from "@playwright/test";

const productionUrl = process.env.AFTERSIGN_PRODUCTION_URL;
const deployedSha = process.env.AFTERSIGN_DEPLOYED_SHA;

test.describe("AFTERSIGN production save deployment evidence", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("requires an operator-recorded deployment SHA before live persistence evidence can pass", async ({
    page,
  }) => {
    test.skip(
      !productionUrl,
      "Set AFTERSIGN_PRODUCTION_URL for the operator-coordinated production run.",
    );

    expect(
      deployedSha,
      "Set AFTERSIGN_DEPLOYED_SHA to the deployed revision verified by this run.",
    ).toMatch(/^[0-9a-f]{7,64}$/i);

    await page.goto(`${productionUrl.replace(/\/$/, "")}/aftersign/`, {
      waitUntil: "load",
    });
    await expect(page.locator("[data-beat-id]").first()).toBeVisible();
  });
});
