import { test, expect, type Page } from "@playwright/test";

import {
  assertDurableSaveLoaded,
  assertSerializableFlagshipSurface,
  type FlagshipGameSurface,
} from "../../e2e-shared/flagshipStoryStateContract";

// Cold-start budget: SwiftShader init + first WebGL context.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: FlagshipGameSurface;
  }
}

// The default aftersign lane keeps this contract skipped because the
// slice-1 impl is honestly `save.authority: 'local-fallback'` — no
// server round-trip exists yet, so `save.lastLoadProof.source === 'server'`
// (required by assertDurableSaveLoaded) cannot pass. Skipping here keeps
// the default lane honest.
//
// The red-polarity lane at .github/workflows/aftersign-durable-save-redgreen.yml
// unskips this same spec via FLAGSHIP_BREAK_MODE=local-only-save and
// inverts the exit code — the spec MUST fail under local-only-save,
// proving the durable guard catches the missing server path. The
// preflight there greps for the literal string
// `process.env.FLAGSHIP_BREAK_MODE !== "local-only-save"` — do not
// reformat that comparison without updating the workflow.
test.skip(
  process.env.FLAGSHIP_BREAK_MODE !== "local-only-save",
  "durable save/load requires server authority — skipped until server-backed save lands (see docs/flagship/story-state-contract.md §'save')",
);

async function waitForVersion(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function readSurface(page: Page): Promise<FlagshipGameSurface> {
  await waitForVersion(page);
  return page.evaluate(() => window.__game as FlagshipGameSurface);
}

test("durable save/load: authoritative reload survives clearLocalState", async ({ page }) => {
  test.setTimeout(COLD_START_MS);

  const slot = `flagship-durable-${Date.now()}`;
  // Under FLAGSHIP_BREAK_MODE=local-only-save the impl reports
  // `save.authority: 'local-fallback'` and `lastLoadProof.source: null`
  // after a clearLocalState reload — assertDurableSaveLoaded MUST reject
  // that, which is exactly what the red-polarity CI job requires.
  await page.goto(`/aftersign/?slot=${slot}&breakMode=local-only-save`, { waitUntil: "load" });
  await readSurface(page);

  await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
  await page.evaluate(() => window.__game!.input.waitForStoryIdle());
  await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
  await page.evaluate(() => window.__game!.input.waitForStoryIdle());
  await page.evaluate(() => window.__game!.input.forceSave());
  await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
    timeout: WAIT_MS,
  });

  const beforeReload = await readSurface(page);
  assertSerializableFlagshipSurface(beforeReload);
  expect(beforeReload.delivery.outcome).toBe("sealed");
  expect(beforeReload.save.dirty).toBe(false);

  await page.evaluate(() => window.__game!.input.forceReload({ clearLocalState: true }));
  const afterReload = await readSurface(page);

  // Must throw under local-only-save (no server path); the red-polarity
  // lane inverts the exit code, so this failure IS the proof.
  assertDurableSaveLoaded(beforeReload, afterReload);
});
