import { expect, test, type Page } from "@playwright/test";

// #2715: when `persist()` catches a browser storage error, callers must
// surface a non-blocking notice to the player AND keep the live save
// dirty so the next save retries. This spec drives `forceSave` through
// the harness against a real `Storage.prototype.setItem` that throws a
// `QuotaExceededError`, asserts the visible `#localSaveFailureNotice`
// (role=status, aria-live=polite, expected copy), then flips the throw
// flag off and confirms the retry clears both the dirty flag and the
// notice. Covers F1 (no spec showed the notice/retry) and F2 (the
// failure branch in `persist()` never ran against throwing storage).

declare global {
  interface Window {
    __FLAGSHIP_BREAK_MODE?: string;
    __AFTERSIGN_THROW_LOCAL_SAVE?: boolean;
    __game?: {
      input: {
        forceSave: () => boolean | Promise<boolean>;
      };
      getSnapshot: () => { save: { dirty: boolean } };
    };
  }
}

const SURFACE_WAIT_MS = 30_000;
const NOTICE_SELECTOR = "#localSaveFailureNotice";
const NOTICE_COPY =
  "Save failed locally. Your progress will retry on the next save.";

async function waitForSurface(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__game?.input?.forceSave === "function",
    null,
    { timeout: SURFACE_WAIT_MS },
  );
}

test("local save failure surfaces a retryable notice and the retry clears it", async ({
  page,
}) => {
  const slot = `local-save-failure-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  await page.addInitScript(() => {
    // Mirror `flagship-reload-beat-regression.spec.ts` for the break
    // mode wiring (see its `playSaveReloadPath` helper). Reading
    // `__FLAGSHIP_BREAK_MODE` happens at `main.js:1025`.
    window.__FLAGSHIP_BREAK_MODE = "local-only-save";
    window.__AFTERSIGN_THROW_LOCAL_SAVE = true;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (
        window.__AFTERSIGN_THROW_LOCAL_SAVE &&
        typeof key === "string" &&
        key.startsWith("aftersign:kiosk-slice:")
      ) {
        const err = new Error("QuotaExceededError") as Error & {
          name: string;
        };
        err.name = "QuotaExceededError";
        throw err;
      }
      return originalSetItem.call(this, key, value);
    };
  });

  await page.goto(`./?slot=${slot}`);
  await waitForSurface(page);

  // First save: storage throws → persist() returns false → notice shows
  // + save stays dirty.
  const failedResult = await page.evaluate(
    async () => await window.__game!.input.forceSave(),
  );
  expect(failedResult).toBe(false);

  const notice = page.locator(NOTICE_SELECTOR);
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(NOTICE_COPY);
  await expect(notice).toHaveAttribute("role", "status");
  await expect(notice).toHaveAttribute("aria-live", "polite");

  const afterFail = await page.evaluate(() =>
    window.__game!.getSnapshot().save.dirty,
  );
  expect(afterFail).toBe(true);

  // Flip the throw flag off and retry: persist() now succeeds → notice
  // clears and save.dirty resets.
  await page.evaluate(() => {
    window.__AFTERSIGN_THROW_LOCAL_SAVE = false;
  });

  const retryResult = await page.evaluate(
    async () => await window.__game!.input.forceSave(),
  );
  expect(retryResult).toBe(true);

  await expect(page.locator(NOTICE_SELECTOR)).toHaveCount(0);
  const afterRetry = await page.evaluate(() =>
    window.__game!.getSnapshot().save.dirty,
  );
  expect(afterRetry).toBe(false);
});
