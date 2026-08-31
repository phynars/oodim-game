import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// M-LOOP acceptance must be played on the served AFTERSIGN page, not driven
// through the harness bridge. Playtest specs live at repo-root
// `aftersign/e2e/`, not under apps/web.
const AFTERSIGN_E2E_DIR = join(process.cwd(), "aftersign", "e2e");

const PHONE_VIEWPORT_PATTERN = /(?:375\s*,\s*812|390\s*,\s*844|414\s*,\s*896|iphone|pixel|mobile|isMobile\s*:\s*true)/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const VISIBLE_ASSERTION_PATTERN = /\b(?:toBeVisible|getByRole|getByText|getByLabelText|locator)\s*\(/;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const HARNESS_READ_PATTERN = /(?:window\.)?__game\b/;
const DIVERGENT_SAVE_PATTERN = /(?:two divergent saves|divergent save|different memory records|seed[s]? two|first-time player|trusted courier|trust posture|prior outcomes|debts)/i;
const DIFFERENT_ACTIONS_PATTERN = /(?:different available actions|different tappable actions|different job offers|different offers|different prices|different open routes|appears or disappears|unlocks|route.*unlock|offer.*different)/i;
const ELEMENT_LEVEL_ASSERTION_PATTERN = /(?:getByRole\([^)]*button|locator\([^)]*(?:button|\[role=["']button["']|data-testid|offer|route|price)|toHaveCount|allTextContents|evaluateAll)/i;
const ROUND_COMPLETION_PATTERN = /(?:two consecutive rounds|complete[s]? two|round one|next round|second round|take a job|run the route|deliver and answer|world pays it back)/i;

function readAftersignPlaytestSpecs(): Array<{ path: string; source: string }> {
  if (!existsSync(AFTERSIGN_E2E_DIR)) {
    return [];
  }

  return readdirSync(AFTERSIGN_E2E_DIR)
    .filter((fileName) => /playtest.*\.spec\.(?:ts|js)$|\.playtest\.spec\.(?:ts|js)$/i.test(fileName))
    .map((fileName) => ({
      path: join(AFTERSIGN_E2E_DIR, fileName),
      source: readFileSync(join(AFTERSIGN_E2E_DIR, fileName), "utf8"),
    }));
}

function matchesMemoryDivergencePlaytest(source: string): boolean {
  return (
    PHONE_VIEWPORT_PATTERN.test(source) &&
    PLAYER_EVENT_PATTERN.test(source) &&
    VISIBLE_ASSERTION_PATTERN.test(source) &&
    HARNESS_READ_PATTERN.test(source) &&
    !HARNESS_INPUT_PATTERN.test(source) &&
    DIVERGENT_SAVE_PATTERN.test(source) &&
    DIFFERENT_ACTIONS_PATTERN.test(source) &&
    ELEMENT_LEVEL_ASSERTION_PATTERN.test(source) &&
    ROUND_COMPLETION_PATTERN.test(source)
  );
}

describe("AFTERSIGN M-LOOP memory divergence played acceptance surface", () => {
  it("has a taps-only phone playtest proving divergent memories create different tappable actions", () => {
    const playtests = readAftersignPlaytestSpecs();
    const matchingPlaytest = playtests.find(({ source }) => matchesMemoryDivergencePlaytest(source));

    expect(
      matchingPlaytest?.path,
      [
        "M-LOOP acceptance must prove memory as a mechanical progression system on the served page.",
        "Add or update an aftersign/e2e/*playtest*.spec.ts (repo-root, NOT under apps/web) that:",
        "  - uses a phone-shaped/mobile viewport,",
        "  - seeds or reaches two saves with different memory records,",
        "  - plays by visible player events only (tap/click/press/pointer/etc.),",
        "  - asserts element-level DIFFERENT tappable actions: job offers, prices, or open routes,",
        "  - extends the standing playtest to complete TWO consecutive rounds,",
        "  - reads window.__game only as an assertion surface, and",
        "  - takes no input through window.__game.input.*.",
        `Scanned ${playtests.length} playtest spec(s): ${playtests.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });
});
