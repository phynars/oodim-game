import { expect, test } from "@playwright/test";

// M-CONTINUE player proof: after `io-return-recognition`, the served page must
// continue into `return-tone-choice` and `io-next-job` through visible taps only.
// `window.__game` is intentionally not used as an input surface here.

test.describe("AFTERSIGN M-CONTINUE visible continuation", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("plays past io-return-recognition into return-tone and next-job by tapping rendered UI", async ({
    page,
  }) => {
    await page.goto("/aftersign/");

    const stage = page.locator("body");
    await expect(stage).toBeVisible();

    // Advance like a player: tap only rendered surface/controls, never the harness.
    for (let tap = 0; tap < 24; tap += 1) {
      const returnRecognition = page.getByText(/io-return-recognition|remember|recognition/i);
      if (await returnRecognition.first().isVisible().catch(() => false)) {
        break;
      }
      await stage.tap({ position: { x: 195, y: 690 } });
    }

    await expect(page.getByText(/io-return-recognition|remember|recognition/i).first()).toBeVisible();

    const toneChoice = page
      .getByRole("button", { name: /steady|gentle|sharp|return-tone|tone/i })
      .first();
    await expect(toneChoice).toBeVisible();
    await toneChoice.tap();

    await expect(page.getByText(/return-tone|tone|answer|reply/i).first()).toBeVisible();

    for (let tap = 0; tap < 8; tap += 1) {
      const nextJob = page.getByText(/io-next-job|next job|job|delivery|packet/i);
      if (await nextJob.first().isVisible().catch(() => false)) {
        break;
      }
      await stage.tap({ position: { x: 195, y: 690 } });
    }

    await expect(page.getByText(/io-next-job|next job|job|delivery|packet/i).first()).toBeVisible();
  });
});
