import { expect, test, type Page } from "@playwright/test";
import { playRoute } from "./helpers/route";
import { nextJob, type ReturnReason } from "./helpers/routes";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const TONES: ReturnReason[] = ["kind", "evasive", "blunt"];

async function offerAfterReturn(page: Page, tone: ReturnReason): Promise<string> {
  const slot = `return-tone-disclosure-${tone}-${Date.now()}`;
  await playRoute(page, `/aftersign/?slot=${slot}&player=e2e-${slot.slice(-6)}`, nextJob(tone));

  await expect(page.locator("#ioNextJobToneDisclosure")).toHaveText(
    `Your ${tone} return changes Io's wording, not the job offer.`,
  );
  return page.locator("#packetButton").innerText();
}

test.describe("AFTERSIGN return-tone next-job disclosure", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  for (const tone of TONES) {
    test(`${tone} return names its own tone and keeps the same next-job offer`, async ({ page }) => {
      const offer = await offerAfterReturn(page, tone);
      expect(offer).toBe("Red tag — Saint Orra");
    });
  }
});
