import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Playtest specs live at repo-root `aftersign/e2e/`, not under apps/web.
// Sibling guard `aftersignMilestoneAcceptanceSurface.test.ts` documents this
// trap: scanning the wrong tree makes the assertion pass vacuously (empty
// list → find() undefined → toBeDefined fails on every CI run).
const AFTERSIGN_E2E_DIR = join(process.cwd(), "aftersign", "e2e");

const PHONE_VIEWPORT_PATTERN = /(?:375\s*,\s*812|390\s*,\s*844|414\s*,\s*896|iphone|pixel|mobile|isMobile\s*:\s*true)/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const VISIBLE_ASSERTION_PATTERN = /\b(?:toBeVisible|getByRole|getByText|getByLabelText|locator)\s*\(/;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const HARNESS_READ_PATTERN = /(?:window\.)?__game\b/;
const SAVE_SIGNAL_PATTERN = /(?:save|saved|persist|durable|localStorage|sessionStorage|returning|remembered|recall)/i;
const LOAD_SIGNAL_PATTERN = /(?:reload|goto\s*\(|newContext|newPage|returning|restored|loaded|remembered|recall)/i;
const PRIOR_SESSION_ASSERTION_PATTERN = /(?:previous session|last time|again|returning|remembered|recall|restored|saved)/i;

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

function matchesDurableSaveLoadPlaytest(source: string): boolean {
  return (
    PHONE_VIEWPORT_PATTERN.test(source) &&
    PLAYER_EVENT_PATTERN.test(source) &&
    VISIBLE_ASSERTION_PATTERN.test(source) &&
    HARNESS_READ_PATTERN.test(source) &&
    !HARNESS_INPUT_PATTERN.test(source) &&
    SAVE_SIGNAL_PATTERN.test(source) &&
    LOAD_SIGNAL_PATTERN.test(source) &&
    PRIOR_SESSION_ASSERTION_PATTERN.test(source)
  );
}

function matchesDivergentMemoryActionsPlaytest(source: string): boolean {
  return (
    PHONE_VIEWPORT_PATTERN.test(source) &&
    PLAYER_EVENT_PATTERN.test(source) &&
    VISIBLE_ASSERTION_PATTERN.test(source) &&
    HARNESS_READ_PATTERN.test(source) &&
    !HARNESS_INPUT_PATTERN.test(source) &&
    DIVERGENT_SAVE_SIGNAL_PATTERN.test(source) &&
    MEMORY_SEED_PATTERN.test(source) &&
    AVAILABLE_ACTION_PATTERN.test(source) &&
    DIFFERENT_TAPPABLE_ACTIONS_PATTERN.test(source)
  );
}

describe("AFTERSIGN durable save/load played acceptance surface", () => {
  it("has a phone playtest that proves a return session through visible player actions, with window.__game read-only", () => {
    const playtests = readAftersignPlaytestSpecs();
    const matchingPlaytest = playtests.find(({ source }) => matchesDurableSaveLoadPlaytest(source));

    expect(
      matchingPlaytest?.path,
      [
        "M-WIRE/M-CONTINUE durable save/load acceptance must be played, not driven.",
        "Add or update an aftersign/e2e/*playtest*.spec.ts (repo-root, NOT under apps/web) that:",
        "  - uses a phone-shaped/mobile viewport,",
        "  - drives the served page only through visible player events (tap/click/press/pointer/etc.),",
        "  - asserts visible UI for the save and return-session load/recognition path,",
        "  - reads window.__game only as an assertion surface, and",
        "  - takes no input through window.__game.input.*.",
        `Scanned ${playtests.length} playtest spec(s): ${playtests.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });

  it("has a phone playtest proving divergent memory records produce different tappable actions", () => {
    const playtests = readAftersignPlaytestSpecs();
    const matchingPlaytest = playtests.find(({ source }) => matchesDivergentMemoryActionsPlaytest(source));

    expect(
      matchingPlaytest?.path,
      [
        "M-LOOP acceptance is divergence, played through the served page.",
        "Add or update an aftersign/e2e/*playtest*.spec.ts (repo-root, NOT under apps/web) that:",
        "  - uses a phone-shaped/mobile viewport,",
        "  - seeds or loads two saves with different memory records,",
        "  - plays each save only through visible player events (tap/click/press/pointer/etc.),",
        "  - asserts the available tappable actions differ at the element/action level,",
        "  - reads window.__game only as an assertion surface, and",
        "  - takes no input through window.__game.input.*.",
        "Dialogue-only differences are not enough; the offered jobs, prices, routes, shortcuts, or other tappable actions must diverge.",
        `Scanned ${playtests.length} playtest spec(s): ${playtests.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });
});
