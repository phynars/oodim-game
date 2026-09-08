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
// Two-save-state signal. Real shipped specs write "two save slots" and
// "two different memory records" — neither of which is adjacent — so
// adjacency across a `\s+` gap would find nothing. Match on the tokens
// that DO appear in the flagship specs (`m-loop-divergence.playtest.spec.ts`,
// `m-loop-e1-two-round-playtest.spec.ts`,
// `memory-divergence-phone-playtest.spec.ts`,
// `m-loop-divergent-offered-actions.playtest.spec.ts`,
// `m-loop-e1-phone-action-divergence.spec.ts`): "save slot(s)",
// "save-state(s)", "memory record(s)", "two round(s)", and the
// memory-branch axis names both specs use (priorOutcome / packet /
// returnReason / completed set / safe default / looped return).
const TWO_SAVE_STATES_PATTERN = /save[-\s]?slots?|save[-\s]?states?|memory\s+records?|two[-\s]?rounds?|looped\s+return|priorOutcome|packet\.delivered|completed\s+set|safe[-\s]?default|returnReason|returnAnswerTone|packetOutcome|firstSave|secondSave|trusted|distrusted|riskTaken|riskAvoided|prior\s+outcomes|trust\s+posture/i;
// Harness-input rejection must fire on CODE, not on prose. The flagship
// specs document their abstinence in a header comment that contains the
// literal `window.__game.input.*` — that substring would trip the raw-
// source check and reject the very specs the guard is meant to admit.
// Strip //-comments, /* ... */ comments, and string/template literals
// before applying HARNESS_INPUT_PATTERN. Mirrors the sibling helper in
// `aftersignMemoryDivergencePlaytestSurface.test.ts`.
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const HARNESS_READ_PATTERN = /(?:window\.)?__game\b/;
const DIALOGUE_ONLY_PATTERN = /(?:getByText|toContainText|textContent)[\s\S]{0,200}(?:different|divergent|not\.toEqual|not\.toStrictEqual)/i;

function stripCommentsAndStrings(source: string): string {
  // Order matters: block comments before line comments before strings.
  // Disjoint alternatives inside the template-literal branch (CodeQL
  // js/redos): escape | ${...} | lone $ | anything-but-`-\-$ — no
  // char is consumable two ways, so matching is linear.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, "$1")
    .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|\$(?!\{)|[^`\\$])*`/g, "``")
    .replace(/"(?:\\[\s\S]|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\[\s\S]|[^'\\\n])*'/g, "''");
}

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
  // Only the harness-input rejection needs comment/string stripping — a
  // `toBeVisible` inside a comment is still evidence of intent, but a
  // `__game.input.` inside a comment is documentation of abstinence.
  const code = stripCommentsAndStrings(source);

  return (
    PHONE_VIEWPORT_PATTERN.test(source) &&
    PLAYER_EVENT_PATTERN.test(source) &&
    VISIBLE_ACTION_PATTERN.test(source) &&
    DIFFERENT_ACTIONS_PATTERN.test(source) &&
    TWO_SAVE_STATES_PATTERN.test(source) &&
    HARNESS_READ_PATTERN.test(source) &&
    !HARNESS_INPUT_PATTERN.test(code) &&
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
        "  - seeds or reaches two different save-slots / save-states / memory records,",
        "  - drives the served page only through visible player events (tap/click/press/pointer/etc.),",
        "  - asserts different AVAILABLE TAPPABLE ACTIONS (jobs, routes, prices, shortcuts), not dialogue-only text,",
        "  - reads window.__game only as an assertion surface, and",
        "  - takes no input through window.__game.input.* (comments documenting abstinence are fine).",
        `Scanned ${playtests.length} playtest spec(s): ${playtests.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });
});
