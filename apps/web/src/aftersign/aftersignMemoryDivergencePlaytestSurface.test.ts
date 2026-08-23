import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Playtest specs live at repo-root `aftersign/e2e/`, not under apps/web.
// This guard is intentionally structural: the milestone proof must be a
// played acceptance spec before M-LOOP can be called done.
const AFTERSIGN_E2E_DIR = join(process.cwd(), "aftersign", "e2e");

const PHONE_VIEWPORT_PATTERN = /(?:375\s*,\s*812|390\s*,\s*844|414\s*,\s*896|iphone|pixel|mobile|isMobile\s*:\s*true)/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const VISIBLE_ASSERTION_PATTERN = /\b(?:toBeVisible|getByRole|getByText|getByLabelText|locator)\s*\(/;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const HARNESS_READ_PATTERN = /(?:window\.)?__game\b/;
const DIVERGENT_SAVE_PATTERN = /(?:seed|storageState|localStorage|save|memory|record|fact).{0,120}(?:two|2|both|divergent|different)/is;
const ROUND_PLAY_PATTERN = /(?:round|job|route|delivery).{0,160}(?:round|job|route|delivery)/is;
const ACTION_ELEMENT_PATTERN = /(?:getByRole\s*\(\s*["']button|getByLabelText|locator\s*\().{0,160}(?:job|offer|route|price|shortcut|action|option)/is;
const DIFFERENT_ACTION_ASSERTION_PATTERN = /(?:not\.toEqual|not\.toBe|toHaveCount|arrayContaining|different|diverge|unlocked|available actions|tappable actions)/i;

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
    ROUND_PLAY_PATTERN.test(source) &&
    ACTION_ELEMENT_PATTERN.test(source) &&
    DIFFERENT_ACTION_ASSERTION_PATTERN.test(source)
  );
}

describe("AFTERSIGN memory divergence played acceptance surface", () => {
  it("has a phone playtest proving two memory records produce different tappable actions", () => {
    const playtests = readAftersignPlaytestSpecs();
    const matchingPlaytest = playtests.find(({ source }) => matchesMemoryDivergencePlaytest(source));

    expect(
      matchingPlaytest?.path,
      [
        "M-LOOP divergence acceptance must be played, not driven.",
        "Add or update an aftersign/e2e/*playtest*.spec.ts (repo-root, NOT under apps/web) that:",
        "  - uses a phone-shaped/mobile viewport,",
        "  - seeds two different save/memory records,",
        "  - plays at least one round from each save only through visible player events,",
        "  - asserts different available tappable actions at the element level (job, route, price, shortcut, or option),",
        "  - reads window.__game only as an assertion surface, and",
        "  - takes no input through window.__game.input.*.",
        `Scanned ${playtests.length} playtest spec(s): ${playtests.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });
});
