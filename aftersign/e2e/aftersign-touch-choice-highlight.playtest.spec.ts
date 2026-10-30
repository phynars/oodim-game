import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test("touch delivery does not pre-highlight a newly rendered return choice", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "held-touch :active needs Chromium CDP");

  await page.goto(`/aftersign/?slot=touch-choice-highlight-${Date.now()}`);

  // Precondition: this context is a touch device, so the mouse-only
  // :active preview must not apply here.
  expect(
    await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches),
  ).toBe(false);

  const deliver = page.locator("#deliverButton");
  await expect(deliver).toContainText(/deliver packet/i);
  await deliver.tap();

  const kindReturn = page.locator("#acknowledgeRouteButton");
  await expect(kindReturn).toContainText(/kind return/i);
  await expect(kindReturn).toBeEnabled();

  // Hold a real touch on the newly rendered choice. Playwright's tap()
  // releases immediately, so :active never sticks — that is why the earlier
  // assertion passed on main. A held CDP touch keeps :active on the button,
  // the same state a touch browser keeps after a beat swaps the control.
  const box = await kindReturn.boundingBox();
  if (!box) throw new Error("Kind return button has no layout box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });

  try {
    // The retained state the bug depends on really is present.
    await expect
      .poll(() => kindReturn.evaluate((el) => el.matches(":active")), { timeout: 5000 })
      .toBe(true);

    // On main, button:active applies brightness(1.14) + a press transform
    // here; with the fix, touch :active carries no generic highlight.
    await expect(kindReturn).toHaveCSS("filter", "none", { timeout: 2000 });
    await expect(kindReturn).toHaveCSS("transform", "none", { timeout: 2000 });
  } finally {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }

  await expect(kindReturn).toBeDisabled();
  await expect(page.locator("#skipRouteButton")).toBeDisabled();
  await expect(page.locator("#deliverButton")).toContainText(/ask for next job/i);
});
