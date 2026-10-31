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

  const isActive = () => kindReturn.evaluate((el) => el.matches(":active"));
  // Condition-based wait (no wall-clock sleep, per the #313 harness rule):
  // expect.poll re-evaluates :active until it holds or the timeout expires.
  const waitActive = async (timeout: number) => {
    try {
      await expect.poll(isActive, { timeout }).toBe(true);
      return true;
    } catch {
      return false;
    }
  };

  // A fully specified touch point (id/radius/force) — the bare {x, y} form
  // never set :active in CI (review F1 on PR #2586).
  const point = { x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 };
  const cdp = await page.context().newCDPSession(page);
  let heldWith: "touch" | "mouse" = "touch";
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });

  try {
    if (!(await waitActive(1500))) {
      // Headless Chromium may not route an injected touch into :active.
      // Fall back to a held primary press on the same control. The
      // (hover/pointer) media query describes the DEVICE, not the event,
      // so on this isMobile context the touch-only CSS still governs it.
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      heldWith = "mouse";
      await page.mouse.move(x, y);
      await page.mouse.down();
    }

    // The retained state the bug depends on really is present.
    expect(await waitActive(5000), `:active held via ${heldWith}`).toBe(true);

    // On main, button:active applies brightness(1.14) + a press transform
    // here; with the fix, touch :active carries no generic highlight.
    await expect(kindReturn).toHaveCSS("filter", "none", { timeout: 2000 });
    // The base `button` rule (index.html:815) sets
    // `transform: translate3d(0, 0, 0) scale(1)`, which computes to the
    // identity matrix — never "none". A press transform would scale it.
    await expect(kindReturn).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)", {
      timeout: 2000,
    });
  } finally {
    if (heldWith === "mouse") {
      await page.mouse.up();
    } else {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
  }

  await expect(kindReturn).toBeDisabled();
  await expect(page.locator("#skipRouteButton")).toBeDisabled();
  await expect(page.locator("#deliverButton")).toContainText(/ask for next job/i);
});
