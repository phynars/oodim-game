import { test, expect, type Page } from "@playwright/test";

import { assertFlagshipWindowGameProbe } from "../../packages/flagship-harness/src/window-game-contract";

// CI-gate for the flagship `window.__game` story/state probe.
//
// `assertFlagshipWindowGameProbe` lives in
// `packages/flagship-harness/src/window-game-contract.ts` and validates
// the slice-1 subset of the documented `FlagshipGameSurface`
// (`docs/flagship/story-state-contract.md`): the harness cannot claim a
// story beat exists unless the page publishes a slug, a durable player
// identity, a story beat/act, and a serializable state object.
//
// Prior to this spec the assertion module was orphaned in the same
// pattern Soren filed as #699 (`runPacketIntentChecks()` with no
// runner). This spec is the runner: `test:e2e:aftersign` invokes it
// through the existing Playwright config.
//
// The end-to-end memory / durable-save contract is separately pinned by
// `flagship-surface-contract.spec.ts`; this spec is the narrow probe
// that gates the smallest window.__game shape before gameplay code
// claims any story beat.

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: unknown;
  }
}

async function waitForFlagshipSurface(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const g = window.__game as { version?: unknown } | undefined;
      return !!g && typeof g === "object" && (g.version === 1 || "story" in g || "scene" in g);
    },
    undefined,
    { timeout: WAIT_MS },
  );
}

test.describe("AFTERSIGN flagship window.__game contract", () => {
  test("window.__game satisfies the slice-1 story/state probe", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(
      `/aftersign/?slot=flagship-window-game-${Date.now()}`,
      { waitUntil: "load" },
    );
    await waitForFlagshipSurface(page);

    const probe = await page.evaluate(() => window.__game);

    expect(() =>
      assertFlagshipWindowGameProbe(probe, { expectedSlug: "aftersign" }),
    ).not.toThrow();
  });
});
