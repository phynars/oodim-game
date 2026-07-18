import { test, expect, type Page } from "@playwright/test";

import { assertFlagshipWindowGameProbe } from "../../e2e-shared/flagshipWindowGameContract";

// CI-gate for the flagship `window.__game` story/state probe.
//
// `assertFlagshipWindowGameProbe` lives in
// `e2e-shared/flagshipWindowGameContract.ts` (repo convention for
// shared spec helpers — see `flagshipStoryStateContract.ts` next to it;
// prior attempts at `packages/flagship-harness/` were an orphan tree
// with no workspace, tsconfig, or npm script wiring, and CI went red
// for that exact reason). It validates the slice-1 subset of the
// documented `FlagshipGameSurface` (`docs/flagship/story-state-contract.md`):
// the harness cannot claim a story beat exists unless the page publishes
// a slug, a durable player identity, a story beat/act, and a serializable
// state object.
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

// The published surface (aftersign/index.html publishState()) attaches
// live methods (`getSnapshot`, `reset`, `input.*`). page.evaluate JSON-
// clones the return value across the CDP boundary, so functions are
// stripped anyway — but we do the projection explicitly in the browser
// so what the probe sees is exactly what Playwright's serializer would
// have delivered, and the failure message can quote it verbatim.
type Probe = Record<string, unknown>;

async function readProbe(page: Page): Promise<Probe> {
  await page.waitForFunction(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).__game;
      return !!g && typeof g === "object" && g.version === 1;
    },
    undefined,
    { timeout: WAIT_MS },
  );
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__game;
    // Deep JSON round-trip strips functions and undefined so the probe
    // receives the same shape it would over the CDP boundary.
    return JSON.parse(
      JSON.stringify(g, (_key, value) =>
        typeof value === "function" ? undefined : value,
      ),
    ) as Probe;
  });
}

test.describe("AFTERSIGN flagship window.__game contract", () => {
  test("window.__game satisfies the slice-1 story/state probe", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    page.on("pageerror", (err) => {
      // eslint-disable-next-line no-console
      console.error(`[aftersign window-game-contract] pageerror: ${err.message}`);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        // eslint-disable-next-line no-console
        console.error(`[aftersign window-game-contract] console.error: ${msg.text()}`);
      }
    });

    await page.goto(
      `/aftersign/?slot=flagship-window-game-${Date.now()}`,
      { waitUntil: "load" },
    );

    const probe = await readProbe(page);

    // Wrap the assertion so a failure surfaces WHICH invariant tripped
    // AND the probe shape that tripped it — the CI log then names the
    // exact contract gap without an artifact download.
    let failure: Error | null = null;
    try {
      assertFlagshipWindowGameProbe(probe, { expectedSlug: "aftersign" });
    } catch (err) {
      failure = err instanceof Error ? err : new Error(String(err));
    }
    expect(
      failure,
      failure
        ? `probe assertion failed: ${failure.message}`
        : "probe assertion passed",
    ).toBeNull();
  });
});
