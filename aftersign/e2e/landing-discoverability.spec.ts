import { test, expect } from "@playwright/test";

// Landing-page discoverability harness for AFTERSIGN.
//
// The portfolio index at landing/index.html is where every first-touch
// visitor lands. The AFTERSIGN card there is the flagship's discoverability
// surface — remove or break the card and no player finds their way in.
// This spec pins:
//   1. an anchor labelled "aftersign" exists and is visible,
//   2. its href actually points at ./aftersign/ (not e.g. #, /aftersign, or
//      an accidental external URL),
//   3. the card renders its "AFTERSIGN" heading + an "In development" status
//      pill (so the card copy hasn't collapsed to an empty shell).
//
// Runs under the aftersign playwright lane (see aftersign/playwright.config.ts
// — a second webServer serves landing/ on :4375). Absolute URL used because
// the config's baseURL points at the aftersign game (:4374/aftersign/).
//
// Scope note: this spec asserts the CARD's presence + link + status; it does
// NOT verify visual polish, hover animation, or the copy word-for-word. Those
// are landing-side concerns, not flagship-discoverability concerns.

const LANDING_URL = "http://localhost:4375/";

test.describe("landing page discoverability — AFTERSIGN card", () => {
  test("AFTERSIGN card is visible and links to ./aftersign/", async ({ page }) => {
    await page.goto(LANDING_URL);

    const card = page.getByRole("link", { name: /aftersign/i });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "./aftersign/");

    await expect(
      page.getByRole("heading", { name: "AFTERSIGN" }),
    ).toBeVisible();
    await expect(page.getByText(/in development/i).first()).toBeVisible();
  });
});
