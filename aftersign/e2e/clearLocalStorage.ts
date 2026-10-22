import { expect, type Page } from "@playwright/test";

/**
 * Removes origin-local fallback state before a recovery navigation and waits
 * until the browser exposes the empty store.
 */
export async function clearLocalStorage(page: Page, timeout: number): Promise<void> {
  await page.evaluate(() => window.localStorage.clear());
  await expect
    .poll(() => page.evaluate(() => window.localStorage.length), { timeout })
    .toBe(0);
}
