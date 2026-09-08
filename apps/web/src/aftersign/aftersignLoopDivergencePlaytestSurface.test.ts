import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// M-LOOP acceptance must prove the flagship's load-bearing memory mechanic on
// the served page. The bar is divergence: two different memory records produce
// different tappable actions, by taps only, on a phone-shaped viewport.
const AFTERSIGN_E2E_DIR = join(process.cwd(), "aftersign", "e2e");

const PHONE_VIEWPORT_PATTERN = /(?:375\s*,\s*812|390\s*,\s*844|414\s*,\s*896|iphone|pixel|mobile|isMobile\s*:\s*true)/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const VISIBLE_ACTION_PATTERN = /\b(?:getByRole|getByLabelText|locator)\s*\([^\n]*(?:button|link|menuitem|checkbox|radio|tab|option|action|job|route|price|shortcut)/i;
const DIFFERENT_ACTIONS_PATTERN = /(?:different|divergent|not\.toEqual|not\.toStrictEqual|toHaveCount\s*\(\s*2|available actions|tappable actions|job offers|open routes|prices)/i;
const TWO_SAVE_STATES_PATTERN = /(?:two\s+(?:save[- ]states|memory records|saves)|firstSave|secondSave|trusted|distrusted|riskTaken|riskAvoided|prior outcomes|trust posture)/i;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const HARNESS_READ_PATTERN = /(?:window\.)?__game\b/;
const DIALOGUE_ONLY_PATTERN = /(?:getByText|toContainText|textContent)[\s\S]{0,200}(?:different|divergent|not\.toEqual|not\.toStrictEqual)/i;

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

function matchesLoopDivergencePlaytest(source: string): boolean {
  return (
    PHONE_VIEWPORT_PATTERN.test(source) &&
    PLAYER_EVENT_PATTERN.test(source) &&
    VISIBLE_ACTION_PATTERN.test(source) &&
    DIFFERENT_ACTIONS_PATTERN.test(source) &&
    TWO_SAVE_STATES_PATTERN.test(source) &&
    HARNESS_READ_PATTERN.test(source) &&
    !HARNESS_INPUT_PATTERN.test(source) &&
    !DIALOGUE_ONLY_PATTERN.test(source)
  );
}

describe("AFTERSIGN M-LOOP divergence played acceptance surface", () => {
  it("has a phone playtest proving two memory records produce different tappable actions without harness input", () => {
    const playtests = readAftersignPlaytestSpecs();
    const matchingPlaytest = playtests.find(({ source }) => matchesLoopDivergencePlaytest(source));

    expect(
      matchingPlaytest?.path,
      [
        "M-LOOP acceptance must be played, not driven, and must prove mechanical divergence.",
        "Add or update an aftersign/e2e/*playtest*.spec.ts (repo-root, NOT under apps/web) that:",
        "  - uses a phone-shaped/mobile viewport,",
        "  - seeds or reaches two different save-states / memory records,",
        "  - drives the served page only through visible player events (tap/click/press/pointer/etc.),",
        "  - asserts different AVAILABLE TAPPABLE ACTIONS (jobs, routes, prices, shortcuts), not dialogue-only text,",
        "  - reads window.__game only as an assertion surface, and",
        "  - takes no input through window.__game.input.*.",
        `Scanned ${playtests.length} playtest spec(s): ${playtests.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });
});
